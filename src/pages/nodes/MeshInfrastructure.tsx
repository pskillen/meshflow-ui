import { useMemo, useState, useCallback, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { subDays, subHours, format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import {
  useAllInfrastructureNodesSuspense,
  useInfrastructureNodesSuspense,
  useManagedNodesSuspense,
} from '@/hooks/api/useNodes';
import { useNodeWatches } from '@/hooks/api/useNodeWatches';
import { useMultiNodeMetricsSuspense } from '@/hooks/api/useMultiNodeMetrics';
import { InfrastructureNodeCard } from '@/components/nodes/InfrastructureNodeCard';
import { NodesAndConstellationsMap } from '@/components/nodes/NodesAndConstellationsMap';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MonitoredNodesBatteryChart } from '@/components/nodes/MonitoredNodesBatteryChart';
import { MonitoredNodesChannelUtilChart } from '@/components/nodes/MonitoredNodesChannelUtilChart';
import { TimeRangeSelect } from '@/components/TimeRangeSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ObservedNode, type NodeWatch } from '@/lib/models';
import { filterManagedNodesForMapDisplay } from '@/lib/managed-node-status';
import { MeshWatchControls } from '@/components/nodes/MeshWatchControls';
import { Battery, MapPinOff } from 'lucide-react';
import {
  getBatteryMetricsReportedAt,
  getLowBatteryRowFlags,
  hasMeshInfraMapBatteryOrPresenceAlert,
  isLowBatteryTableRowVisible,
  LOW_BATTERY_THRESHOLD_PERCENT,
  matchesLowBatteryNoTelemetryRow,
  matchesLowBatteryStaleReadingRow,
  matchesLowBatteryZeroPercentRow,
  partitionMeshInfraLowBatteryTableNodes,
  STALE_BATTERY_TELEMETRY_DAYS,
} from '@/lib/infrastructure-low-battery';

const CHART_TIME_RANGE_OPTIONS = [
  { key: '24h', label: '24 hours' },
  { key: '48h', label: '48 hours' },
  { key: '1d', label: 'Today' },
  { key: '2d', label: '2 days' },
  { key: '7d', label: '7 days' },
  { key: '14d', label: '14 days' },
];

type NodeListTimeRange = '2h' | '24h' | '7d' | '14d' | '30d' | 'all';

const TIME_RANGE_OPTIONS: { value: NodeListTimeRange; label: string }[] = [
  { value: '2h', label: '2 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
];

function getLastHeardAfter(timeRange: NodeListTimeRange): Date | undefined {
  if (timeRange === 'all') return undefined;
  const now = new Date();
  switch (timeRange) {
    case '2h':
      return subHours(now, 2);
    case '24h':
      return subHours(now, 24);
    case '7d':
      return subDays(now, 7);
    case '14d':
      return subDays(now, 14);
    case '30d':
      return subDays(now, 30);
    default:
      return subDays(now, 7);
  }
}

const STALE_LOCATION_DAYS = 7;

function getLastLocationReported(node: ObservedNode): Date | null {
  const pos = node.latest_position as { reported_time?: Date | string } | null;
  if (!pos?.reported_time) return null;
  return new Date(pos.reported_time);
}

function hasRecentLocation(node: ObservedNode): boolean {
  const pos = node.latest_position as {
    latitude?: number;
    longitude?: number;
    reported_time?: Date | string;
  } | null;
  if (!pos) return false;
  const lat = pos.latitude;
  const lon = pos.longitude;
  if (lat == null || lon == null || lat === 0 || lon === 0) return false;
  const reportedTime = pos.reported_time ? new Date(pos.reported_time) : null;
  if (!reportedTime) return false;
  const cutoff = subDays(new Date(), STALE_LOCATION_DAYS);
  return reportedTime >= cutoff;
}

function MeshInfrastructureContent() {
  const [timeRange, setTimeRange] = useState<NodeListTimeRange>('14d');
  const [includeClientBase, setIncludeClientBase] = useState(false);
  const [chartTimeRangeLabel, setChartTimeRangeLabel] = useState('7d');
  const [chartDateRange, setChartDateRange] = useState<{ startDate: Date; endDate: Date }>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    endDate: new Date(),
  });

  const lastHeardAfter = useMemo(() => getLastHeardAfter(timeRange), [timeRange]);

  const [selectedChartNodeIds, setSelectedChartNodeIds] = useState<Set<number>>(() => new Set());

  const { nodes, totalNodes, fetchNextPage, hasNextPage } = useInfrastructureNodesSuspense({
    lastHeardAfter,
    pageSize: 12,
    includeClientBase,
  });

  /** Full list for map + alert tables; the paged `nodes` above only includes loaded card pages. */
  const { nodes: allInfraNodes } = useAllInfrastructureNodesSuspense({
    lastHeardAfter,
    includeClientBase,
  });

  const watchesQuery = useNodeWatches();
  const watchesByNodeIdStr = useMemo(() => {
    const m = new Map<string, NodeWatch>();
    for (const w of watchesQuery.data?.results ?? []) {
      m.set(w.observed_node.node_id_str, w);
    }
    return m;
  }, [watchesQuery.data]);

  const { managedNodes } = useManagedNodesSuspense({
    pageSize: 500,
    includeStatus: true,
    includeGeoClassification: true,
  });
  const managedByMeshId = useMemo(() => new Map(managedNodes.map((m) => [m.meshtastic_node_id, m])), [managedNodes]);
  const managedNodesForMap = useMemo(() => filterManagedNodesForMapDisplay(managedNodes), [managedNodes]);

  const { metricsMap } = useMultiNodeMetricsSuspense(nodes, chartDateRange);

  const nodesWithLocation = useMemo(() => allInfraNodes.filter(hasRecentLocation), [allInfraNodes]);
  const nodesWithoutLocation = useMemo(() => allInfraNodes.filter((n) => !hasRecentLocation(n)), [allInfraNodes]);

  const lowBatteryNodesOrdered = useMemo(() => partitionMeshInfraLowBatteryTableNodes(allInfraNodes), [allInfraNodes]);

  const [showStaleBatteryReadings, setShowStaleBatteryReadings] = useState(false);
  const [showZeroPercentBattery, setShowZeroPercentBattery] = useState(false);
  const [showNoBatteryTelemetry, setShowNoBatteryTelemetry] = useState(false);

  const lowBatteryTableFilters = useMemo(
    () => ({
      showStaleReadings: showStaleBatteryReadings,
      showZeroPercent: showZeroPercentBattery,
      showNoTelemetry: showNoBatteryTelemetry,
    }),
    [showStaleBatteryReadings, showZeroPercentBattery, showNoBatteryTelemetry]
  );

  const visibleLowBatteryRows = useMemo(
    () => lowBatteryNodesOrdered.filter((n) => isLowBatteryTableRowVisible(n, lowBatteryTableFilters)),
    [lowBatteryNodesOrdered, lowBatteryTableFilters]
  );

  const lowBatteryHiddenLineCounts = useMemo(() => {
    const hidden = lowBatteryNodesOrdered.filter((n) => !isLowBatteryTableRowVisible(n, lowBatteryTableFilters));
    let noTelemetry = 0;
    let zeroPercent = 0;
    let staleReadings = 0;
    for (const n of hidden) {
      if (matchesLowBatteryNoTelemetryRow(n) && !lowBatteryTableFilters.showNoTelemetry) {
        noTelemetry++;
      } else if (matchesLowBatteryZeroPercentRow(n) && !lowBatteryTableFilters.showZeroPercent) {
        zeroPercent++;
      } else if (matchesLowBatteryStaleReadingRow(n) && !lowBatteryTableFilters.showStaleReadings) {
        staleReadings++;
      }
    }
    return { noTelemetry, zeroPercent, staleReadings };
  }, [lowBatteryNodesOrdered, lowBatteryTableFilters]);

  const nodeAlertRing = useMemo(() => {
    const m = new Map<number, 'diamond' | 'rounded-square'>();
    for (const n of allInfraNodes) {
      if (!hasMeshInfraMapBatteryOrPresenceAlert(n)) continue;
      m.set(n.meshtastic_node_id, n.meshtastic_node_id % 2 === 0 ? 'diamond' : 'rounded-square');
    }
    return m;
  }, [allInfraNodes]);

  const sortedNodes = useMemo(
    () =>
      [...nodes].sort((a, b) => {
        if (!a.last_heard) return 1;
        if (!b.last_heard) return -1;
        return b.last_heard.getTime() - a.last_heard.getTime();
      }),
    [nodes]
  );

  const chartNodes = useMemo(
    () => nodes.filter((n) => selectedChartNodeIds.has(n.meshtastic_node_id)),
    [nodes, selectedChartNodeIds]
  );

  const handleCompareToggle = useCallback((nodeId: number, newState: boolean) => {
    const savedScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    setSelectedChartNodeIds((prev) => {
      const next = new Set(prev);
      if (newState) next.add(nodeId);
      else next.delete(nodeId);
      return next;
    });
    requestAnimationFrame(() => {
      if (typeof window !== 'undefined' && Math.abs(window.scrollY - savedScrollY) > 5) {
        window.scrollTo(0, savedScrollY);
      }
    });
  }, []);

  const handleChartTimeRangeChange = (value: string, timeRange: { startDate: Date; endDate: Date }) => {
    setChartTimeRangeLabel(value);
    setChartDateRange(timeRange);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Mesh Infrastructure</h1>
        <div className="mt-2 flex items-center gap-2">
          <Switch id="include-client-base" checked={includeClientBase} onCheckedChange={setIncludeClientBase} />
          <Label htmlFor="include-client-base">Include CLIENT_BASE</Label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-2">
          <label htmlFor="time-range" className="text-sm text-muted-foreground">
            Node list time range:
          </label>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as NodeListTimeRange)}>
            <SelectTrigger className="w-[180px]" id="time-range" aria-label="Select time range">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Infrastructure Node Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[600px] w-full">
              <NodesAndConstellationsMap
                observedNodes={nodesWithLocation}
                managedNodes={managedNodesForMap}
                showConstellation={true}
                showUnmanagedNodes={true}
                drawPositionUncertainty={true}
                enableBubbles={true}
                showRoleLegendSwatches={false}
                getNodeAlertRing={(nodeId) => nodeAlertRing.get(nodeId) ?? null}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {nodesWithoutLocation.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPinOff className="h-5 w-5" />
              Nodes without recent location ({nodesWithoutLocation.length})
            </CardTitle>
            <CardDescription>
              &quot;Recent location&quot; means a GPS fix reported in the last {STALE_LOCATION_DAYS} days. The node list
              time range (default 14 days of last heard) controls which infrastructure nodes appear on this page—nodes
              outside that window are not listed, which is separate from GPS freshness. A node can be active (last
              heard) without reporting location.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Node</TableHead>
                  <TableHead>Last heard</TableHead>
                  <TableHead>Last GPS position reported</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Mesh watch</TableHead>
                  <TableHead className="w-0"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nodesWithoutLocation.map((node) => {
                  const lastLocation = getLastLocationReported(node);
                  const cutoff = subDays(new Date(), 7);
                  const isOffline =
                    !node.last_heard ||
                    (node.last_heard instanceof Date ? node.last_heard : new Date(node.last_heard)) < cutoff;
                  const watch = watchesByNodeIdStr.get(node.node_id_str);
                  const managed = managedByMeshId.get(node.meshtastic_node_id);
                  return (
                    <TableRow key={node.internal_id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/nodes/${node.meshtastic_node_id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {node.long_name} ({node.short_name || node.node_id_str})
                            </Link>
                            {isOffline && (
                              <Badge
                                variant="outline"
                                className="text-xs border-red-500/70 text-red-700 dark:border-red-400 dark:text-red-300"
                              >
                                OFFLINE
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{node.node_id_str}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          {node.last_heard ? (
                            <>
                              <span>
                                {format(
                                  node.last_heard instanceof Date ? node.last_heard : new Date(node.last_heard),
                                  'PPpp',
                                  { locale: enGB }
                                )}
                              </span>
                              <StaleReportedTime
                                at={node.last_heard instanceof Date ? node.last_heard : new Date(node.last_heard)}
                                className="text-xs text-muted-foreground"
                              />
                            </>
                          ) : (
                            'Never'
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          {lastLocation ? (
                            <>
                              <span>{format(lastLocation, 'PPpp', { locale: enGB })}</span>
                              <StaleReportedTime at={lastLocation} className="text-xs text-muted-foreground" />
                            </>
                          ) : (
                            'Never'
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{node.owner?.username ?? '—'}</TableCell>
                      <TableCell>
                        <MeshWatchControls
                          node={node}
                          watch={watch}
                          watchesQuery={watchesQuery}
                          idPrefix={`infra-no-loc-${node.meshtastic_node_id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <Link
                            to={`/nodes/${node.meshtastic_node_id}`}
                            className="text-primary text-sm hover:underline"
                          >
                            View details
                          </Link>
                          {managed != null && (
                            <Link
                              to={`/traceroutes/map/coverage?feeder=${node.meshtastic_node_id}`}
                              className="text-muted-foreground text-sm underline-offset-4 hover:text-primary hover:underline"
                              data-testid={`infra-no-loc-coverage-link-${node.meshtastic_node_id}`}
                            >
                              Coverage map
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {lowBatteryNodesOrdered.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Battery className="h-5 w-5" />
              Low battery nodes (
              {visibleLowBatteryRows.length === lowBatteryNodesOrdered.length
                ? lowBatteryNodesOrdered.length
                : `${visibleLowBatteryRows.length} of ${lowBatteryNodesOrdered.length}`}
              )
            </CardTitle>
            <CardDescription>
              Includes nodes below {LOW_BATTERY_THRESHOLD_PERCENT}% battery, no battery telemetry, a reading older than{' '}
              {STALE_BATTERY_TELEMETRY_DAYS} days, or an active mesh monitoring low-battery alert. Last heard can still
              be recent while metrics are missing or stale—that is not always a problem. Rows showing 0% are often bogus
              telemetry and are listed last. Use the toggles to reveal stale readings, 0% rows, or nodes with no battery
              telemetry (all off by default).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">Show in table:</span>
              <Button
                type="button"
                variant={showStaleBatteryReadings ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowStaleBatteryReadings((v) => !v)}
              >
                Stale battery readings
              </Button>
              <Button
                type="button"
                variant={showZeroPercentBattery ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowZeroPercentBattery((v) => !v)}
              >
                0% battery
              </Button>
              <Button
                type="button"
                variant={showNoBatteryTelemetry ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowNoBatteryTelemetry((v) => !v)}
              >
                No battery telemetry
              </Button>
            </div>
            {(lowBatteryHiddenLineCounts.staleReadings > 0 ||
              lowBatteryHiddenLineCounts.zeroPercent > 0 ||
              lowBatteryHiddenLineCounts.noTelemetry > 0) && (
              <div className="text-sm text-muted-foreground space-y-1">
                {lowBatteryHiddenLineCounts.staleReadings > 0 && (
                  <p>
                    {lowBatteryHiddenLineCounts.staleReadings} node
                    {lowBatteryHiddenLineCounts.staleReadings === 1 ? '' : 's'} with stale battery readings hidden
                  </p>
                )}
                {lowBatteryHiddenLineCounts.zeroPercent > 0 && (
                  <p>
                    {lowBatteryHiddenLineCounts.zeroPercent} node
                    {lowBatteryHiddenLineCounts.zeroPercent === 1 ? '' : 's'} reporting 0% battery hidden
                  </p>
                )}
                {lowBatteryHiddenLineCounts.noTelemetry > 0 && (
                  <p>
                    {lowBatteryHiddenLineCounts.noTelemetry} node
                    {lowBatteryHiddenLineCounts.noTelemetry === 1 ? '' : 's'} with no battery telemetry hidden
                  </p>
                )}
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Node</TableHead>
                  <TableHead>Last heard</TableHead>
                  <TableHead>Battery</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Mesh watch</TableHead>
                  <TableHead className="w-0"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleLowBatteryRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No rows match the current filters. Turn on one or more categories above to show hidden nodes.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleLowBatteryRows.map((node) => {
                    const flags = getLowBatteryRowFlags(node);
                    const reportedAt = getBatteryMetricsReportedAt(node);
                    const level = node.latest_device_metrics?.battery_level;
                    const watch = watchesByNodeIdStr.get(node.node_id_str);
                    const managed = managedByMeshId.get(node.meshtastic_node_id);
                    const cutoff = subDays(new Date(), 7);
                    const isOffline =
                      !node.last_heard ||
                      (node.last_heard instanceof Date ? node.last_heard : new Date(node.last_heard)) < cutoff;
                    return (
                      <TableRow
                        key={node.internal_id}
                        className={flags.isZeroPercent ? 'opacity-70 text-muted-foreground' : undefined}
                      >
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/nodes/${node.meshtastic_node_id}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {node.long_name} ({node.short_name || node.node_id_str})
                              </Link>
                              {isOffline && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-red-500/70 text-red-700 dark:border-red-400 dark:text-red-300"
                                >
                                  OFFLINE
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{node.node_id_str}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            {node.last_heard ? (
                              <>
                                <span>
                                  {format(
                                    node.last_heard instanceof Date ? node.last_heard : new Date(node.last_heard),
                                    'PPpp',
                                    { locale: enGB }
                                  )}
                                </span>
                                <StaleReportedTime
                                  at={node.last_heard instanceof Date ? node.last_heard : new Date(node.last_heard)}
                                  className="text-xs text-muted-foreground"
                                />
                              </>
                            ) : (
                              'Never'
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            {level != null ? (
                              <>
                                <span>{level}%</span>
                                {reportedAt ? (
                                  <>
                                    <span className="text-xs text-muted-foreground">
                                      {format(reportedAt, 'PPpp', { locale: enGB })}
                                    </span>
                                    <StaleReportedTime at={reportedAt} className="text-xs text-muted-foreground" />
                                  </>
                                ) : null}
                              </>
                            ) : (
                              '—'
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {flags.showLowBatteryBadge ? (
                              <Badge variant="secondary" className="text-xs">
                                Low battery
                              </Badge>
                            ) : null}
                            {flags.showStaleBatteryBadge ? (
                              <Badge variant="outline" className="text-xs">
                                {node.latest_device_metrics?.reported_time
                                  ? `Battery reading ${STALE_BATTERY_TELEMETRY_DAYS}+ days old`
                                  : 'No battery telemetry'}
                              </Badge>
                            ) : null}
                            {node.battery_alert_active ? (
                              <Badge variant="destructive" className="text-xs">
                                Mesh battery alert
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{node.owner?.username ?? '—'}</TableCell>
                        <TableCell>
                          <MeshWatchControls
                            node={node}
                            watch={watch}
                            watchesQuery={watchesQuery}
                            idPrefix={`infra-batt-${node.meshtastic_node_id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
                            <Link
                              to={`/nodes/${node.meshtastic_node_id}`}
                              className="text-primary text-sm hover:underline"
                            >
                              View details
                            </Link>
                            {managed != null && (
                              <Link
                                to={`/traceroutes/map/coverage?feeder=${node.meshtastic_node_id}`}
                                className="text-muted-foreground text-sm underline-offset-4 hover:text-primary hover:underline"
                                data-testid={`infra-batt-coverage-link-${node.meshtastic_node_id}`}
                              >
                                Coverage map
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">
            All Infrastructure Nodes ({sortedNodes.length}
            {totalNodes > sortedNodes.length ? ` of ${totalNodes}` : ''})
          </h2>
          <div className="flex items-center gap-2 sm:ml-auto">
            <label htmlFor="chart-time-range" className="text-sm text-muted-foreground whitespace-nowrap">
              Chart time range:
            </label>
            <TimeRangeSelect
              options={CHART_TIME_RANGE_OPTIONS}
              value={chartTimeRangeLabel}
              onChange={handleChartTimeRangeChange}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedNodes.map((node) => (
            <InfrastructureNodeCard
              key={node.internal_id}
              node={node}
              managedNode={managedByMeshId.get(node.meshtastic_node_id)}
              metrics={metricsMap[node.meshtastic_node_id] ?? []}
              dateRange={chartDateRange}
              onCompareToggle={handleCompareToggle}
              watch={watchesByNodeIdStr.get(node.node_id_str)}
              watchesQuery={watchesQuery}
            />
          ))}
        </div>
        {hasNextPage && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={() => fetchNextPage()}>
              Load more
            </Button>
          </div>
        )}
      </div>

      {nodes.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Battery & Channel Utilisation</CardTitle>
            <CardDescription>
              {chartNodes.length > 0
                ? `Comparing ${chartNodes.length} node${chartNodes.length === 1 ? '' : 's'}. Tick the checkbox on node cards above to add or remove.`
                : 'Tick the checkbox on node cards above to add nodes to these charts.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {chartNodes.length > 0 ? (
              <>
                <MonitoredNodesBatteryChart
                  nodes={chartNodes}
                  dateRange={chartDateRange}
                  timeRangeLabel={chartTimeRangeLabel}
                  onTimeRangeChange={handleChartTimeRangeChange}
                  hideTimeRangePicker
                  metricsMap={metricsMap}
                  metricsQueryNodes={nodes}
                />
                <MonitoredNodesChannelUtilChart
                  nodes={chartNodes}
                  dateRange={chartDateRange}
                  hideTimeRangePicker
                  metricsMap={metricsMap}
                  metricsQueryNodes={nodes}
                />
              </>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                No nodes selected for comparison. Tick the &quot;Compare&quot; checkbox on any node card above.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function MeshInfrastructure() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center min-h-screen items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      }
    >
      <MeshInfrastructureContent />
    </Suspense>
  );
}
