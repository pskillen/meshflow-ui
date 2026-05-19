import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import { Link } from 'react-router-dom';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { AutoTraceRoute, DeviceMetrics, NodeWatch, ObservedNode, PaginatedResponse } from '@/lib/models';
import { labelForTriggerTypeApi } from '@/lib/traceroute-trigger-type';
import { TracerouteQueueDispatchCell } from '@/components/traceroutes/TracerouteQueueDispatchCell';
import { TracerouteStatusBadge } from '@/components/traceroutes/TracerouteStatusBadge';
import { useTraceroutesWebSocketInvalidator } from '@/hooks/useTraceroutesWithWebSocket';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MeshWatchControls } from '@/components/nodes/MeshWatchControls';
import { useMeshtasticApi } from '@/hooks/api/useApi';
import { useMultiNodeMetrics } from '@/hooks/api/useMultiNodeMetrics';
import { NodeMiniChart } from '@/components/nodes/NodeMiniChart';
import { BatteryIcon, RouteIcon, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  deriveWatchMonitoringStatus,
  WATCH_STATUS_LABEL,
  type WatchMonitoringStatus,
} from '@/lib/watch-monitoring-status';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const LATEST_TRACEROUTES = 5;

const GROUP_ORDER: WatchMonitoringStatus[] = ['offline', 'verifying', 'battery_low', 'unknown', 'online'];

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Primary: relative with staleness. Secondary: absolute UK-style timestamp. */
function FriendlyThenAbsolute({ value }: { value: Date | string | null | undefined }) {
  const d = toDate(value);
  if (!d) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div>
      <StaleReportedTime at={d} className="text-sm" />
      <div className="text-xs text-muted-foreground tabular-nums mt-0.5">{format(d, 'PPpp', { locale: enGB })}</div>
    </div>
  );
}

function routeSummary(tr: AutoTraceRoute): string {
  const route = tr.route;
  const routeBack = tr.route_back;
  const outEmpty = !route || route.length === 0;
  const backEmpty = !routeBack || routeBack.length === 0;
  if (outEmpty && backEmpty) {
    return tr.status === 'completed' ? 'Direct' : '—';
  }
  const outStr = outEmpty ? 'Direct' : `${route.length} hops`;
  const backStr = backEmpty ? 'Direct' : `${routeBack.length} hops`;
  return `${outStr} out, ${backStr} back`;
}

function watchSettingsSummary(watch: NodeWatch): string {
  if (!watch.enabled) return 'Alerts off';
  const parts: string[] = ['Alerts on'];
  if (watch.offline_notifications_enabled ?? true) parts.push('Offline notify');
  if (watch.battery_notifications_enabled) parts.push('Battery notify');
  return parts.join(' · ');
}

