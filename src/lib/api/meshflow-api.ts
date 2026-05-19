import { BaseApi } from './base';
import {
  ObservedNode,
  ManagedNode,
  OwnedManagedNode,
  DeviceMetrics,
  EnvironmentMetrics,
  PowerMetrics,
  Position,
  NodeSearchResult,
  PaginatedResponse,
  GlobalStats,
  NeighbourStats,
  StatsSnapshot,
  Constellation,
  MessageChannel,
  TextMessage,
  TextMessageResponse,
  NodeClaim,
  CreateManagedNode,
  NodeApiKey,
  CreateNodeApiKey,
  AutoTraceRoute,
  DiscordNotificationPrefs,
  NodeWatch,
  NodeMonitoringConfig,
  NodeMonitoringConfigPatch,
  MeshInfraMonitoringAlertSummary,
  DxEventListItem,
  DxEventDetail,
  DxNodeExclusionResponse,
  DxNotificationSettings,
  DxNotificationSettingsWrite,
  MeshCorePacketListItem,
} from '../models';
import {
  ApiConfig,
  DateRangeParams,
  DateRangeIntervalParams,
  PaginationParams,
  StatsSnapshotsParams,
  DxEventsQueryParams,
} from '@/lib/types';
import { parseNodeWatchFromAPI, parseObservedNodeFromAPI } from './api-utils';
import type { RfProfile, RfProfileUpdateBody, RfPropagationPollResult, RfPropagationRenderRow } from '@/lib/models';

export interface FeederReachFeeder {
  managed_node_id: string;
  meshtastic_node_id: number;
  node_id_str: string;
  short_name?: string | null;
  long_name?: string | null;
  lat: number | null;
  lng: number | null;
}

export interface FeederReachTarget {
  meshtastic_node_id: number;
  node_id_str: string;
  short_name?: string | null;
  long_name?: string | null;
  lat: number;
  lng: number;
  attempts: number;
  successes: number;
}

export interface CoverageWindow {
  start: string | null;
  end: string | null;
}

export interface FeederReachData {
  feeder: FeederReachFeeder;
  targets: FeederReachTarget[];
  meta: { window: CoverageWindow };
}

export interface ConstellationCoverageHex {
  h3_index: string;
  centre_lat: number;
  centre_lng: number;
  attempts: number;
  successes: number;
  contributing_feeders: number;
  contributing_targets: number;
}

/** Per-target aggregate across all feeders (when `include_targets=1`). */
export interface ConstellationCoverageTarget {
  meshtastic_node_id: number;
  node_id_str: string;
  short_name: string | null;
  long_name: string | null;
  lat: number;
  lng: number;
  attempts: number;
  successes: number;
  contributing_feeders: number;
}

export interface ConstellationCoverageData {
  constellation_id: number;
  h3_resolution: number;
  hexes: ConstellationCoverageHex[];
  meta: { window: CoverageWindow };
  /** Present when the request used `include_targets=1`. */
  targets?: ConstellationCoverageTarget[];
  /** Managed nodes in the constellation with a map position (same shape as feeder-reach `feeder`). */
  feeders?: FeederReachFeeder[];
}

export class MeshflowApi extends BaseApi {
  constructor(config: ApiConfig) {
    super(config);
  }

  // ===== Observed Nodes API =====

  /**
   * List observed nodes (`GET /nodes/observed-nodes/`) — mixed Meshtastic and MeshCore.
   * Pass `protocol` to filter; nested `latest_*` metrics are Meshtastic-shaped when present.
   * Detail by numeric id via {@link getNode} is Meshtastic-only (MeshCore: filter list/search).
   */
  async getObservedNodes(
    params?: PaginationParams & { protocol?: 'meshtastic' | 'meshcore' }
  ): Promise<PaginatedResponse<ObservedNode>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    if (params?.last_heard_after) {
      searchParams.append('last_heard_after', params.last_heard_after.toISOString());
    }
    if (params?.protocol) {
      searchParams.append('protocol', params.protocol);
    }

