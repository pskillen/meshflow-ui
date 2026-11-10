import { Link } from 'react-router-dom';
import { useNodeSuspense, useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { useNodeTracerouteLinks } from '@/hooks/api/useNodeTracerouteLinks';
import { useRecentNodes } from '@/hooks/useRecentNodes';
import { formatUptimeSeconds } from '@/lib/utils';
import { NodeStatsSection } from '@/components/nodes/NodeStatsSection';
import { NodesMap } from '@/components/nodes/NodesMap';
import { NodeTracerouteLinksMap } from '@/components/nodes/NodeTracerouteLinksMap';
import { LinkSNRCharts } from '@/components/nodes/LinkSNRCharts';
import { BatteryGauge } from '@/components/nodes/BatteryGauge';
import { MetricsCard } from '@/components/nodes/MetricsCard';
import { PercentGauge } from '@/components/nodes/PercentGauge';
import { FirmwareBadge } from '@/components/nodes/FirmwareBadge';
import { hasFirmwareBadge } from '@/lib/firmware';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Copy, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { authService } from '@/lib/auth/authService';
import { getRoleLabel, INFRASTRUCTURE_ROLE_IDS } from '@/lib/meshtastic';
import type { EnvironmentExposureSlug, LatestEnvironmentMetrics, ObservedNode, WeatherUseSlug } from '@/lib/models';
import { NodeEnvironmentSettingsDialog } from '@/components/nodes/NodeEnvironmentSettingsDialog';
import { NodeMeshMonitoringSection } from '@/components/nodes/NodeMeshMonitoringSection';
import { NodeTracerouteHistorySection } from '@/components/nodes/NodeTracerouteHistorySection';
import { NodeOutgoingTraceroutesSection } from '@/components/nodes/NodeOutgoingTraceroutesSection';
import { RfPropagationSection } from '@/components/nodes/RfPropagationSection';
import { NodeShell, type NodeShellTab } from '@/components/nodes/NodeShell';
import { STATS_PRESET_KEYS } from '@/lib/stats-range';
import { useStatsRange, type StatsRange } from '@/hooks/useStatsRange';
import { isRangedNodeDetailTab, type NodeDetailTab } from '@/lib/node-detail-tab';
import {
  isMeshCoreObservedNode,
  observedNodeMapRoleLegend,
  supportsMeshtasticTraceroutes,
} from '@/lib/observed-node-capabilities';
import { observedNodeDetailPath } from '@/lib/node-detail-routes';

interface NodeDetailContentProps {
  internalId: string;
  /** When true, hide the "Back to Nodes" link (e.g. when shown in slide-over) */
  compact?: boolean;
  /** Full page only — from `NodeDetails` reading `?tab=` */
  activeTab?: NodeDetailTab;
  onTabChange?: (tab: NodeDetailTab) => void;
}

/** True when the node has at least one environment *sensor* reading (not placement/weather alone). */
function hasEnvironmentSensorMetrics(env: LatestEnvironmentMetrics | null | undefined): boolean {
  if (!env) return false;
  const keys: (keyof LatestEnvironmentMetrics)[] = [
    'temperature',
    'relative_humidity',
    'barometric_pressure',
    'gas_resistance',
    'iaq',
    'lux',
    'wind_direction',
    'wind_speed',
    'radiation',
    'rainfall_1h',
    'rainfall_24h',
  ];
  return keys.some((k) => {
    const v = env[k];
    return v != null;
  });
}

function NodeLocationCard({
  node,
  internalId,
  compact,
  mapTabLink,
}: {
  node: ObservedNode;
  internalId: string;
  compact: boolean;
  mapTabLink?: boolean;
}) {
  const pos = node.latest_position;
  const hasPositions =
    pos &&
    typeof pos.latitude === 'number' &&
    pos.latitude !== 0 &&
    typeof pos.longitude === 'number' &&
    pos.longitude !== 0;

  return (
    <Card data-testid="node-detail-location-card">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle>Node Location</CardTitle>
            {hasPositions ? (
              <CardDescription>
                GPS position broadcast by the node — last reported <StaleReportedTime at={pos?.reported_time} />
              </CardDescription>
            ) : (
              <CardDescription>
                No GPS position data. A node can be active (Last Heard) without broadcasting its location.
              </CardDescription>
            )}
          </div>
          {mapTabLink && (
            <Link
              to={`/nodes/${internalId}?tab=map`}
              className="shrink-0 text-sm text-teal-600 underline-offset-4 hover:underline dark:text-teal-400"
              data-testid="node-detail-map-tab-link"
            >
              Open map view
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {hasPositions && pos ? (
          <>
            <div className="mb-2 flex flex-wrap items-end gap-4 md:flex-nowrap">
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lat</span>
                <span className="font-mono text-base">{pos.latitude!.toFixed(6)}°</span>
              </div>
              <span className="mx-2 hidden h-6 border-l border-slate-200 dark:border-slate-700 md:inline-block"></span>
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Long</span>
                <span className="font-mono text-base">{pos.longitude!.toFixed(6)}°</span>
              </div>
              <span className="mx-2 hidden h-6 border-l border-slate-200 dark:border-slate-700 md:inline-block"></span>
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alt</span>
                <span className="font-mono text-base">
                  {pos.altitude != null ? `${pos.altitude.toFixed(1)}m` : '—'}
                </span>
              </div>
              {pos.meshtastic_location_source && (
                <span className="ml-4 rounded border border-slate-200 bg-muted px-2 py-0.5 text-xs text-muted-foreground dark:border-slate-700">
                  {pos.meshtastic_location_source}
                </span>
              )}
            </div>
            <div className={`w-full ${compact ? 'h-[200px]' : 'h-[400px]'}`}>
              <NodesMap nodes={[node]} roleLegend={observedNodeMapRoleLegend(node)} />
            </div>
          </>
        ) : (
          <div className="flex h-[200px] w-full items-center justify-center rounded-md bg-muted">
            <p className="text-muted-foreground">No location data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TracerouteLinksSection({
  internalId,
  meshtasticNodeId,
  isManagedNode,
  range,
}: {
  internalId: string;
  meshtasticNodeId: number;
  isManagedNode: boolean;
  /** The page's shared range; the bar lives in the node header. */
  range: StatsRange;
}) {
  const triggeredAtAfter = range.window.start;

  const { data, isLoading, error } = useNodeTracerouteLinks(internalId, { triggeredAtAfter });

  const hasData = data && (data.edges.length > 0 || data.nodes.length > 0);

  return (
    <div className="mb-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Traceroute Links</CardTitle>
            <CardDescription>
              Mesh links from traceroutes over the {range.longLabel}. Arcs colored by average SNR (green = good, red =
              poor).
            </CardDescription>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {isManagedNode && (
              <Link
                to={`/traceroutes/map/coverage?feeder=${meshtasticNodeId}`}
                className="text-sm text-teal-600 underline-offset-4 hover:underline dark:text-teal-400"
                data-testid="node-coverage-map-link"
              >
                Coverage map
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex min-h-[200px] items-center justify-center text-sm text-destructive">
              Failed to load traceroute links: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          )}
          {isLoading && (
            <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-teal-500" />
            </div>
          )}
          {!error && !isLoading && !hasData && (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
              <p>No traceroute data for this node</p>
              <Link to="/traceroutes/map/heat" className="text-sm text-teal-600 hover:underline dark:text-teal-400">
                View Traceroute Heatmap
              </Link>
            </div>
          )}
          {!error && !isLoading && hasData && data && (
            <>
              <div className="mb-4 h-[300px] w-full">
                <NodeTracerouteLinksMap
                  edges={data.edges}
                  nodes={data.nodes}
                  focusNodeId={meshtasticNodeId ?? 0}
                  showLabels={true}
                />
              </div>
              {data.snr_history.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-medium">SNR over time by link</h4>
                  <LinkSNRCharts
                    snrHistory={data.snr_history}
                    initialVisible={3}
                    timeRangeStart={triggeredAtAfter}
                    timeRangeEnd={range.window.end}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MeshCoreTraceroutesPlaceholder() {
  return (
    <Card className="mb-6" data-testid="meshcore-traceroutes-unsupported">
      <CardHeader>
        <CardTitle>Traceroutes</CardTitle>
        <CardDescription>Traceroutes for MeshCore nodes are not available yet.</CardDescription>
      </CardHeader>
    </Card>
  );
}

function NodeTraceroutesPanel({
  internalId,
  meshtasticNodeId,
  isManagedNode,
  managedForThisNode,
  node,
  range,
}: {
  internalId: string;
  meshtasticNodeId: number;
  isManagedNode: boolean;
  managedForThisNode: ReturnType<typeof useManagedNodesSuspense>['managedNodes'][number] | undefined;
  node: ObservedNode;
  range: StatsRange;
}) {
  if (!supportsMeshtasticTraceroutes(node)) {
    return <MeshCoreTraceroutesPlaceholder />;
  }
  return (
    <>
      <TracerouteLinksSection
        internalId={internalId}
        meshtasticNodeId={meshtasticNodeId}
        isManagedNode={isManagedNode}
        range={range}
      />
      <Suspense
        fallback={
          <div className="mb-6 flex min-h-[120px] items-center justify-center text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-teal-500" />
          </div>
        }
      >
        {isManagedNode && managedForThisNode ? (
          <NodeOutgoingTraceroutesSection nodeId={meshtasticNodeId} managed={managedForThisNode} />
        ) : null}
        <NodeTracerouteHistorySection nodeId={meshtasticNodeId} observedNode={node} />
      </Suspense>
    </>
  );
}

const NODE_RANGE_OPTIONS = STATS_PRESET_KEYS;

export function NodeDetailContent({ internalId, compact = false, activeTab, onTabChange }: NodeDetailContentProps) {
  const node = useNodeSuspense(internalId);
  const meshtasticNodeId = node.meshtastic_node_id;
  const { recentNodes, addRecentNode } = useRecentNodes();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const { managedNodes } = useManagedNodesSuspense({ includeGeoClassification: true });

  const isManagedNode = useMemo(() => {
    if (meshtasticNodeId == null) return false;
    return managedNodes.some((managedNode) => managedNode.meshtastic_node_id === meshtasticNodeId);
  }, [managedNodes, meshtasticNodeId]);

  const managedForThisNode = useMemo(() => {
    if (meshtasticNodeId == null) return undefined;
    return managedNodes.find((m) => m.meshtastic_node_id === meshtasticNodeId);
  }, [managedNodes, meshtasticNodeId]);

  useEffect(() => {
    if (node) {
      addRecentNode(node);
    }
  }, [internalId, addRecentNode, node]);

  const currentUser = authService.getCurrentUser();
  const roleLabel = getRoleLabel(node.meshtastic_role);
  const hasPendingClaim = node.claim && !node.claim.accepted_at;
  const hasApprovedClaim =
    (node.claim && node.claim.accepted_at) || (node.owner && currentUser && node.owner.id === currentUser.id);

  const fullPageTabs = !compact && activeTab !== undefined && onTabChange !== undefined;
  const showRfPropagation =
    !compact && node.meshtastic_role != null && INFRASTRUCTURE_ROLE_IDS.has(node.meshtastic_role);

  // One range for the page, in the URL as `?range=` so it carries between Statistics and Traceroutes. Compact (the
  // slide-over) keeps it in state: it must not touch the host page's URL. No `area`: another node must not inherit it.
  const range = useStatsRange({ options: NODE_RANGE_OPTIONS, local: !fullPageTabs });

  const isMeshCore = isMeshCoreObservedNode(node);
  const showTraceroutesTab = supportsMeshtasticTraceroutes(node);
  const showMonitoringTab = Boolean(currentUser) && !isMeshCore;

  useEffect(() => {
    if (!fullPageTabs || !onTabChange) return;
    if (activeTab === 'monitoring' && !showMonitoringTab) {
      onTabChange('overview');
    } else if (activeTab === 'traceroutes' && !showTraceroutesTab) {
      onTabChange('overview');
    }
  }, [fullPageTabs, activeTab, showMonitoringTab, showTraceroutesTab, onTabChange]);

  const effectiveTab: NodeDetailTab =
    fullPageTabs &&
    ((activeTab === 'monitoring' && !showMonitoringTab) || (activeTab === 'traceroutes' && !showTraceroutesTab))
      ? 'overview'
      : (activeTab ?? 'overview');

  const renderMetricsGrid = () => (
    <div className={`mb-6 grid grid-cols-1 ${compact ? 'gap-4' : 'gap-6 md:grid-cols-2'}`}>
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Static node details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Node ID:</span> <span className="font-mono">{node.node_id_str}</span>
            </p>
            <p>
              <span className="font-medium">Hardware Model:</span> {node.meshtastic_hw_model ?? '—'}
            </p>
            {hasFirmwareBadge(node) && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Firmware:</span> <FirmwareBadge node={node} />
              </div>
            )}
            {roleLabel && (
              <p>
                <span className="font-medium">Role:</span> {roleLabel}
              </p>
            )}
            {node.mac_addr && (
              <p>
                <span className="font-medium">MAC Address:</span> <span className="font-mono">{node.mac_addr}</span>
              </p>
            )}
            {node.meshtastic_public_key && (
              <p className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 font-medium">Public Key:</span>
                <span className="break-all font-mono text-sm">{node.meshtastic_public_key}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2"
                  onClick={() => handleCopyToClipboard(node.meshtastic_public_key!)}
                  title="Copy public key"
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </Button>
              </p>
            )}
            {(node.meshtastic_is_licensed === true || node.meshtastic_is_licensed === false) && (
              <p>
                <span className="font-medium">Licensed Operator:</span> {node.meshtastic_is_licensed ? 'Yes' : 'No'}
              </p>
            )}
            {(node.meshtastic_is_unmessagable === true || node.meshtastic_is_unmessagable === false) && (
              <p>
                <span className="font-medium">Messagable:</span> {node.meshtastic_is_unmessagable ? 'No' : 'Yes'}
              </p>
            )}
            <p>
              <span className="font-medium">Last Heard:</span>{' '}
              <StaleReportedTime at={node.last_heard ?? null} fallback="Never" />
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Last time any packet was received from this node (telemetry, messages, etc.)
              </span>
            </p>
            {node.meshtastic_inferred_max_hops != null && (
              <p>
                <span className="font-medium">Inferred Max Hops:</span> {node.meshtastic_inferred_max_hops}
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Inferred from packets; recommended is 7
                </span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {node.latest_device_metrics && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Device Metrics</CardTitle>
              <CardDescription>
                Battery, voltage, channel utilisation — last reported{' '}
                <StaleReportedTime at={node.latest_device_metrics.reported_time} />
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <BatteryGauge
                batteryLevel={node.latest_device_metrics.battery_level ?? null}
                voltage={node.latest_device_metrics.voltage ?? null}
              />
              <PercentGauge
                value={node.latest_device_metrics.meshtastic_channel_utilization ?? null}
                label="Channel Utilization"
              />
              <PercentGauge value={node.latest_device_metrics.meshtastic_air_util_tx ?? null} label="Air Utilization" />
              <p>
                <span className="font-medium">Uptime:</span>{' '}
                {node.latest_device_metrics.uptime_seconds != null
                  ? formatUptimeSeconds(node.latest_device_metrics.uptime_seconds)
                  : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {hasEnvironmentSensorMetrics(node.latest_environment_metrics) && (
        <>
          <MetricsCard
            title="Environment Metrics"
            reportedTime={node.latest_environment_metrics?.reported_time}
            headerActions={
              node.environment_settings_editable ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Environment metrics settings"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              ) : undefined
            }
            metrics={[
              { label: 'Sensor placement', value: node.environment_exposure },
              { label: 'Use for weather', value: node.weather_use },
              ...(node.latest_environment_metrics
                ? [
                    { label: 'Temperature', value: node.latest_environment_metrics.temperature, unit: '°C' },
                    {
                      label: 'Relative Humidity',
                      value: node.latest_environment_metrics.relative_humidity,
                      unit: '%',
                    },
                    {
                      label: 'Barometric Pressure',
                      value: node.latest_environment_metrics.barometric_pressure,
                      unit: 'hPa',
                    },
                    { label: 'Gas Resistance', value: node.latest_environment_metrics.gas_resistance, unit: 'Ω' },
                    { label: 'IAQ', value: node.latest_environment_metrics.iaq },
                    { label: 'Lux', value: node.latest_environment_metrics.lux, unit: 'lx' },
                    { label: 'Wind Direction', value: node.latest_environment_metrics.wind_direction, unit: '°' },
                    { label: 'Wind Speed', value: node.latest_environment_metrics.wind_speed, unit: 'm/s' },
                    { label: 'Radiation', value: node.latest_environment_metrics.radiation },
                    { label: 'Rainfall 1h', value: node.latest_environment_metrics.rainfall_1h, unit: 'mm' },
                    { label: 'Rainfall 24h', value: node.latest_environment_metrics.rainfall_24h, unit: 'mm' },
                  ]
                : []),
            ]}
          />
          {node.environment_settings_editable && (
            <NodeEnvironmentSettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              internalId={internalId}
              initialEnvironmentExposure={(node.environment_exposure ?? 'unknown') as EnvironmentExposureSlug}
              initialWeatherUse={(node.weather_use ?? 'unknown') as WeatherUseSlug}
            />
          )}
        </>
      )}

      {node.latest_power_metrics &&
        (() => {
          const pm = node.latest_power_metrics;
          const channelMetrics = [1, 2, 3, 4, 5, 6, 7, 8]
            .map((n) => {
              const v = (pm as Record<string, number | null | undefined>)[`ch${n}_voltage`];
              const c = (pm as Record<string, number | null | undefined>)[`ch${n}_current`];
              if (v != null || c != null) {
                const parts = [];
                if (v != null) parts.push(`${v.toFixed(2)}V`);
                if (c != null) parts.push(`${c.toFixed(2)}A`);
                return { label: `Ch${n}`, value: parts.join(' / ') };
              }
              return null;
            })
            .filter(Boolean) as { label: string; value: string }[];
          return channelMetrics.length > 0 ? (
            <MetricsCard
              title="Power Metrics"
              reportedTime={node.latest_power_metrics.reported_time}
              metrics={channelMetrics}
            />
          ) : null;
        })()}
    </div>
  );

  const renderLegacyLocationBlock = () => (
    <div className={showRfPropagation ? 'mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2' : 'mb-6'}>
      <NodeLocationCard node={node} internalId={internalId} compact={compact} />
      {showRfPropagation ? <RfPropagationSection node={node} className="mb-0" /> : null}
    </div>
  );

  const claimBadge =
    hasPendingClaim || hasApprovedClaim || (node.owner && (!currentUser || node.owner.id !== currentUser.id)) ? (
      hasPendingClaim ? (
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Claim Pending</span>
        </Badge>
      ) : hasApprovedClaim ? (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          <span>Claimed by You</span>
        </Badge>
      ) : node.owner ? (
        <Badge variant="outline" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          <span>Claimed by {node.owner.username}</span>
        </Badge>
      ) : null
    ) : null;

  const claimLink =
    !node.owner || hasPendingClaim ? (
      <Link
        to={`/nodes/${internalId}/claim`}
        className="whitespace-nowrap rounded-md bg-teal-600 px-4 py-2 text-sm text-white transition-colors hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
      >
        {hasPendingClaim ? 'View Claim' : 'Claim Node'}
      </Link>
    ) : null;

  const shellTabs: NodeShellTab[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'map', label: 'Map' },
    ...(showTraceroutesTab ? [{ value: 'traceroutes' as const, label: 'Traceroutes' }] : []),
    { value: 'statistics', label: 'Statistics' },
    ...(showMonitoringTab ? [{ value: 'monitoring' as const, label: 'Monitoring' }] : []),
  ];

  const recentlyViewed =
    !compact && recentNodes.length > 1 ? (
      <div className="mt-8" data-testid="node-recently-viewed">
        <div className="mb-2 text-sm text-slate-500 dark:text-slate-400">Recently viewed:</div>
        <div className="flex flex-wrap gap-2">
          {recentNodes
            .filter((recentNode) => recentNode.meshtastic_node_id !== meshtasticNodeId)
            .map((recentNode) => (
              <Link
                key={recentNode.meshtastic_node_id}
                to={observedNodeDetailPath(recentNode) ?? '#'}
                replace={true}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm text-teal-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-teal-400 dark:hover:bg-slate-700"
              >
                {recentNode.short_name}
              </Link>
            ))}
        </div>
      </div>
    ) : null;

  if (fullPageTabs && onTabChange) {
    return (
      <div className="container mx-auto px-4 pb-8" data-testid="node-detail-page">
        <NodeShell
          shortName={node.short_name}
          longName={node.long_name}
          hardware={node.meshtastic_hw_model}
          actions={
            <>
              {claimBadge}
              {claimLink}
            </>
          }
          tabs={shellTabs}
          activeTab={effectiveTab}
          onTabChange={onTabChange}
          range={isRangedNodeDetailTab(effectiveTab) ? range : null}
        >
          {effectiveTab === 'overview' && (
            <div data-testid="node-detail-panel-overview">
              {renderMetricsGrid()}
              <div className="mb-6">
                <NodeLocationCard node={node} internalId={internalId} compact={false} mapTabLink />
              </div>
            </div>
          )}

          {effectiveTab === 'map' && (
            <div data-testid="node-detail-panel-map">
              <div className={showRfPropagation ? 'mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2' : 'mb-6'}>
                <NodeLocationCard node={node} internalId={internalId} compact={false} />
                {showRfPropagation ? <RfPropagationSection node={node} className="mb-0" /> : null}
              </div>
            </div>
          )}

          {effectiveTab === 'traceroutes' && (
            <div data-testid="node-detail-panel-traceroutes">
              <NodeTraceroutesPanel
                internalId={internalId}
                meshtasticNodeId={meshtasticNodeId ?? 0}
                isManagedNode={isManagedNode}
                managedForThisNode={managedForThisNode}
                node={node}
                range={range}
              />
            </div>
          )}

          {effectiveTab === 'statistics' && (
            <div data-testid="node-detail-panel-statistics">
              <NodeStatsSection internalId={internalId} node={node} isManagedNode={isManagedNode} range={range} />
            </div>
          )}

          {effectiveTab === 'monitoring' && showMonitoringTab && (
            <div data-testid="node-detail-panel-monitoring">
              <NodeMeshMonitoringSection node={node} />
            </div>
          )}
        </NodeShell>
        {recentlyViewed}
      </div>
    );
  }

  return (
    <div className={compact ? 'px-2' : 'container mx-auto px-4 py-8'}>
      {!compact && (
        <Link to="/nodes" replace={true} className="mb-4 inline-block text-teal-600 hover:underline dark:text-teal-400">
          ← Back to Nodes
        </Link>
      )}

      <div className={`flex items-start justify-between ${compact ? 'mb-4' : 'mb-6'}`}>
        <div>
          <h1 className={`font-bold ${compact ? 'text-xl' : 'text-3xl'}`}>{node.short_name}</h1>
          <p className="text-slate-600 dark:text-slate-400">{node.long_name}</p>
          {claimBadge ? <div className="mt-2 flex items-center">{claimBadge}</div> : null}
        </div>
        <div className="flex shrink-0 items-start gap-2">{claimLink}</div>
      </div>

      {renderMetricsGrid()}
      {renderLegacyLocationBlock()}

      {!compact && (
        <>
          {showMonitoringTab ? <NodeMeshMonitoringSection node={node} /> : null}
          {showTraceroutesTab ? (
            <NodeTraceroutesPanel
              internalId={internalId}
              meshtasticNodeId={meshtasticNodeId ?? 0}
              isManagedNode={isManagedNode}
              managedForThisNode={managedForThisNode}
              node={node}
              range={range}
            />
          ) : null}
          <NodeStatsSection internalId={internalId} node={node} isManagedNode={isManagedNode} range={range} />
        </>
      )}

      {compact && (
        <Link to={`/nodes/${internalId}`} className="text-sm text-teal-600 hover:underline dark:text-teal-400">
          View full details →
        </Link>
      )}
      {recentlyViewed}
    </div>
  );
}