function WatchTracerouteHistoryRows({
  targetNodeId,
  onOpenTraceroute,
}: {
  targetNodeId: number;
  onOpenTraceroute: (id: number) => void;
}) {
  const api = useMeshtasticApi();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['traceroutes', 'watches-dashboard', targetNodeId],
    queryFn: () => api.getTraceroutes({ target_node: targetNodeId, page_size: LATEST_TRACEROUTES }),
  });

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={6} className="text-muted-foreground text-sm py-6">
          Loading traceroutes…
        </TableCell>
      </TableRow>
    );
  }
  if (isError) {
    return (
      <TableRow>
        <TableCell colSpan={6} className="text-muted-foreground text-sm py-6">
          Could not load traceroutes.
        </TableCell>
      </TableRow>
    );
  }
  const rows: AutoTraceRoute[] = data?.results ?? [];
  if (rows.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={6} className="text-muted-foreground text-sm py-6">
          No traceroutes to this node yet.
        </TableCell>
      </TableRow>
    );
  }
  return (
    <>
      {rows.map((tr) => (
        <TableRow key={tr.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpenTraceroute(tr.id)}>
          <TableCell>{tr.source_node?.short_name ?? tr.source_node?.node_id_str ?? '—'}</TableCell>
          <TableCell>{labelForTriggerTypeApi(tr.trigger_type, tr.trigger_type_label)}</TableCell>
          <TableCell>
            <TracerouteStatusBadge status={tr.status} />
          </TableCell>
          <TableCell className="text-sm text-muted-foreground max-w-[160px]">
            <TracerouteQueueDispatchCell tr={tr} />
          </TableCell>
          <TableCell className="max-w-[200px]" title={routeSummary(tr)}>
            {routeSummary(tr)}
          </TableCell>
          <TableCell>
            <FriendlyThenAbsolute value={tr.triggered_at} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export interface WatchedNodesTableProps {
  watches: NodeWatch[];
  watchesQuery: Pick<UseQueryResult<PaginatedResponse<NodeWatch>>, 'isLoading' | 'isError'>;
  onOpenTraceroute: (id: number) => void;
  onRequestTriggerTraceroute?: (node: ObservedNode) => void;
  /** When false, trigger button is disabled with a short explanation. */
  canTriggerTraceroute?: boolean;
}

function observedAsNode(watch: NodeWatch): ObservedNode {
  return watch.observed_node as unknown as ObservedNode;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground mb-1.5">{children}</p>;
}

function BatteryBlock({ node }: { node: ObservedNode }) {
  const m = node.latest_device_metrics;
  if (!m) {
    return <span className="text-muted-foreground">—</span>;
  }
  const batteryLevel = m.battery_level != null ? Number(m.battery_level) : null;
  let batteryColor = 'text-red-500';
  if (batteryLevel != null) {
    if (batteryLevel > 70) {
      batteryColor = 'text-green-500';
    } else if (batteryLevel > 30) {
      batteryColor = 'text-yellow-500';
    }
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <BatteryIcon className={`h-4 w-4 shrink-0 ${batteryColor}`} aria-hidden />
        <span className="text-sm tabular-nums">
          {batteryLevel != null ? `${Math.round(batteryLevel)}%` : '—'}
          {m.voltage != null && ` · ${Number(m.voltage).toFixed(2)} V`}
        </span>
      </div>
      {m.reported_time && (
        <div>
          <FieldLabel>Metrics reported</FieldLabel>
          <FriendlyThenAbsolute value={m.reported_time} />
        </div>
      )}
    </div>
  );
}

function statusBadgeVariant(status: WatchMonitoringStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'offline') return 'destructive';
  if (status === 'verifying') return 'secondary';
  if (status === 'battery_low') return 'secondary';
  if (status === 'online') return 'default';
  return 'outline';
}

function WatchCard({
  watch,
  watchesQuery,
  onOpenTraceroute,
  onRequestTriggerTraceroute,
  canTriggerTraceroute,
  metrics,
  chartDateRange,
  metricsLoading,
}: {
  watch: NodeWatch;
  watchesQuery: Pick<UseQueryResult<PaginatedResponse<NodeWatch>>, 'isLoading' | 'isError'>;
  onOpenTraceroute: (id: number) => void;
  onRequestTriggerTraceroute?: (node: ObservedNode) => void;
  canTriggerTraceroute?: boolean;
  metrics: DeviceMetrics[];
  chartDateRange: { startDate: Date; endDate: Date };
  metricsLoading: boolean;
}) {
  const node = observedAsNode(watch);
  const status = deriveWatchMonitoringStatus(watch);
  const showTraceroutes = status !== 'online' && status !== 'battery_low';

  return (
    <div
      id={`watch-card-${watch.id}`}
      tabIndex={-1}
      className={cn(
        'rounded-lg border-2 bg-card text-card-foreground shadow-sm p-4 space-y-4 outline-none scroll-mt-24',
        status === 'offline' && 'border-destructive ring-2 ring-destructive/25',
        status === 'battery_low' && 'border-amber-600 ring-2 ring-amber-600/30 dark:border-amber-500',
        status !== 'offline' && status !== 'battery_low' && 'border-slate-300 dark:border-slate-400'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant(status)}>{WATCH_STATUS_LABEL[status]}</Badge>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <span
            className="text-xs text-muted-foreground max-w-[min(100%,14rem)] sm:max-w-[20rem] truncate"
            title={watchSettingsSummary(watch)}
          >
            {watchSettingsSummary(watch)}
          </span>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Watch settings"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Watch settings</DialogTitle>
              </DialogHeader>
              <MeshWatchControls
                node={node}
                watch={watch}
                watchesQuery={watchesQuery}
                idPrefix={`watch-dash-${watch.id}`}
              />
            </DialogContent>
          </Dialog>
          {onRequestTriggerTraceroute && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={!canTriggerTraceroute}
              title={canTriggerTraceroute ? undefined : 'No eligible source nodes for traceroute'}
              onClick={() => onRequestTriggerTraceroute(node)}
            >
              <RouteIcon className="h-4 w-4 mr-1.5" aria-hidden />
              Trigger traceroute
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <FieldLabel>Node</FieldLabel>
          <Link
            to={`/nodes/${node.meshtastic_node_id}`}
            className="font-medium text-teal-600 dark:text-teal-400 hover:underline"
          >
            {node.short_name || node.node_id_str}
          </Link>
          <div className="text-xs text-muted-foreground font-mono mt-0.5">{node.node_id_str}</div>
        </div>
        <div>
          <FieldLabel>Last heard</FieldLabel>
          {node.last_heard ? (
            <FriendlyThenAbsolute value={node.last_heard} />
          ) : (
            <span className="text-muted-foreground text-sm">Never</span>
          )}
        </div>
        <div>
          <FieldLabel>Battery</FieldLabel>
          <BatteryBlock node={node} />
        </div>
        <div className="min-w-0">
          <FieldLabel>Battery (last 7 days)</FieldLabel>
          {metricsLoading ? (
            <div className="h-[120px] rounded-md bg-muted/60 animate-pulse" aria-hidden />
          ) : (
            <div className="-mx-1">
              <NodeMiniChart metrics={metrics} dateRange={chartDateRange} lines="battery" />
            </div>
          )}
        </div>
      </div>

      {showTraceroutes ? (
        <div className="border-t border-slate-300 pt-4 dark:border-slate-500">
          <FieldLabel>Latest traceroutes (this target)</FieldLabel>
          <div className="rounded-md border border-slate-300 overflow-x-auto dark:border-slate-500">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>TR sender</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Queue / dispatch</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Triggered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <WatchTracerouteHistoryRows
                  targetNodeId={node.meshtastic_node_id}
                  onOpenTraceroute={onOpenTraceroute}
                />
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-300 pt-4 dark:border-slate-500">
          <p className="text-sm text-muted-foreground">
            {status === 'battery_low' ? (
              <>
                Low battery watch — traceroute history is hidden while the node is otherwise online.{' '}
                <Link to="/traceroutes/history" className="text-teal-600 dark:text-teal-400 hover:underline">
                  Open full traceroute history
                </Link>
                .
              </>
            ) : (
              <>
                Node is currently online; traceroute history is hidden here.{' '}
                <Link to="/traceroutes/history" className="text-teal-600 dark:text-teal-400 hover:underline">
                  Open full traceroute history
                </Link>
                .
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export function WatchedNodesTable({
  watches,
  watchesQuery,
  onOpenTraceroute,
  onRequestTriggerTraceroute,
  canTriggerTraceroute,
}: WatchedNodesTableProps) {
  useTraceroutesWebSocketInvalidator();

  const watchedObservedNodes = useMemo(() => watches.map((w) => observedAsNode(w)), [watches]);
  const chartDateRange = useMemo(
    () => ({
      startDate: subDays(new Date(), 7),
      endDate: new Date(),
    }),
    []
  );
  const { metricsMap, isLoading: metricsLoading } = useMultiNodeMetrics(watchedObservedNodes, chartDateRange);

  const grouped = useMemo(() => {
    const m = new Map<WatchMonitoringStatus, NodeWatch[]>();
    for (const s of GROUP_ORDER) m.set(s, []);
    for (const w of watches) {
      const s = deriveWatchMonitoringStatus(w);
      m.get(s)!.push(w);
    }
    return m;
  }, [watches]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Watched nodes</CardTitle>
        <CardDescription>
          Mesh monitoring watches for your account, grouped by status. Offline and verifying nodes are listed first.{' '}
          <Link to="/traceroutes/history" className="text-teal-600 dark:text-teal-400 hover:underline">
            Open full traceroute history
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <div className="p-4 flex flex-col gap-8">
        {GROUP_ORDER.map((groupStatus) => {
          const list = grouped.get(groupStatus) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={groupStatus} aria-labelledby={`watch-group-${groupStatus}`}>
              <h3 id={`watch-group-${groupStatus}`} className="text-sm font-semibold mb-3">
                {WATCH_STATUS_LABEL[groupStatus]} ({list.length})
              </h3>
              <div className="flex flex-col gap-4">
                {list.map((watch) => (
                  <WatchCard
                    key={watch.id}
                    watch={watch}
                    watchesQuery={watchesQuery}
                    onOpenTraceroute={onOpenTraceroute}
                    onRequestTriggerTraceroute={onRequestTriggerTraceroute}
                    canTriggerTraceroute={canTriggerTraceroute}
                    metrics={metricsMap[watch.observed_node.meshtastic_node_id] ?? []}
                    chartDateRange={chartDateRange}
                    metricsLoading={metricsLoading}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Card>
  );
}