    const response = await this.get<PaginatedResponse<ObservedNode>>('/nodes/observed-nodes/', searchParams);
    return {
      ...response,
      results: response.results.map((node) => parseObservedNodeFromAPI(node)),
    };
  }

  /** @deprecated Use {@link getObservedNodes} */
  async getNodes(
    params?: PaginationParams & { protocol?: 'meshtastic' | 'meshcore' }
  ): Promise<PaginatedResponse<ObservedNode>> {
    return this.getObservedNodes(params);
  }

  /**
   * Get a paginated list of observed nodes owned by the current user
   */
  async getMyClaimedNodes(params?: PaginationParams): Promise<PaginatedResponse<ObservedNode>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    const response = await this.get<PaginatedResponse<ObservedNode>>('/nodes/observed-nodes/mine/', searchParams);
    return {
      ...response,
      results: response.results.map((node) => parseObservedNodeFromAPI(node)),
    };
  }

  /**
   * Get one observed node by Meshtastic numeric `meshtastic_node_id` (path `/nodes/observed-nodes/{id}/`).
   * Not valid for MeshCore nodes until internal_id lookup exists — use {@link getNodes} with
   * `protocol: 'meshcore'` or search instead.
   */
  async getObservedNode(internalId: string): Promise<ObservedNode> {
    const node = await this.get<ObservedNode>(`/nodes/observed-nodes/${internalId}/`);
    return parseObservedNodeFromAPI(node);
  }

  /** @deprecated Use {@link getObservedNode} */
  async getNode(internalId: string): Promise<ObservedNode> {
    return this.getObservedNode(internalId);
  }

  /**
   * Get node counts by time window (nodes seen since each threshold).
   * Returns: { "2": n, "24": n, "168": n, "720": n, "2160": n, "all": n }
   */
  async getRecentNodeCounts(): Promise<Record<string, number>> {
    return this.get<Record<string, number>>('/nodes/observed-nodes/recent_counts/');
  }

  /**
   * Get infrastructure nodes (router, repeater, router_late, ROUTER_CLIENT).
   * Optionally include CLIENT_BASE via includeClientBase.
   */
  async getInfrastructureNodes(params?: {
    lastHeardAfter?: Date;
    page?: number;
    pageSize?: number;
    includeClientBase?: boolean;
  }): Promise<PaginatedResponse<ObservedNode>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('page_size', params.pageSize.toString());
    if (params?.lastHeardAfter) {
      searchParams.append('last_heard_after', params.lastHeardAfter.toISOString());
    }
    if (params?.includeClientBase) {
      searchParams.append('include_client_base', 'true');
    }

    const response = await this.get<PaginatedResponse<ObservedNode>>(
      '/nodes/observed-nodes/infrastructure/',
      searchParams
    );
    return {
      ...response,
      results: response.results.map((node) => parseObservedNodeFromAPI(node)),
    };
  }

  /**
   * Get weather nodes (nodes with environment metrics within cutoff).
   */
  async getWeatherNodes(params?: {
    environmentReportedAfter?: Date;
    page?: number;
    pageSize?: number;
    /** Repeat query param; typical default for maps: include + unknown */
    weatherUse?: string[];
    environmentExposure?: string[];
  }): Promise<PaginatedResponse<ObservedNode>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('page_size', params.pageSize.toString());
    if (params?.environmentReportedAfter) {
      searchParams.append('environment_reported_after', params.environmentReportedAfter.toISOString());
    }
    for (const w of params?.weatherUse ?? []) {
      searchParams.append('weather_use', w);
    }
    for (const e of params?.environmentExposure ?? []) {
      searchParams.append('environment_exposure', e);
    }

    const response = await this.get<PaginatedResponse<ObservedNode>>('/nodes/observed-nodes/weather/', searchParams);
    return {
      ...response,
      results: response.results.map((node) => parseObservedNodeFromAPI(node)),
    };
  }

  /**
   * Update environment exposure / weather_use (staff or claim owner only).
   */
  async patchObservedNodeEnvironmentSettings(
    internalId: string,
    body: { environment_exposure?: string; weather_use?: string }
  ): Promise<ObservedNode> {
    const node = await this.patch<ObservedNode>(`/nodes/observed-nodes/${internalId}/environment-settings/`, body);
    return parseObservedNodeFromAPI(node);
  }

  /**
   * Get RF propagation profile. Returns null when the API responds with 204 (no profile yet).
   */
  async getRfProfile(internalId: string): Promise<RfProfile | null> {
    const response = await this.axios.get<RfProfile>(`/nodes/observed-nodes/${internalId}/rf-profile/`, {
      validateStatus: (s) => s === 200 || s === 204,
    });
    if (response.status === 204) {
      return null;
    }
    return response.data;
  }

  async updateRfProfile(internalId: string, body: RfProfileUpdateBody): Promise<RfProfile> {
    return this.patch<RfProfile>(`/nodes/observed-nodes/${internalId}/rf-profile/`, body);
  }

  async getRfPropagation(internalId: string): Promise<RfPropagationPollResult> {
    return this.get<RfPropagationPollResult>(`/nodes/observed-nodes/${internalId}/rf-propagation/`);
  }

  async recomputeRfPropagation(internalId: string): Promise<RfPropagationRenderRow> {
    return this.post<RfPropagationRenderRow>(`/nodes/observed-nodes/${internalId}/rf-propagation/recompute/`);
  }

  async dismissRfPropagation(internalId: string): Promise<{ deleted: number }> {
    return this.post<{ deleted: number }>(`/nodes/observed-nodes/${internalId}/rf-propagation/dismiss/`);
  }

  /**
   * Search for observed nodes
   */
  async searchNodes(query: string): Promise<NodeSearchResult[]> {
    if (!query.trim()) return [];
    const searchParams = new URLSearchParams();
    searchParams.append('q', query);
    return this.get<NodeSearchResult[]>('/nodes/observed-nodes/search/', searchParams);
  }

  /**
   * Get device metrics for multiple nodes in one request (bulk).
   * Returns flat list; frontend groups by meshtastic_node_id for per-node charts.
   */
  async getDeviceMetricsBulk(
    nodeIds: number[],
    params?: DateRangeParams
  ): Promise<Array<DeviceMetrics & { meshtastic_node_id: number; node_id_str: string; short_name: string | null }>> {
    if (nodeIds.length === 0) return [];
    const searchParams = new URLSearchParams();
    searchParams.append('node_ids', nodeIds.join(','));
    if (params?.startDate) searchParams.append('start_date', params.startDate.toISOString());
    if (params?.endDate) searchParams.append('end_date', params.endDate.toISOString());

    const response = await this.get<{
      results: Array<DeviceMetrics & { meshtastic_node_id: number; node_id_str: string; short_name: string | null }>;
    }>('/nodes/device-metrics-bulk/', searchParams);
    return (response.results || []).map((metric) => ({
      ...metric,
      logged_time: metric.logged_time != null ? new Date(metric.logged_time) : null,
      reported_time: metric.reported_time != null ? new Date(metric.reported_time) : null,
    }));
  }

  /**
   * Get device metrics for a specific node
   */
  async getNodeDeviceMetrics(internalId: string, params?: DateRangeParams): Promise<DeviceMetrics[]> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('start_date', params.startDate.toISOString());
    if (params?.endDate) searchParams.append('end_date', params.endDate.toISOString());

    const metrics = await this.get<DeviceMetrics[]>(
      `/nodes/observed-nodes/${internalId}/device_metrics/`,
      searchParams
    );
    return metrics.map((metric) => ({
      ...metric,
      logged_time: metric.logged_time != null ? new Date(metric.logged_time) : null,
      reported_time: metric.reported_time != null ? new Date(metric.reported_time) : null,
    }));
  }

  /**
   * Get environment metrics for multiple nodes in one request (bulk).
   * Returns flat list; frontend groups by meshtastic_node_id for per-node charts.
   */
  async getEnvironmentMetricsBulk(
    nodeIds: number[],
    params?: DateRangeParams
  ): Promise<
    Array<EnvironmentMetrics & { meshtastic_node_id: number; node_id_str: string; short_name: string | null }>
  > {
    if (nodeIds.length === 0) return [];
    const searchParams = new URLSearchParams();
    searchParams.append('node_ids', nodeIds.join(','));
    if (params?.startDate) searchParams.append('start_date', params.startDate.toISOString());
    if (params?.endDate) searchParams.append('end_date', params.endDate.toISOString());

    const response = await this.get<{
      results: Array<
        EnvironmentMetrics & { meshtastic_node_id: number; node_id_str: string; short_name: string | null }
      >;
    }>('/nodes/environment-metrics-bulk/', searchParams);
    return (response.results || []).map((metric) => ({
      ...metric,
      logged_time: metric.logged_time != null ? new Date(metric.logged_time) : null,
      reported_time: metric.reported_time != null ? new Date(metric.reported_time) : null,
    }));
  }

  /**
   * Get environment metrics for a specific node
   */
  async getNodeEnvironmentMetrics(internalId: string, params?: DateRangeParams): Promise<EnvironmentMetrics[]> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('start_date', params.startDate.toISOString());
    if (params?.endDate) searchParams.append('end_date', params.endDate.toISOString());

    const metrics = await this.get<EnvironmentMetrics[]>(
      `/nodes/observed-nodes/${internalId}/environment_metrics/`,
      searchParams
    );
    return metrics.map((metric) => ({
      ...metric,
      logged_time: metric.logged_time != null ? new Date(metric.logged_time) : null,
      reported_time: metric.reported_time != null ? new Date(metric.reported_time) : null,
    }));
  }

  /**
   * Get power metrics for a specific node
   */
  async getNodePowerMetrics(internalId: string, params?: DateRangeParams): Promise<PowerMetrics[]> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('start_date', params.startDate.toISOString());
    if (params?.endDate) searchParams.append('end_date', params.endDate.toISOString());

    const metrics = await this.get<PowerMetrics[]>(`/nodes/observed-nodes/${internalId}/power_metrics/`, searchParams);
    return metrics.map((metric) => ({
      ...metric,
      logged_time: metric.logged_time != null ? new Date(metric.logged_time) : null,
      reported_time: metric.reported_time != null ? new Date(metric.reported_time) : null,
    }));
  }

  /**
   * Get positions for a specific node
   */
  async getNodePositions(internalId: string, params?: DateRangeParams): Promise<Position[]> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('start_date', params.startDate.toISOString());
    if (params?.endDate) searchParams.append('end_date', params.endDate.toISOString());

    const positions = await this.get<Position[]>(`/nodes/observed-nodes/${internalId}/positions/`, searchParams);
    return positions.map((position) => ({
      ...position,
      logged_time: position.logged_time != null ? new Date(position.logged_time) : null,
      reported_time: position.reported_time != null ? new Date(position.reported_time) : null,
    }));
  }

  /**
   * Get claim status for a node
   */
  async getClaimStatus(internalId: string): Promise<NodeClaim | undefined> {
    const response = await this.get<NodeClaim>(`/nodes/observed-nodes/${internalId}/claim/`);
    return response;
  }

  /**
   * Claim a node
   */
  async claimNode(internalId: string): Promise<NodeClaim> {
    return this.post<NodeClaim>(`/nodes/observed-nodes/${internalId}/claim/`);
  }

  /**
   * Release the current user's claim on this observed node (`DELETE .../claim/`).
   * Withdraws a pending claim or clears accepted ownership (`claimed_by`) when you own the claim.
   */
  async releaseNodeClaim(internalId: string): Promise<void> {
    await this.delete<void>(`/nodes/observed-nodes/${internalId}/claim/`);
  }

  /** Same as {@link MeshflowApi.releaseNodeClaim}. */
  async cancelNodeClaim(internalId: string): Promise<void> {
    return this.releaseNodeClaim(internalId);
  }

  /**
   * Get all node claims for the current user
   * @returns Array of NodeClaim objects
   */
  async getMyClaims(): Promise<NodeClaim[]> {
    return this.get<NodeClaim[]>('/nodes/claims/mine/');
  }

  // ===== Managed Nodes API =====

  /**
   * Get a paginated list of managed nodes
   */
  async getMeshCoreNodes(
    params?: PaginationParams & { last_heard_after?: Date }
  ): Promise<PaginatedResponse<ObservedNode>> {
    return this.getNodes({ ...params, protocol: 'meshcore' });
  }

  async getMeshCoreManagedNodes(
    params?: PaginationParams & { includeStatus?: boolean }
  ): Promise<PaginatedResponse<ManagedNode>> {
    const response = await this.getManagedNodes(params);
    return {
      ...response,
      results: response.results.filter((n) => n.protocol === 2),
    };
  }

  async getMeshCorePackets(
    params?: PaginationParams & { payload_type?: number; from_pubkey_prefix?: string }
  ): Promise<PaginatedResponse<MeshCorePacketListItem>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    if (params?.payload_type != null) searchParams.append('payload_type', String(params.payload_type));
    if (params?.from_pubkey_prefix) searchParams.append('from_pubkey_prefix', params.from_pubkey_prefix);
    return this.get('/meshcore/packets/', searchParams);
  }

  async getManagedNodes(
    params?: PaginationParams & {
      includeStatus?: boolean;
      includeGeoClassification?: boolean;
    }
  ): Promise<PaginatedResponse<ManagedNode>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    const includes: string[] = [];
    if (params?.includeStatus) includes.push('status');
    if (params?.includeGeoClassification) includes.push('geo_classification');
    if (includes.length) searchParams.set('include', includes.join(','));
    return this.get<PaginatedResponse<ManagedNode>>('/nodes/managed-nodes/', searchParams);
  }

  /**
   * Get a paginated list of managed nodes owned by the current user
   */
  async getMyManagedNodes(params?: PaginationParams): Promise<PaginatedResponse<OwnedManagedNode>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    return this.get<PaginatedResponse<OwnedManagedNode>>('/nodes/managed-nodes/mine/', searchParams);
  }

  /**
   * Get a single managed node by ID
   */
  async getManagedNode(id: number): Promise<ManagedNode> {
    return this.get<ManagedNode>(`/nodes/managed-nodes/${id}/`);
  }

  /**
   * Partially update a managed node (e.g. Meshtastic channel slot → MessageChannel mappings).
   */
  async patchManagedNode(
    nodeId: number,
    body: {
      meshtastic_channel_0?: number | null;
      meshtastic_channel_1?: number | null;
      meshtastic_channel_2?: number | null;
      meshtastic_channel_3?: number | null;
      meshtastic_channel_4?: number | null;
      meshtastic_channel_5?: number | null;
      meshtastic_channel_6?: number | null;
      meshtastic_channel_7?: number | null;
    }
  ): Promise<OwnedManagedNode> {
    return this.patch<OwnedManagedNode>(`/nodes/managed-nodes/${nodeId}/`, body);
  }

  /**
   * Create a managed node
   */
  async createManagedNode(
    nodeId: number,
    constellationId: number,
    name: string,
    ownerId: number | null,
    options?: {
      defaultLocationLatitude?: number;
      defaultLocationLongitude?: number;
      channels?: {
        meshtastic_channel_0?: number | null;
        meshtastic_channel_1?: number | null;
        meshtastic_channel_2?: number | null;
        meshtastic_channel_3?: number | null;
        meshtastic_channel_4?: number | null;
        meshtastic_channel_5?: number | null;
        meshtastic_channel_6?: number | null;
        meshtastic_channel_7?: number | null;
      };
    }
  ): Promise<OwnedManagedNode> {
    const data: CreateManagedNode = {
      meshtastic_node_id: nodeId,
      constellation_id: constellationId,
      name: name,
      owner_id: ownerId,
      default_location_latitude: options?.defaultLocationLatitude ?? null,
      default_location_longitude: options?.defaultLocationLongitude ?? null,
      meshtastic_channel_0: options?.channels?.meshtastic_channel_0 ?? null,
      meshtastic_channel_1: options?.channels?.meshtastic_channel_1 ?? null,
      meshtastic_channel_2: options?.channels?.meshtastic_channel_2 ?? null,
      meshtastic_channel_3: options?.channels?.meshtastic_channel_3 ?? null,
      meshtastic_channel_4: options?.channels?.meshtastic_channel_4 ?? null,
      meshtastic_channel_5: options?.channels?.meshtastic_channel_5 ?? null,
      meshtastic_channel_6: options?.channels?.meshtastic_channel_6 ?? null,
      meshtastic_channel_7: options?.channels?.meshtastic_channel_7 ?? null,
    };

    return this.post<OwnedManagedNode>('/nodes/managed-nodes/', data);
  }

  /**
   * Soft-delete (un-manage) a managed node: removes API-key links and hides the row from listings.
   * Does not clear the observed-node claim.
   */
  async deleteManagedNode(nodeId: number): Promise<void> {
    await this.delete<void>(`/nodes/managed-nodes/${nodeId}/`);
  }

  // ===== API Keys =====

  /**
   * Get a list of API keys
   */
  async getApiKeys(): Promise<NodeApiKey[]> {
    const response = await this.get<PaginatedResponse<NodeApiKey>>('/nodes/api-keys/');
    return response.results;
  }

  /**
   * Create an API key
   */
  async createApiKey(name: string, constellationId: number): Promise<NodeApiKey> {
    const data: CreateNodeApiKey = {
      name,
      constellation: constellationId,
    };

    return this.post<NodeApiKey>('/nodes/api-keys/', data);
  }

  /**
   * Add a node to an API key
   */
  async addNodeToApiKey(apiKeyId: string, nodeId: number): Promise<NodeApiKey> {
    return this.post<NodeApiKey>(`/nodes/api-keys/${apiKeyId}/add_node/`, { meshtastic_node_id: nodeId });
  }

  /**
   * Remove a node from an API key
   */
  async removeNodeFromApiKey(apiKeyId: string, nodeId: number): Promise<NodeApiKey> {
    return this.post<NodeApiKey>(`/nodes/api-keys/${apiKeyId}/remove_node/`, { meshtastic_node_id: nodeId });
  }

  /**
   * Delete an API key
   */
  async deleteApiKey(apiKeyId: string): Promise<void> {
    await this.delete<void>(`/nodes/api-keys/${apiKeyId}/`);
  }

  /**
   * Update an API key (name, is_active). Uses PATCH for partial updates.
   */
  async updateApiKey(apiKeyId: string, data: { name?: string; is_active?: boolean }): Promise<NodeApiKey> {
    return this.patch<NodeApiKey>(`/nodes/api-keys/${apiKeyId}/`, data);
  }

  // ===== Constellations API =====

  /**
   * Get a paginated list of constellations
   */
  async getConstellations(params?: PaginationParams): Promise<PaginatedResponse<Constellation>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    return this.get<PaginatedResponse<Constellation>>('/constellations', searchParams);
  }

  /**
   * Get channels for a constellation (DRF paginated list; we return the `results` array).
   */
  async getConstellationChannels(constellationId: number): Promise<MessageChannel[]> {
    const searchParams = new URLSearchParams();
    searchParams.append('page_size', '1000');
    const response = await this.get<PaginatedResponse<MessageChannel>>(
      `/constellations/${constellationId}/channels/`,
      searchParams
    );
    return response.results ?? [];
  }

  // ===== Messages API =====

  /**
   * Get text messages
   */
  async getTextMessages(params: {
    channelId?: number;
    constellationId?: number;
    nodeId?: number;
    page?: number;
    page_size?: number;
  }): Promise<TextMessageResponse> {
    const searchParams = new URLSearchParams();
    if (params.channelId) searchParams.append('channel_id', params.channelId.toString());
    if (params.constellationId) searchParams.append('constellation_id', params.constellationId.toString());
    if (params.nodeId) searchParams.append('sender_node_id', params.nodeId.toString());
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.page_size) searchParams.append('page_size', params.page_size.toString());
    return this.get<TextMessageResponse>('/messages/text/', searchParams);
  }

  /**
   * Get a single text message
   */
  async getTextMessage(id: string): Promise<TextMessage> {
    return this.get<TextMessage>(`/messages/text/${id}/`);
  }

  // ===== Stats API =====

  /**
   * Get global stats
   */
  async getGlobalStats(params?: DateRangeIntervalParams): Promise<GlobalStats> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('start_date', params.startDate.toISOString());
    if (params?.endDate) searchParams.append('end_date', params.endDate.toISOString());
    if (params?.interval) searchParams.append('interval', params.interval.toString());
    if (params?.intervalType) searchParams.append('interval_type', params.intervalType);

    const response = await this.get<GlobalStats>('/stats/global/', searchParams);
    return {
      ...response,
      intervals: response.intervals.map((interval) => ({
        ...interval,
        start_date: new Date(interval.start_date).toISOString(),
        end_date: new Date(interval.end_date).toISOString(),
      })),
      summary: {
        ...response.summary,
        time_range: {
          start: new Date(response.summary.time_range.start).toISOString(),
          end: new Date(response.summary.time_range.end).toISOString(),
        },
      },
    };
  }

  /**
   * Get node stats
   */
  async getNodeStats(nodeId: number, params?: DateRangeIntervalParams): Promise<GlobalStats> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('start_date', params.startDate.toISOString());
    if (params?.endDate) searchParams.append('end_date', params.endDate.toISOString());
    if (params?.interval) searchParams.append('interval', params.interval.toString());
    if (params?.intervalType) searchParams.append('interval_type', params.intervalType);

    const response = await this.get<GlobalStats>(`/stats/nodes/${nodeId}/packets/`, searchParams);
    return {
      ...response,
      intervals: response.intervals.map((interval) => ({
        ...interval,
        start_date: new Date(interval.start_date).toISOString(),
        end_date: new Date(interval.end_date).toISOString(),
      })),
    };
  }

  /**
   * Get node received stats (packets heard by the node)
   */
  async getNodeReceivedStats(nodeId: number, params?: DateRangeIntervalParams): Promise<GlobalStats> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('start_date', params.startDate.toISOString());
    if (params?.endDate) searchParams.append('end_date', params.endDate.toISOString());
    if (params?.interval) searchParams.append('interval', params.interval.toString());
    if (params?.intervalType) searchParams.append('interval_type', params.intervalType);

    const response = await this.get<GlobalStats>(`/stats/nodes/${nodeId}/received/`, searchParams);
    return {
      ...response,
      intervals: response.intervals.map((interval) => ({
        ...interval,
        start_date: new Date(interval.start_date).toISOString(),
        end_date: new Date(interval.end_date).toISOString(),
      })),
    };
  }

  /**
   * Get stored stats snapshots with optional filters
   */
  async getStatsSnapshots(params?: StatsSnapshotsParams): Promise<PaginatedResponse<StatsSnapshot>> {
    const searchParams = new URLSearchParams();
    if (params?.statType) searchParams.append('stat_type', params.statType);
    if (params?.constellationId != null) searchParams.append('constellation_id', params.constellationId.toString());
    if (params?.recordedAtAfter) searchParams.append('recorded_at_after', params.recordedAtAfter.toISOString());
    if (params?.recordedAtBefore) searchParams.append('recorded_at_before', params.recordedAtBefore.toISOString());
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());

    return this.get<PaginatedResponse<StatsSnapshot>>('/stats/snapshots/', searchParams);
  }

  /**
   * Get neighbour stats (packets received by source node) for a managed node
   */
  async getNodeNeighbourStats(nodeId: number, params?: DateRangeParams): Promise<NeighbourStats> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('start_date', params.startDate.toISOString());
    if (params?.endDate) searchParams.append('end_date', params.endDate.toISOString());

    return this.get(`/stats/nodes/${nodeId}/neighbours/`, searchParams);
  }

  // ===== Traceroutes API =====

  /**
   * Get traceroute history with optional filters
   */
  async getTraceroutes(params?: {
    managed_node?: number;
    source_node?: number;
    target_node?: number;
    status?: string;
    trigger_type?: string;
    target_strategy?: string;
    triggered_after?: string;
    triggered_before?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<AutoTraceRoute>> {
    const searchParams = new URLSearchParams();
    if (params?.managed_node) searchParams.append('managed_node', params.managed_node.toString());
    if (params?.source_node) searchParams.append('source_node', params.source_node.toString());
    if (params?.target_node) searchParams.append('target_node', params.target_node.toString());
    if (params?.status) searchParams.append('status', params.status);
    if (params?.trigger_type) searchParams.append('trigger_type', params.trigger_type);
    if (params?.target_strategy) searchParams.append('target_strategy', params.target_strategy);
    if (params?.triggered_after) searchParams.append('triggered_after', params.triggered_after);
    if (params?.triggered_before) searchParams.append('triggered_before', params.triggered_before);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    return this.get<PaginatedResponse<AutoTraceRoute>>('/traceroutes/', searchParams);
  }

  /**
   * Get a single traceroute by ID
   */
  async getTraceroute(id: number): Promise<AutoTraceRoute> {
    return this.get<AutoTraceRoute>(`/traceroutes/${id}/`);
  }

  /**
   * Trigger a traceroute manually
   */
  async triggerTraceroute(
    managedNodeId: number,
    targetNodeId?: number,
    targetStrategy?: 'intra_zone' | 'dx_across' | 'dx_same_side'
  ): Promise<AutoTraceRoute> {
    const data: {
      managed_node_id: number;
      target_node_id?: number;
      target_strategy?: 'intra_zone' | 'dx_across' | 'dx_same_side';
    } = { managed_node_id: managedNodeId };
    if (targetNodeId != null) data.target_node_id = targetNodeId;
    if (targetStrategy != null) data.target_strategy = targetStrategy;
    return this.post<AutoTraceRoute>('/traceroutes/trigger/', data);
  }

  /**
   * Check if the current user can trigger traceroutes
   */
  async canTriggerTraceroute(): Promise<{ can_trigger: boolean }> {
    return this.get<{ can_trigger: boolean }>('/traceroutes/can_trigger/');
  }

  /**
   * Get ManagedNodes the current user can trigger traceroutes from
   */
  async getTracerouteTriggerableNodes(): Promise<ManagedNode[]> {
    return this.get<ManagedNode[]>('/traceroutes/triggerable-nodes/');
  }

  /**
   * Get traceroute statistics (sources, success/failure, top routers, by source, success over time)
   */
  async getTracerouteStats(params?: { triggered_at_after?: string; source_node?: number }): Promise<{
    sources: Array<{ trigger_type: number; count: number }>;
    success_failure: Array<{ status: string; count: number }>;
    top_routers: Array<{ meshtastic_node_id: number; node_id_str: string; short_name: string; count: number }>;
    by_source: Array<{
      managed_node_id: string;
      meshtastic_node_id: number;
      node_id_str: string;
      name: string;
      short_name: string;
      total: number;
      completed: number;
      failed: number;
      success_rate: number | null;
    }>;
    by_target?: Array<{
      meshtastic_node_id: number;
      node_id_str: string;
      short_name: string | null;
      long_name: string | null;
      total: number;
      completed: number;
      failed: number;
      success_rate: number | null;
    }>;
    success_over_time: Array<{ date: string; completed: number; failed: number }>;
    by_strategy: Record<string, { completed: number; failed: number; pending: number; sent: number }>;
    by_strategy_excluding_external: Record<
      string,
      { completed: number; failed: number; pending: number; sent: number }
    >;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.triggered_at_after) {
      searchParams.append('triggered_at_after', params.triggered_at_after);
    }
    if (params?.source_node != null) {
      searchParams.append('source_node', String(params.source_node));
    }
    return this.get('/traceroutes/stats/', searchParams);
  }

  /**
   * Get aggregated heatmap edges and nodes for traceroute visualization
   */
  async getHeatmapEdges(params?: {
    triggered_at_after?: string;
    constellation_id?: number;
    bbox?: [number, number, number, number];
    edge_metric?: 'packets' | 'snr';
    source_node_id?: number;
    target_strategy?: string;
  }): Promise<{
    edges: Array<{
      from_node_id: number;
      to_node_id: number;
      from_lat: number;
      from_lng: number;
      to_lat: number;
      to_lng: number;
      weight: number;
      avg_snr?: number;
    }>;
    nodes: Array<{
      meshtastic_node_id: number;
      node_id_str: string;
      lat: number;
      lng: number;
      short_name?: string;
      long_name?: string;
      centrality?: number;
      degree?: number;
      last_seen?: string | null;
      role?: 'backbone' | 'relay' | 'leaf' | 'offline';
    }>;
    meta: {
      active_nodes_count: number;
      total_trace_routes_count: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (params?.triggered_at_after) {
      searchParams.append('triggered_at_after', params.triggered_at_after);
    }
    if (params?.constellation_id != null) {
      searchParams.append('constellation_id', params.constellation_id.toString());
    }
    if (params?.bbox && params.bbox.length >= 4) {
      searchParams.append('bbox', params.bbox.join(','));
    }
    if (params?.edge_metric) {
      searchParams.append('edge_metric', params.edge_metric);
    }
    if (params?.source_node_id != null) {
      searchParams.append('source_node_id', params.source_node_id.toString());
    }
    if (params?.target_strategy) {
      searchParams.append('target_strategy', params.target_strategy);
    }
    return this.get('/traceroutes/heatmap-edges/', searchParams);
  }

  /**
   * Get per-target attempt and success counts for one feeder.
   * The frontend uses this single payload to render dots, client-side H3
   * hexagons, and a concave-hull polygon. See
   * `docs/features/traceroute/coverage.md` in the API repo.
   */
  async getFeederReach(params: {
    feeder_id: number;
    triggered_at_after?: string;
    triggered_at_before?: string;
    /** Comma-separated strategy tokens (intra_zone, dx_across, dx_same_side, legacy). */
    target_strategy?: string;
  }): Promise<FeederReachData> {
    const searchParams = new URLSearchParams();
    searchParams.append('feeder_id', params.feeder_id.toString());
    if (params.triggered_at_after) {
      searchParams.append('triggered_at_after', params.triggered_at_after);
    }
    if (params.triggered_at_before) {
      searchParams.append('triggered_at_before', params.triggered_at_before);
    }
    if (params.target_strategy) {
      searchParams.append('target_strategy', params.target_strategy);
    }
    return this.get('/traceroutes/feeder-reach/', searchParams);
  }

  /**
   * Get server-side H3-binned reliability for a constellation.
   */
  async getConstellationCoverage(params: {
    constellation_id: number;
    triggered_at_after?: string;
    triggered_at_before?: string;
    h3_resolution?: number;
    /** When true, response includes `targets` and `feeders` for map layers. */
    include_targets?: boolean;
    /** Comma-separated strategy tokens (same as feeder-reach). */
    target_strategy?: string;
  }): Promise<ConstellationCoverageData> {
    const searchParams = new URLSearchParams();
    searchParams.append('constellation_id', params.constellation_id.toString());
    if (params.triggered_at_after) {
      searchParams.append('triggered_at_after', params.triggered_at_after);
    }
    if (params.triggered_at_before) {
      searchParams.append('triggered_at_before', params.triggered_at_before);
    }
    if (params.h3_resolution != null) {
      searchParams.append('h3_resolution', params.h3_resolution.toString());
    }
    if (params.include_targets) {
      searchParams.append('include_targets', '1');
    }
    if (params.target_strategy) {
      searchParams.append('target_strategy', params.target_strategy);
    }
    return this.get('/traceroutes/constellation-coverage/', searchParams);
  }

  /**
   * Get traceroute links for a specific node (from Neo4j)
   */
  async getNodeTracerouteLinks(
    nodeId: number,
    params?: { triggered_at_after?: string }
  ): Promise<{
    edges: Array<{
      from_node_id: number;
      to_node_id: number;
      from_lat: number;
      from_lng: number;
      to_lat: number;
      to_lng: number;
      avg_snr_in: number | null;
      avg_snr_out: number | null;
      count: number;
    }>;
    nodes: Array<{
      meshtastic_node_id: number;
      node_id_str?: string;
      lat: number;
      lng: number;
      short_name?: string;
      long_name?: string;
    }>;
    snr_history: Array<{
      peer_node_id: number;
      peer_short_name: string;
      inbound: Array<{ triggered_at: string; snr: number }>;
      outbound: Array<{ triggered_at: string; snr: number }>;
    }>;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.triggered_at_after) {
      searchParams.append('triggered_at_after', params.triggered_at_after);
    }
    return this.get(`/nodes/observed-nodes/${nodeId}/traceroute-links/`, searchParams);
  }

  // ===== Discord notification prefs (Mesh Monitoring phase 02) =====

  /** GET /api/auth/discord/notifications/ */
  async getDiscordNotificationPrefs(): Promise<DiscordNotificationPrefs> {
    return this.get<DiscordNotificationPrefs>('/auth/discord/notifications/');
  }

  /** PATCH /api/auth/discord/notifications/ — re-sync from SocialAccount */
  async patchDiscordNotificationPrefs(): Promise<DiscordNotificationPrefs> {
    return this.patch<DiscordNotificationPrefs>('/auth/discord/notifications/', {});
  }

  /** POST /api/auth/discord/notifications/test/ */
  async postDiscordNotificationTest(): Promise<{ detail: string }> {
    return this.post<{ detail: string }>('/auth/discord/notifications/test/', {});
  }

  /** GET /api/dx/notifications/settings/ */
  async getDxNotificationSettings(): Promise<DxNotificationSettings> {
    return this.get<DxNotificationSettings>('/dx/notifications/settings/');
  }

  /** PATCH /api/dx/notifications/settings/ */
  async patchDxNotificationSettings(body: DxNotificationSettingsWrite): Promise<DxNotificationSettings> {
    return this.patch<DxNotificationSettings>('/dx/notifications/settings/', body);
  }

  // ===== Mesh monitoring watches (Phase 04) =====

  async getNodeWatches(params?: PaginationParams): Promise<PaginatedResponse<NodeWatch>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    const response = await this.get<PaginatedResponse<NodeWatch>>('/monitoring/watches/', searchParams);
    return {
      ...response,
      results: response.results.map((w) => parseNodeWatchFromAPI(w)),
    };
  }

  async createNodeWatch(body: {
    observed_node_id: string;
    enabled?: boolean;
    offline_notifications_enabled?: boolean;
    battery_notifications_enabled?: boolean;
  }): Promise<NodeWatch> {
    const watch = await this.post<NodeWatch>('/monitoring/watches/', body);
    return parseNodeWatchFromAPI(watch);
  }

  async patchNodeWatch(
    id: number,
    body: {
      enabled?: boolean;
      offline_notifications_enabled?: boolean;
      battery_notifications_enabled?: boolean;
    }
  ): Promise<NodeWatch> {
    const watch = await this.patch<NodeWatch>(`/monitoring/watches/${id}/`, body);
    return parseNodeWatchFromAPI(watch);
  }

  async deleteNodeWatch(id: number): Promise<void> {
    await this.delete<unknown>(`/monitoring/watches/${id}/`);
  }

  async getNodeMonitoringConfig(observedNodeId: string): Promise<NodeMonitoringConfig> {
    return this.get<NodeMonitoringConfig>(`/monitoring/nodes/${observedNodeId}/config/`);
  }

  async patchNodeMonitoringConfig(
    observedNodeId: string,
    body: NodeMonitoringConfigPatch
  ): Promise<NodeMonitoringConfig> {
    return this.patch<NodeMonitoringConfig>(`/monitoring/nodes/${observedNodeId}/config/`, body);
  }

  async getMeshInfraMonitoringAlertsSummary(): Promise<{ mesh_infra: MeshInfraMonitoringAlertSummary }> {
    return this.get<{ mesh_infra: MeshInfraMonitoringAlertSummary }>('/monitoring/alerts/summary/?scope=mesh_infra');
  }

  // ===== DX monitoring (staff-only) =====

  async getDxEvents(params?: DxEventsQueryParams): Promise<PaginatedResponse<DxEventListItem>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    if (params?.state) searchParams.append('state', params.state);
    if (params?.reason_code) searchParams.append('reason_code', params.reason_code);
    if (params?.constellation != null) searchParams.append('constellation', String(params.constellation));
    if (params?.destination_node_id != null) {
      searchParams.append('destination_node_id', String(params.destination_node_id));
    }
    if (params?.last_observer_id) searchParams.append('last_observer_id', params.last_observer_id);
    if (params?.active_now) searchParams.append('active_now', 'true');
    if (params?.recent_only) searchParams.append('recent_only', 'true');
    if (params?.recent_days != null) searchParams.append('recent_days', String(params.recent_days));
    if (params?.last_observed_after) searchParams.append('last_observed_after', params.last_observed_after);
    if (params?.last_observed_before) searchParams.append('last_observed_before', params.last_observed_before);
    if (params?.first_observed_after) searchParams.append('first_observed_after', params.first_observed_after);
    if (params?.first_observed_before) searchParams.append('first_observed_before', params.first_observed_before);
    return this.get<PaginatedResponse<DxEventListItem>>('/dx/events/', searchParams);
  }

  async getDxEvent(id: string): Promise<DxEventDetail> {
    return this.get<DxEventDetail>(`/dx/events/${id}/`);
  }

  async postDxNodeExclusion(body: {
    meshtastic_node_id: number;
    exclude_from_detection: boolean;
    exclude_notes?: string;
  }): Promise<DxNodeExclusionResponse> {
    return this.post<DxNodeExclusionResponse>('/dx/nodes/exclusion/', body);
  }
}
