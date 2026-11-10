'use client';

import * as React from 'react';
import { Link } from 'react-router-dom';
import { ChartCard } from '@/components/stats/ChartCard';
import { useNeighbourStats } from '@/hooks/api/usePacketStats';
import type { StatsRange } from '@/hooks/useStatsRange';
import { NEIGHBOUR_BARS_SHOWN, neighbourSourceLabel } from '@/lib/neighbour-sources';
import { nodeDetailPath } from '@/lib/node-detail-routes';
import { metricQueryEnd } from '@/lib/node-metric-series';

const LSB_EXPLANATION =
  "For multi-hop packets, the radio header only stores the last byte (LSB) of the relay node's ID to save bandwidth. Several nodes can share the same last byte, so we list all possible matches from nodes we've seen on the mesh.";

const nf = new Intl.NumberFormat('en-GB');

/**
 * "Heard most from": the neighbours a managed node received the most packets from over the page's range, as ranked
 * horizontal bars (the largest is the full width). See NeighbourSourceBars.md.
 */
export function NeighbourSourceBars({ nodeId, range }: { nodeId: number; range: StatsRange }) {
  const { window } = range;
  const {
    data: stats,
    isLoading,
    error,
  } = useNeighbourStats({
    nodeId,
    startDate: window.start,
    endDate: metricQueryEnd(window),
    enabled: true,
  });

  const ranked = React.useMemo(
    () => [...(stats?.by_source ?? [])].filter((s) => s.count > 0).sort((a, b) => b.count - a.count),
    [stats]
  );
  const shown = ranked.slice(0, NEIGHBOUR_BARS_SHOWN);
  const rest = ranked.slice(NEIGHBOUR_BARS_SHOWN);
  const restCount = rest.reduce((sum, s) => sum + s.count, 0);
  const max = shown[0]?.count ?? 0;
  const total = ranked.reduce((sum, s) => sum + s.count, 0);

  let body: React.ReactNode;
  if (isLoading) {
    body = <Placeholder>Loading…</Placeholder>;
  } else if (error) {
    body = <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
  } else if (shown.length === 0) {
    body = <Placeholder>No packets received from neighbours in the {range.longLabel}.</Placeholder>;
  } else {
    body = (
      <>
        <ol className="space-y-2" data-testid="neighbour-bars-list">
          {shown.map((item) => (
            <li key={`${item.source_type}-${item.source}`} className="space-y-1" data-testid="neighbour-bars-row">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium">{neighbourSourceLabel(item)}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{nf.format(item.count)} packets</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${max > 0 ? (item.count / max) * 100 : 0}%`,
                    backgroundColor: 'hsl(var(--chart-1))',
                  }}
                />
              </div>
              {item.candidates.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.candidates.map((c) => (
                    <Link
                      key={c.meshtastic_node_id}
                      to={
                        nodeDetailPath({
                          meshtastic_node_id: c.meshtastic_node_id,
                          node_id_str: c.node_id_str,
                          protocol: 1,
                        }) ?? '#'
                      }
                      className="rounded bg-muted px-1.5 py-0.5 text-xs text-teal-600 hover:underline dark:text-teal-400"
                    >
                      {c.short_name || c.node_id_str}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
        {rest.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground" data-testid="neighbour-bars-rest">
            and {rest.length} more, {nf.format(restCount)} packets
          </p>
        )}
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Why some sources are "LSB"</summary>
          <p className="mt-1">{LSB_EXPLANATION}</p>
        </details>
      </>
    );
  }

  return (
    <ChartCard
      title="Heard most from"
      headline={total > 0 ? `${nf.format(total)} packets` : undefined}
      measure={`Packets received from each neighbour (direct or last hop), ${range.longLabel}`}
      data-testid="chart-node-neighbours"
    >
      {body}
    </ChartCard>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[120px] items-center justify-center rounded-md bg-muted/40 px-3 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
