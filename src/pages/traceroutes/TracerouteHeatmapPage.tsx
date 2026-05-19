import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subHours, subDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { useHeatmapEdges } from '@/hooks/api/useHeatmapEdges';
import { useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { TracerouteHeatmapMap } from '@/components/traceroutes/TracerouteHeatmapMap';
import { TracerouteHeatmapBackboneRelayTable } from '@/components/traceroutes/TracerouteHeatmapBackboneRelayTable';
import {
  NetworkStatsCard,
  TracerouteHeatmapChrome,
  type EdgeMetric,
} from '@/components/traceroutes/TracerouteHeatmapChrome';
import type { HeatmapNode } from '@/hooks/api/useHeatmapEdges';
import type { TracerouteStrategyValue } from '@/lib/traceroute-strategy';

export type { EdgeMetric };

type TimeRange = '24h' | '7d' | '30d' | 'custom';

function parseCsvParam<T extends string>(raw: string | null): T[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as T[];
}

function parseSourceParam(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/** Client-side stale styling threshold (hours without mesh observation). */
const HEATMAP_STALE_THRESHOLD_HOURS = 6;

export function TracerouteHeatmapPage({ edgeMetric }: { edgeMetric: EdgeMetric }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const strategyTokens = parseCsvParam<TracerouteStrategyValue>(searchParams.get('strategy'));
  const sourceMeshId = parseSourceParam(searchParams.get('source'));

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === '') next.delete(key);
        else next.set(key, value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const triggeredAtAfter = useMemo(() => {
    if (timeRange === '24h') return subHours(new Date(), 24);
    if (timeRange === '7d') return subDays(new Date(), 7);
    if (timeRange === '30d') return subDays(new Date(), 30);
    return undefined;
  }, [timeRange]);

  const { managedNodes } = useManagedNodesSuspense({ pageSize: 500 });

  const { data, isLoading, error } = useHeatmapEdges({
    triggeredAtAfter,
    edgeMetric,
    sourceNodeId: sourceMeshId ?? undefined,
    targetStrategy: strategyTokens.length ? strategyTokens.join(',') : undefined,
  });

  const edges = data?.edges ?? [];
  const nodes = useMemo(() => data?.nodes ?? [], [data]);
  const meta = data?.meta ?? { active_nodes_count: 0, total_trace_routes_count: 0 };

  const hasGeoFilters = strategyTokens.length > 0 || sourceMeshId != null;

  const selectedRaw = searchParams.get('selected');
  const selectedNodeId = selectedRaw && /^\d+$/.test(selectedRaw.trim()) ? Number.parseInt(selectedRaw, 10) : null;
  const selectedNode: HeatmapNode | null =
    selectedNodeId != null ? (nodes.find((n) => n.meshtastic_node_id === selectedNodeId) ?? null) : null;

  useEffect(() => {
    if (selectedNodeId == null || nodes.length === 0) return;
    if (!nodes.some((n) => n.meshtastic_node_id === selectedNodeId)) {
      updateParams({ selected: null });
    }
  }, [nodes, selectedNodeId, updateParams]);

  const searchSuffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const topologyLink = {
    to: `${edgeMetric === 'packets' ? '/traceroutes/map/topology/heat' : '/traceroutes/map/topology/snr'}${searchSuffix}`,
    label: 'Topology view',
  };

  return (
    <div className="flex min-h-[50vh] flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
      <TracerouteHeatmapChrome
        viewMode="map"
        edgeMetric={edgeMetric}
        searchSuffix={searchSuffix}
        timeRange={timeRange}
        onTimeRangeChange={(v) => setTimeRange(v)}
        strategyTokens={strategyTokens}
        sourceMeshId={sourceMeshId}
        managedNodes={managedNodes}
        hasGeoFilters={hasGeoFilters}
        onUpdateParams={updateParams}
      />

      <div className="block md:hidden">
        <NetworkStatsCard meta={meta} staleThresholdHours={HEATMAP_STALE_THRESHOLD_HOURS} />
      </div>

      <div className="relative flex-1 min-h-[300px] md:min-h-[calc(100dvh-16rem)]" data-testid="heatmap-map">
        <Card className="h-full min-h-[300px]">
          <CardContent className="h-full p-0">
            {error && (
              <div className="flex h-full min-h-[300px] items-center justify-center text-destructive">
                Failed to load heatmap: {error instanceof Error ? error.message : 'Unknown error'}
              </div>
            )}
            {isLoading && (
              <div className="flex h-full min-h-[300px] items-center justify-center text-muted-foreground">
                Loading heatmap data...
              </div>
            )}
            {!error && !isLoading && (
              <TracerouteHeatmapMap
                edges={edges}
                nodes={nodes}
                edgeMetric={edgeMetric}
                staleThresholdHours={HEATMAP_STALE_THRESHOLD_HOURS}
                selectedNode={selectedNode}
                onSelectedNodeChange={(node) =>
                  updateParams({ selected: node ? String(node.meshtastic_node_id) : null })
                }
                topologyLink={topologyLink}
              />
            )}
          </CardContent>
        </Card>

        <div className="absolute right-4 top-4 z-10 hidden md:block">
          <NetworkStatsCard meta={meta} staleThresholdHours={HEATMAP_STALE_THRESHOLD_HOURS} className="w-64" />
        </div>
      </div>

      {!error && !isLoading && <TracerouteHeatmapBackboneRelayTable nodes={nodes} />}
    </div>
  );
}
