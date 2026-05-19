import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ManagedNode } from '@/lib/models';
import { RouteIcon, ChevronDown, X } from 'lucide-react';
import { TRACEROUTE_STRATEGIES, type TracerouteStrategyValue } from '@/lib/traceroute-strategy';

const MESH_VIEW_OPTIONS = [
  { value: 'map-packets', label: 'Heatmap · Packet volume', path: '/traceroutes/map/heat' },
  { value: 'map-snr', label: 'Heatmap · Link quality (SNR)', path: '/traceroutes/map/snr' },
  { value: 'topology-packets', label: 'Topology · Packet volume', path: '/traceroutes/map/topology/heat' },
  { value: 'topology-snr', label: 'Topology · Link quality (SNR)', path: '/traceroutes/map/topology/snr' },
] as const;

export type HeatmapViewMode = 'map' | 'topology';

const HEATMAP_STRATEGY_OPTIONS: Array<{ value: TracerouteStrategyValue; label: string }> = TRACEROUTE_STRATEGIES.filter(
  (v) => v !== 'legacy'
).map((value) => ({
  value,
  label:
    value === 'intra_zone'
      ? 'Intra-zone'
      : value === 'dx_across'
        ? 'DX across'
        : value === 'dx_same_side'
          ? 'DX same side'
          : value,
}));

function multiSelectLabel<T extends string>(
  values: T[],
  options: Array<{ value: T; label: string }>,
  fallback: string
): string {
  if (values.length === 0) return fallback;
  if (values.length === 1) {
    return options.find((o) => o.value === values[0])?.label ?? values[0];
  }
  return `${fallback} (${values.length})`;
}

export function NetworkStatsCard({
  meta,
  staleThresholdHours,
  className,
}: {
  meta: { active_nodes_count: number; total_trace_routes_count: number };
  staleThresholdHours: number;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Network Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div>Active Nodes: {meta.active_nodes_count.toLocaleString()}</div>
        <div>Total Trace Routes: {meta.total_trace_routes_count.toLocaleString()}</div>
        <div className="border-t border-border pt-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Nodes (topology)</div>
          <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
            <li>Dot size — centrality (backbone paths)</li>
            <li>Fill hue — degree (cool → warm)</li>
            <li>Ring weight — degree + backbone role (also for colour-blind contrast)</li>
            <li>Opacity — mesh recency (older than {staleThresholdHours}h fades; API role “offline” from ~24h)</li>
          </ul>
        </div>
        <div className="pt-2">
          <div className="mb-1 text-xs text-muted-foreground">Packets: Quiet → Busy</div>
          <div
            className="h-2 w-full rounded"
            style={{
              background: 'linear-gradient(to right, #3b82f6, #f97316)',
            }}
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Quiet (blue)</span>
            <span>Busy (orange)</span>
          </div>
          <div className="mb-1 mt-2 text-xs text-muted-foreground">Link quality: Unhealthy → Healthy</div>
          <div
            className="h-2 w-full rounded"
            style={{
              background: 'linear-gradient(to right, #ef4444, #22c55e)',
            }}
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Unhealthy (red)</span>
            <span>Healthy (green)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type EdgeMetric = 'packets' | 'snr';

export interface TracerouteHeatmapChromeProps {
  viewMode: HeatmapViewMode;
  edgeMetric: EdgeMetric;
  searchSuffix: string;
  timeRange: '24h' | '7d' | '30d' | 'custom';
  onTimeRangeChange: (v: '24h' | '7d' | '30d' | 'custom') => void;
  strategyTokens: TracerouteStrategyValue[];
  sourceMeshId: number | null;
  managedNodes: ManagedNode[];
  hasGeoFilters: boolean;
  onUpdateParams: (patch: Record<string, string | null>) => void;
}

function toggleValue<T extends string>(current: T[], value: T): T[] {
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export function TracerouteHeatmapChrome({
  viewMode,
  edgeMetric,
  searchSuffix,
  timeRange,
  onTimeRangeChange,
  strategyTokens,
  sourceMeshId,
  managedNodes,
  hasGeoFilters,
  onUpdateParams,
}: TracerouteHeatmapChromeProps) {
  const navigate = useNavigate();
  const meshViewValue = `${viewMode}-${edgeMetric}`;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <RouteIcon className="h-6 w-6" />
        <h1 className="text-xl font-semibold sm:text-2xl">Traceroute mesh</h1>
      </div>
      <div className="flex flex-wrap items-center gap-4" data-testid="heatmap-filters">
        <div className="w-full min-w-[min(100%,280px)] sm:w-auto sm:min-w-[280px]">
          <Select
            value={meshViewValue}
            onValueChange={(v) => {
              const opt = MESH_VIEW_OPTIONS.find((o) => o.value === v);
              if (opt) navigate(`${opt.path}${searchSuffix}`);
            }}
          >
            <SelectTrigger data-testid="heatmap-mesh-view-select" aria-label="Mesh visualization">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESH_VIEW_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-auto sm:min-w-[180px]">
          <Select value={timeRange} onValueChange={(v) => onTimeRangeChange(v as '24h' | '7d' | '30d' | 'custom')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Select
          value={sourceMeshId != null ? String(sourceMeshId) : 'all'}
          onValueChange={(v) => onUpdateParams({ source: v === 'all' ? null : v })}
        >
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="heatmap-source-select">
            <SelectValue placeholder="Source feeder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {managedNodes.map((n) => (
              <SelectItem key={n.meshtastic_node_id} value={String(n.meshtastic_node_id)}>
                {n.short_name ?? n.node_id_str ?? String(n.meshtastic_node_id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full sm:w-[180px] justify-between" type="button">
              {multiSelectLabel(strategyTokens, HEATMAP_STRATEGY_OPTIONS, 'Strategy')}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Strategy</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {HEATMAP_STRATEGY_OPTIONS.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={strategyTokens.includes(opt.value)}
                onCheckedChange={() => {
                  const next = toggleValue(strategyTokens, opt.value);
                  onUpdateParams({
                    strategy: next.join(',') || null,
                  });
                }}
                onSelect={(e) => e.preventDefault()}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasGeoFilters && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onUpdateParams({ strategy: null, source: null })}
            data-testid="heatmap-clear-geo-filters"
          >
            <X className="mr-1 h-4 w-4" />
            Clear geo filters
          </Button>
        )}
      </div>
    </div>
  );
}
