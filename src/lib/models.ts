import type { TracerouteTriggerType } from './traceroute-trigger-type';

export type { TracerouteTriggerType } from './traceroute-trigger-type';

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface NodeOwnerInfo {
  id: number;
  username: string;
}

/** Embedded claim info for the current user on an ObservedNode (from node detail response). Does not include claim_key (sensitive; use claims API). */
export interface ObservedNodeClaimEmbedded {
  created_at: string;
  accepted_at: string | null;
}

/** API slugs for ObservedNode.environment_exposure */
export type EnvironmentExposureSlug = 'unknown' | 'indoor' | 'outdoor' | 'sheltered';

/** API slugs for ObservedNode.weather_use */
export type WeatherUseSlug = 'unknown' | 'include' | 'exclude';

/** API protocol discriminator: 1 = Meshtastic, 2 = MeshCore */
export type MeshProtocol = 1 | 2;

export type AntennaPattern = 'omni' | 'directional';

/** RF propagation profile from GET/PATCH `/nodes/observed-nodes/{id}/rf-profile/` (snake_case from API). */
export interface RfProfile {
  antenna_height_m?: number | null;
  antenna_gain_dbi?: number | null;
  tx_power_dbm?: number | null;
  rf_frequency_mhz?: number | null;
  antenna_pattern?: AntennaPattern;
  antenna_azimuth_deg?: number | null;
  antenna_beamwidth_deg?: number | null;
  /** Present only for claim owner or staff. */
  rf_latitude?: number | null;
  rf_longitude?: number | null;
  rf_altitude_m?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type RfProfileUpdateBody = Partial<
  Pick<
    RfProfile,
    | 'antenna_height_m'
    | 'antenna_gain_dbi'
    | 'tx_power_dbm'
    | 'rf_frequency_mhz'
    | 'antenna_pattern'
    | 'antenna_azimuth_deg'
    | 'antenna_beamwidth_deg'
    | 'rf_latitude'
    | 'rf_longitude'
    | 'rf_altitude_m'
  >
>;

export type RfPropagationRenderStatus = 'none' | 'pending' | 'running' | 'ready' | 'failed';

export interface RfPropagationRenderRow {
  status: Exclude<RfPropagationRenderStatus, 'none'>;
  input_hash?: string | null;
  asset_url?: string | null;
  bounds?: { west: number; south: number; east: number; north: number } | null;
  error_message?: string;
  created_at: string;
  completed_at?: string | null;
}

export type RfPropagationPollResult = RfPropagationRenderRow | { status: 'none' };

export function isRfPropagationNone(r: RfPropagationPollResult): r is { status: 'none' } {
  return r.status === 'none';
}

/**
 * Observed node from Meshflow API (Meshtastic and MeshCore in one list resource).
 * Use `protocol` on list queries to filter; detail by numeric `meshtastic_node_id` is Meshtastic-only today.
 */
export interface ObservedNode {
  /** Stable UUID primary key (API returns string; parsed in api-utils). */
  internal_id: string;
  protocol?: MeshProtocol;
  /** Meshtastic numeric node id; null/absent for MeshCore (use node_id_str / mc_pubkey*). */
  meshtastic_node_id: number;
  /** Canonical display id: `!hex8` (Meshtastic) or `mc:prefix12` (MeshCore). */
  node_id_str: string;
  mc_pubkey?: string | null;
  mc_pubkey_prefix?: string | null;
  /** Meshtastic nodeinfo MAC; usually null for MeshCore. */
  mac_addr: string | null;
  long_name: string | null;
  short_name: string | null;
  meshtastic_hw_model: string | null;
  /** Meshtastic device public key (PKI); null for MeshCore. */
  meshtastic_public_key: string | null;
  /** Meshtastic RoleSource enum integer; null for MeshCore. */
  meshtastic_role?: number | null;
  /** MeshCore ADVERT adv_type (1=chat, 2=repeater, 3=room, 4=sensor); null when unknown. */
  meshcore_adv_type?: number | null;
  meshtastic_is_licensed?: boolean | null;
  meshtastic_is_unmessagable?: boolean | null;
  /** Meshtastic-only: inferred max hops from hop_start; null for MeshCore. */
  meshtastic_inferred_max_hops?: number | null;
  environment_exposure?: EnvironmentExposureSlug;
  weather_use?: WeatherUseSlug;
  /** True when the current user may PATCH environment-settings (staff or claim owner). */
  environment_settings_editable?: boolean;
  /** True when the current user may PATCH rf-profile (staff or claim owner). */
  rf_profile_editable?: boolean;
  has_rf_profile?: boolean;
  has_ready_rf_render?: boolean;
  /** True when battery alerting is enabled and a low-battery episode is confirmed (mesh monitoring). */
  battery_alert_active?: boolean;
  battery_alert_confirmed_at?: Date | string | null;
  last_heard?: Date | null;
  /** Meshtastic protobuf-shaped telemetry; typically null for MeshCore nodes. */
  latest_device_metrics?: DeviceMetrics | null;
  /** Meshtastic environment telemetry from NodeLatestStatus. */
  latest_environment_metrics?: LatestEnvironmentMetrics | null;
  /** Meshtastic power telemetry from NodeLatestStatus. */
  latest_power_metrics?: LatestPowerMetrics | null;
  /** Meshtastic position snapshot from NodeLatestStatus. */
  latest_position?: Position | null;
  owner?: NodeOwnerInfo | null;
  /** Current user's claim for this node, if any. Present when authenticated. */
  claim?: ObservedNodeClaimEmbedded | null;
}

/** Present when API is called with include=geo_classification */
export interface GeoClassification {
  tier: 'perimeter' | 'internal';
  bearing_octant: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | null;
  applicable_strategies: ('intra_zone' | 'dx_across' | 'dx_same_side')[];
  /** Circular envelope (centroid + p90 radius); null when fewer than three positioned managed nodes. */
  envelope?: { centroid_lat: number; centroid_lon: number; radius_km: number } | null;
  /** Centroid used for bearings and wedges (matches envelope centroid when defined, else constellation mean). */
  selection_centroid?: { lat: number; lon: number } | null;
  /** Bearing from selection centroid toward the feeder, degrees 0–360; null when feeder position unknown. */
  source_bearing_deg?: number | null;
  selector_params?: {
    last_heard_within_hours: number;
    dx_half_window_sweep_deg: number[];
    perimeter_distance_fraction: number;
  };
}

export interface MeshCorePathObservedNodeMinimal {
  internal_id: string;
  node_id_str: string | null;
  long_name: string | null;
}

export interface MeshCorePathEdgeBucket {
  id: string;
  bucket_start: string;
  bucket_size: string;
  from_kind: string;
  to_kind: string;
  from_hash: string;
  to_hash: string;
  observer: string | null;
  observer_name: string | null;
  constellation: number | null;
  constellation_name: string | null;
  packet_count: number;
  observation_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  avg_snr: number | null;
  min_snr: number | null;
  max_snr: number | null;
  direction: string;
  resolved: boolean;
}

export interface MeshCorePathSegment {
  id: string;
  segment_hash: string;
  hash_size: number | null;
  hash_mode: number | null;
  status: string;
  source: string;
  resolver_version: number;
  confidence: number | null;
  observed_node: MeshCorePathObservedNodeMinimal | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface MeshCorePathSegmentAnnotateBody {
  observed_node_id?: string | null;
  node_id_str?: string | null;
  status?: string;
}

export interface MeshCorePacketListItem {
  id: string;
  payload_type: number;
  event_type: string;
  from_pubkey: string | null;
  from_pubkey_prefix: string | null;
  pkt_hash: number | null;
  rx_time: string;
  rx_rssi: number | null;
  rx_snr: number | null;
  route_typename: string | null;
  first_reported_time: string;
  observer_name: string;
  text: string | null;
}

// ManagedNode from Meshflow API v2
export interface ManagedNode {
  protocol?: MeshProtocol;
  /** Meshtastic numeric id; null for MeshCore feeders. */
  meshtastic_node_id: number | null;
  mc_pubkey?: string | null;
  internal_id?: string;
  long_name: string | null;
  short_name: string | null;
  last_heard: Date | null;
  radio_last_heard?: Date | null;
  last_packet_ingested_at?: Date | null;
  packets_last_hour?: number;
  packets_last_24h?: number;
  is_eligible_traceroute_source?: boolean;
  geo_classification?: GeoClassification | null;
  node_id_str: string;
  owner: {
    id: number;
    username: string;
  };
  constellation: {
    id: number;
    name?: string;
    map_color?: string;
    bot_default_ignore_meshtastic_portnums?: string | null;
    bot_default_meshtastic_hop_limit?: number | null;
  };
  allow_auto_traceroute?: boolean;
  /** Last meshflow-bot version reported on connect (null if never reported). */
  bot_version?: string | null;
  bot_version_reported_at?: Date | string | null;
  /** MeshCore: hours between flood-routed adverts sent by the bot (API default 6). */
  mc_flood_advert_interval_hours?: number;
  position: {
    latitude: number | null;
    longitude: number | null;
    meshtastic_precision_bits?: number | null;
  };
}

/** MeshCore channel row mirrored from device (GET managed-nodes/mine). */
export interface McChannelSnapshot {
  id: number;
  name: string;
  mc_channel_idx: number;
  mc_channel_type: 'PUBLIC' | 'HASHTAG';
  mc_hashtag: string | null;
}

export interface McChannelApplyEntry {
  mc_channel_idx: number;
  name: string;
  mc_channel_type: 'PUBLIC' | 'HASHTAG';
  mc_hashtag?: string | null;
}

// OwnedManagedNode extends ManagedNode with channel mappings
export interface OwnedManagedNode extends ManagedNode {
  internal_id?: string;
  mc_channels?: McChannelSnapshot[];
  mc_channels_synced_at?: string | null;
  meshtastic_channel_0?: { id: number; name?: string } | null;
  meshtastic_channel_1?: { id: number; name?: string } | null;
  meshtastic_channel_2?: { id: number; name?: string } | null;
  meshtastic_channel_3?: { id: number; name?: string } | null;
  meshtastic_channel_4?: { id: number; name?: string } | null;
  meshtastic_channel_5?: { id: number; name?: string } | null;
  meshtastic_channel_6?: { id: number; name?: string } | null;
  meshtastic_channel_7?: { id: number; name?: string } | null;
  default_location_latitude?: number | null;
  default_location_longitude?: number | null;
}

export interface LinkedManagedNodeRef {
  internal_id: string;
  node_id_str: string;
  protocol: MeshProtocol;
  meshtastic_node_id: number | null;
}

export interface CreateMeshtasticManagedNode {
  protocol?: 1;
  meshtastic_node_id: number;
  constellation_id: number;
  name: string;
  owner_id: number | null;
  default_location_latitude: number | null;
  default_location_longitude: number | null;
  meshtastic_channel_0: number | null;
  meshtastic_channel_1: number | null;
  meshtastic_channel_2: number | null;
  meshtastic_channel_3: number | null;
  meshtastic_channel_4: number | null;
  meshtastic_channel_5: number | null;
  meshtastic_channel_6: number | null;
  meshtastic_channel_7: number | null;
}

export interface CreateMeshCoreManagedNode {
  protocol: 2;
  mc_pubkey: string;
  constellation_id: number;
  name: string;
  owner_id: number | null;
  default_location_latitude: number | null;
  default_location_longitude: number | null;
}

/** @deprecated Use CreateMeshtasticManagedNode or CreateMeshCoreManagedNode */
export type CreateManagedNode = CreateMeshtasticManagedNode;

/** Enriched route node with position for map display (from API route_nodes/route_back_nodes) */
export interface TracerouteRouteNode {
  meshtastic_node_id: number;
  node_id_str: string;
  short_name: string | null;
  position: { latitude: number; longitude: number } | null;
  snr?: number | null;
}

// Traceroute interfaces
export interface AutoTraceRoute {
  id: number;
  source_node: ManagedNode;
  target_node: ObservedNode;
  trigger_type: TracerouteTriggerType;
  trigger_type_label?: string | null;
  /** Hypothesis-driven selector; null means legacy / unspecified */
  target_strategy?: 'intra_zone' | 'dx_across' | 'dx_same_side' | 'legacy' | 'manual' | null;
  triggered_by: number | null;
  triggered_by_username: string | null;
  trigger_source: string | null;
  triggered_at: string;
  /** Queue: earliest time the dispatcher may send to the source (ISO 8601). */
  earliest_send_at?: string | null;
  /** When the command was delivered to the source via the channel layer. */
  dispatched_at?: string | null;
  /** Failed channel-delivery attempts while still pending. */
  dispatch_attempts?: number;
  /** Last dispatch/channel error while pending, if any. */
  dispatch_error?: string | null;
  status: 'pending' | 'sent' | 'completed' | 'failed';
  route: Array<{ meshtastic_node_id: number; snr: number | null }> | null;
  route_back: Array<{ meshtastic_node_id: number; snr: number | null }> | null;
  route_nodes?: TracerouteRouteNode[];
  route_back_nodes?: TracerouteRouteNode[];
  raw_packet: string | null;
  completed_at: string | null;
  error_message: string | null;
}

// Message interfaces (API v2)
export interface TextMessageSender {
  node_id_str: string;
  long_name: string | null;
  short_name: string | null;
}

/** MC channel sender inferred from ``{name}: {body}`` prefix (see API docs). */
export interface McSenderCandidate {
  internal_id: string;
  node_id_str: string;
  long_name: string | null;
  short_name: string | null;
  position: MapPosition | null;
}

export interface MapPosition {
  latitude: number;
  longitude: number;
}

export interface PacketObservationObserver {
  meshtastic_node_id: number;
  node_id_str: string;
  long_name: string | null;
  short_name: string | null;
}

export interface PacketObservation {
  observer: PacketObservationObserver;
  observer_position?: MapPosition | null;
  rx_time: string; // ISO date string
  rx_rssi: number | null;
  rx_snr: number | null;
  direct_from_sender: boolean;
  hop_count: number | null;
  path_known?: boolean;
}

export interface ResolvedHop {
  hash: string;
  status: 'unknown' | 'ambiguous' | 'resolved';
  node_id_str: string | null;
  internal_id: string | null;
  long_name: string | null;
  ambiguous: boolean;
}

export interface HeardObserver {
  node_id_str: string;
  internal_id: string | null;
  long_name: string | null;
  short_name: string | null;
  position: MapPosition | null;
}

/** MeshCore heard row from text message API. */
export interface MeshCoreHeardObservation {
  observer: HeardObserver;
  rx_time: string;
  rx_rssi: number | null;
  rx_snr: number | null;
  path_hashes?: string[] | null;
  resolved_path?: ResolvedHop[];
  path_known: boolean;
}

export interface TextMessage {
  id: string; // UUID
  packet_id: number | string;
  protocol?: MeshProtocol | 'meshtastic' | 'meshcore' | string;
  sender: TextMessageSender | null;
  sender_position?: MapPosition | null;
  mc_sender_label?: string | null;
  mc_sender_candidates?: McSenderCandidate[];
  recipient_meshtastic_node_id: number | null;
  channel: number;
  sent_at: string; // ISO date string
  message_text: string;
  is_emoji: boolean;
  reply_to_meshtastic_packet_id: number | null;
  heard: PacketObservation[] | MeshCoreHeardObservation[];
}

export interface TextMessageResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: TextMessage[];
}

/** Meshtastic device telemetry (nested under ObservedNode.latest_device_metrics). */
export interface DeviceMetrics {
  reported_time: Date | null;
  logged_time: Date | null;
  battery_level: number;
  voltage: number;
  meshtastic_channel_utilization: number; // Changed from chUtil
  meshtastic_air_util_tx: number; // Changed from airUtil
  uptime_seconds: number; // Changed from uptime
}

/** Latest environment metrics from node (NodeLatestStatus) */
export interface LatestEnvironmentMetrics {
  temperature?: number | null;
  relative_humidity?: number | null;
  barometric_pressure?: number | null;
  gas_resistance?: number | null;
  iaq?: number | null;
  lux?: number | null;
  wind_direction?: number | null;
  wind_speed?: number | null;
  radiation?: number | null;
  rainfall_1h?: number | null;
  rainfall_24h?: number | null;
  reported_time?: Date | string | null;
}

/** Latest power metrics from node (NodeLatestStatus) */
export interface LatestPowerMetrics {
  ch1_voltage?: number | null;
  ch1_current?: number | null;
  ch2_voltage?: number | null;
  ch2_current?: number | null;
  ch3_voltage?: number | null;
  ch3_current?: number | null;
  ch4_voltage?: number | null;
  ch4_current?: number | null;
  ch5_voltage?: number | null;
  ch5_current?: number | null;
  ch6_voltage?: number | null;
  ch6_current?: number | null;
  ch7_voltage?: number | null;
  ch7_current?: number | null;
  ch8_voltage?: number | null;
  ch8_current?: number | null;
  reported_time?: Date | string | null;
}

/** Environment metrics record (history endpoint) */
export interface EnvironmentMetrics {
  id: number;
  node: number;
  logged_time: Date | string | null;
  reported_time: Date | string | null;
  temperature?: number | null;
  relative_humidity?: number | null;
  barometric_pressure?: number | null;
  gas_resistance?: number | null;
  iaq?: number | null;
  lux?: number | null;
  wind_direction?: number | null;
  wind_speed?: number | null;
  radiation?: number | null;
  rainfall_1h?: number | null;
  rainfall_24h?: number | null;
}

/** Power metrics record (history endpoint) */
export interface PowerMetrics {
  id: number;
  node: number;
  logged_time: Date | string | null;
  reported_time: Date | string | null;
  ch1_voltage?: number | null;
  ch1_current?: number | null;
  ch2_voltage?: number | null;
  ch2_current?: number | null;
  ch3_voltage?: number | null;
  ch3_current?: number | null;
  ch4_voltage?: number | null;
  ch4_current?: number | null;
  ch5_voltage?: number | null;
  ch5_current?: number | null;
  ch6_voltage?: number | null;
  ch6_current?: number | null;
  ch7_voltage?: number | null;
  ch7_current?: number | null;
  ch8_voltage?: number | null;
  ch8_current?: number | null;
}

export interface Position {
  reported_time: Date | null;
  logged_time: Date | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  meshtastic_location_source: string;
  /** Meshtastic meshtastic_precision_bits – lower = larger uncertainty. 16≈365m, 17≈182m, 18≈91m, etc. */
  meshtastic_precision_bits?: number | null;
}

// API response types
export interface NodeSearchResult {
  internal_id: number;
  meshtastic_node_id: number;
  node_id_str: string;
  short_name: string | null;
  long_name: string | null;
  /** ISO string from API when present; used for recency filters in search UI. */
  last_heard?: string | null;
  owner?: NodeOwnerInfo | null;
}

// Global Stats types from Meshflow API v2
export interface GlobalStatsInterval {
  start_date: string;
  end_date: string;
  packets: number;
}

export interface PacketStatsInterval {
  start_date: string;
  end_date: string;
  /** Omitted on some MeshCore stats responses. */
  packet_types?: Array<{
    packet_type: string;
    count: number;
  }>;
}

export interface GlobalStats {
  start_date: string;
  end_date: string;
  intervals: GlobalStatsInterval[];
  summary: {
    total_packets: number;
    time_range: {
      start: string;
      end: string;
    };
  };
}

export interface PacketStats {
  start_date: string;
  end_date: string;
  intervals: PacketStatsInterval[];
}

export interface NeighbourStatsCandidate {
  meshtastic_node_id: number;
  node_id_str: string;
  short_name: string | null;
}

export interface NeighbourStatsBySource {
  source: number;
  source_type: 'lsb' | 'full';
  count: number;
  candidates: NeighbourStatsCandidate[];
}

export interface NeighbourStats {
  start_date: string | null;
  end_date: string | null;
  by_source: NeighbourStatsBySource[];
  total_packets: number;
}

export interface StatsSnapshot {
  id: number;
  recorded_at: string;
  stat_type: 'online_nodes' | 'new_nodes' | 'packet_volume' | 'mc_online_nodes' | 'mc_new_nodes' | 'mc_packet_volume';
  constellation_id: number | null;
  value: {
    count: number;
    window_hours?: number;
    by_type?: Record<string, number>;
  };
}

export interface MessageChannel {
  id: number;
  name: string;
  constellation: number;
  protocol?: MeshProtocol | 'meshtastic' | 'meshcore' | string;
  /** Operator-facing label from API (#hashtag or public name). */
  display_label?: string | null;
  mc_channel_type?: string | number | null;
  mc_hashtag?: string | null;
}

export interface Constellation {
  id: number;
  name: string;
  description: string;
  created_by: number;
  /** Constellation-level protocol (1 = Meshtastic, 2 = MeshCore). */
  protocol?: MeshProtocol | 'meshtastic' | 'meshcore' | string;
  channels: MessageChannel[];
  map_color: string;
  bot_default_ignore_meshtastic_portnums?: string | null;
  bot_default_meshtastic_hop_limit?: number | null;
}

export interface NodeClaim {
  node: {
    internal_id: string;
    meshtastic_node_id: number;
    node_id_str: string;
    long_name: string;
    short_name: string;
    last_heard: string | null;
  };
  user: number;
  claim_key: string;
  created_at: string;
  accepted_at: string | null;
}

/** Constellation object returned in API key list/detail (includes bot setup defaults) */
export interface NodeApiKeyConstellation {
  id: number;
  name: string;
  map_color: string;
  bot_default_ignore_meshtastic_portnums?: string | null;
  bot_default_meshtastic_hop_limit?: number | null;
}

export interface NodeApiKey {
  id: string;
  key: string;
  name: string;
  /** Constellation ID (create response) or object (list/detail response) */
  constellation: number | NodeApiKeyConstellation;
  created_at: string;
  owner: number;
  last_used: string | null;
  is_active: boolean;
  /** Legacy Meshtastic numeric ids only (omits MeshCore feeders). */
  nodes: number[];
  linked_managed_nodes?: LinkedManagedNodeRef[];
}

export interface CreateNodeApiKey {
  name: string;
  constellation: number;
}

/** GET/PATCH `/api/auth/discord/notifications/` (Mesh Monitoring phase 02) */
export interface DiscordNotificationPrefs {
  discord_linked: boolean;
  discord_notify_verified: boolean;
}

/** GET/PATCH `/api/dx/notifications/settings/` (DX Discord DM preferences). */
export type DxNotificationCategoryValue =
  | 'new_distant_node'
  | 'returned_dx_node'
  | 'distant_observation'
  | 'traceroute_distant_hop'
  | 'confirmed_event'
  | 'event_closed_summary';

export type DxDiscordReadinessStatus = 'verified' | 'not_linked' | 'needs_relink';

export interface DxDiscordReadiness {
  status: DxDiscordReadinessStatus;
  can_receive_dms: boolean;
}

export interface DxNotificationSettings {
  enabled: boolean;
  all_categories: boolean;
  categories: DxNotificationCategoryValue[];
  discord: DxDiscordReadiness;
}

export interface DxNotificationSettingsWrite {
  enabled?: boolean;
  all_categories?: boolean;
  categories?: DxNotificationCategoryValue[];
}

/** Error body when enabling DX DMs without verified Discord (`HTTP 400`). */
export interface DxNotificationSettingsErrorResponse {
  code: 'NEEDS_DISCORD_VERIFICATION';
  detail: string;
}

export const DX_NOTIFICATION_CATEGORY_ORDER: readonly DxNotificationCategoryValue[] = [
  'new_distant_node',
  'returned_dx_node',
  'distant_observation',
  'traceroute_distant_hop',
  'confirmed_event',
  'event_closed_summary',
] as const;

export const DX_NOTIFICATION_CATEGORY_META: Record<
  DxNotificationCategoryValue,
  { label: string; description: string }
> = {
  new_distant_node: {
    label: 'New distant node',
    description: 'A node is first seen as distant from its constellation footprint.',
  },
  returned_dx_node: {
    label: 'Returned DX node',
    description: 'A distant node reappears after a quiet period.',
  },
  distant_observation: {
    label: 'Distant observation',
    description: 'Direct or near-direct mesh observation across distance.',
  },
  traceroute_distant_hop: {
    label: 'Traceroute distant hop',
    description: 'Traceroute evidence shows a distant hop toward the destination.',
  },
  confirmed_event: {
    label: 'Event confirmed',
    description: 'A DX event reaches the evidence threshold.',
  },
  event_closed_summary: {
    label: 'Event closed',
    description: 'Summary when a DX event is closed.',
  },
};

/**
 * Observed node embedded on NodeWatch responses: same shape as ObservedNode (list/detail API)
 * plus mesh monitoring hints (`GET /api/monitoring/watches/`).
 */
export type ObservedNodeWatchSummary = ObservedNode & {
  /** Node-level silence threshold (seconds); alias for `last_heard_offline_after_seconds` on config. */
  offline_after?: number;
  monitoring_verification_started_at?: string | null;
  monitoring_offline_confirmed_at?: string | null;
};

/** GET/PATCH `/api/monitoring/nodes/{internal_id}/config/` */
export interface NodeMonitoringConfig {
  last_heard_offline_after_seconds: number;
  battery_alert_enabled: boolean;
  battery_alert_threshold_percent: number;
  battery_alert_report_count: number;
  editable: boolean;
  battery_alert_active: boolean;
  battery_alert_confirmed_at: string | null;
}

export type NodeMonitoringConfigPatch = Partial<
  Pick<
    NodeMonitoringConfig,
    | 'last_heard_offline_after_seconds'
    | 'battery_alert_enabled'
    | 'battery_alert_threshold_percent'
    | 'battery_alert_report_count'
  >
>;

/** GET `/api/monitoring/alerts/summary/?scope=mesh_infra` */
export interface MeshInfraMonitoringAlertSummary {
  alerting_nodes_count: number;
  offline_count: number;
  battery_count: number;
  verifying_count: number;
}

/** User watch on an observed node (`GET/POST /monitoring/watches/`). */
export interface NodeWatch {
  id: number;
  observed_node: ObservedNodeWatchSummary;
  offline_after: number;
  enabled: boolean;
  offline_notifications_enabled: boolean;
  battery_notifications_enabled: boolean;
  created_at: string;
}

/** DX monitoring (meshflow-api `/api/dx/`, staff-only). */
export type DxReasonCode = 'new_distant_node' | 'returned_dx_node' | 'distant_observation' | 'traceroute_distant_hop';
export type DxEventState = 'active' | 'closed';

export interface DxNodeMetadataPublic {
  exclude_from_detection: boolean;
  exclude_notes: string;
  updated_at: string | null;
}

export interface DxDestinationNode {
  internal_id: string;
  meshtastic_node_id: number;
  node_id_str: string;
  short_name: string;
  long_name: string;
  dx_metadata: DxNodeMetadataPublic;
}

export interface DxManagedNodeMinimal {
  internal_id: string;
  meshtastic_node_id: number;
  node_id_str: string;
  name: string;
}

export interface DxConstellationMinimal {
  id: number;
  name: string;
}

export type DxExplorationOutcome = 'pending' | 'completed' | 'failed' | 'skipped';

export type DxExplorationSkipReason =
  | ''
  | 'no_eligible_source'
  | 'source_queue_full'
  | 'event_cooldown'
  | 'target_cooldown'
  | 'source_cooldown'
  | 'baseline_in_flight'
  | 'baseline_recent_success'
  | 'baseline_failure_cooldown'
  | 'duplicate_dx_watch'
  | 'destination_excluded'
  | 'fanout_saturated'
  | string;

export interface DxObservedNodeHop {
  internal_id: string;
  meshtastic_node_id: number;
  node_id_str: string;
  short_name: string;
  long_name: string;
}

export interface DxAutoTracerouteExplorationRow {
  id: number;
  status: 'pending' | 'sent' | 'completed' | 'failed';
  trigger_type: number;
  trigger_type_label: string;
  trigger_source: string | null;
  triggered_at: string;
  earliest_send_at: string;
  dispatched_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export interface DxEventTracerouteExplorationRow {
  id: string;
  outcome: DxExplorationOutcome;
  skip_reason: DxExplorationSkipReason;
  metadata: Record<string, unknown>;
  link_kind: string;
  created_at: string;
  updated_at: string;
  source_node: DxManagedNodeMinimal | null;
  destination: DxObservedNodeHop;
  auto_traceroute: DxAutoTracerouteExplorationRow | null;
}

export interface DxExplorationSummary {
  total: number;
  pending: number;
  completed: number;
  failed: number;
  skipped: number;
  baseline_linked_rows: number;
}

export interface DxEventListItem {
  id: string;
  constellation: DxConstellationMinimal;
  destination: DxDestinationNode;
  reason_code: DxReasonCode;
  state: DxEventState;
  first_observed_at: string;
  last_observed_at: string;
  active_until: string;
  observation_count: number;
  last_observer: DxManagedNodeMinimal | null;
  best_distance_km: number | null;
  last_distance_km: number | null;
  metadata: Record<string, unknown>;
  evidence_count: number;
  exploration_attempt_count: number;
}

export interface DxEventObservationRow {
  id: string;
  observed_at: string;
  distance_km: number | null;
  metadata: Record<string, unknown>;
  observer: DxManagedNodeMinimal;
  raw_packet: string;
  packet_observation: number;
}

export interface DxEventDetail extends DxEventListItem {
  observations: DxEventObservationRow[];
  traceroute_explorations: DxEventTracerouteExplorationRow[];
  exploration_summary: DxExplorationSummary;
}

export interface DxNodeExclusionResponse {
  meshtastic_node_id: number;
  node_id_str: string;
  exclude_from_detection: boolean;
  exclude_notes: string;
  updated_at: string | null;
}
