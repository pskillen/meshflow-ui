import type { StatsRangeWindow, StatsBucket } from '@/lib/stats-range';
import { TREND_BUCKET_MS, type TrendInputRow } from '@/lib/stats-trend';
import type { NodeTracerouteLinkEdge, NodeTracerouteLinkSnrHistory } from '@/hooks/api/useNodeTracerouteLinks';

export interface SnrPoint {
  triggered_at: string;
  snr: number;
}

/** Row keys for the two directions of a link chart. */
export const SNR_IN = 'inbound';
export const SNR_OUT = 'outbound';

/** Peer name for titles: the short name, or the hex node id when it has none. */
export function peerLabel(link: Pick<NodeTracerouteLinkSnrHistory, 'peer_node_id' | 'peer_short_name'>): string {
  return link.peer_short_name || `!${link.peer_node_id.toString(16)}`;
}

/**
 * Mean SNR per UTC bucket, for one link: traceroutes are sparse and irregular, so each bucket on the shared grid
 * shows the mean of the samples in it (a bucket with none is a gap). Samples before the window or after the end of the last drawn bucket are ignored.
 */
export function bucketLinkSnr(
  link: Pick<NodeTracerouteLinkSnrHistory, 'inbound' | 'outbound'>,
  window: Pick<StatsRangeWindow, 'start' | 'end' | 'lastBucketStart' | 'partialEnd'>,
  bucket: StatsBucket
): TrendInputRow[] {
  const step = TREND_BUCKET_MS[bucket];
  const startMs = window.start.getTime();
  // `end` is the top of the current hour. When a 6h or daily bucket is in progress it runs on past it and is drawn
  // (dashed), so samples count up to its end; otherwise anything at or after `end` is off the chart's grid.
  const endMs = window.partialEnd ? window.lastBucketStart.getTime() + step : window.end.getTime();
  const acc = new Map<number, Record<string, { sum: number; n: number }>>();
  const add = (points: SnrPoint[], key: string) => {
    for (const p of points) {
      const t = new Date(p.triggered_at).getTime();
      if (Number.isNaN(t) || t < startMs || t >= endMs || typeof p.snr !== 'number') continue;
      const ts = startMs + Math.floor((t - startMs) / step) * step;
      const row = acc.get(ts) ?? {};
      const cell = row[key] ?? { sum: 0, n: 0 };
      cell.sum += p.snr;
      cell.n += 1;
      row[key] = cell;
      acc.set(ts, row);
    }
  };
  add(link.inbound, SNR_IN);
  add(link.outbound, SNR_OUT);
  return [...acc.entries()]
    .sort(([a], [b]) => a - b)
    .map(([timestamp, row]) => {
      const out: TrendInputRow = { timestamp };
      for (const [key, { sum, n }] of Object.entries(row)) out[key] = sum / n;
      return out;
    });
}

/** Mean of a key over the rows that have it (what the chart draws), or null when none do. */
export function meanOfDrawn(rows: Array<Record<string, unknown>>, key: string): number | null {
  const values = rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number');
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** The strongest average SNR over any edge, either direction, or null when no edge has one. */
export function bestEdgeSnr(edges: Pick<NodeTracerouteLinkEdge, 'avg_snr_in' | 'avg_snr_out'>[]): number | null {
  const values = edges.flatMap((e) => [e.avg_snr_in, e.avg_snr_out]).filter((v): v is number => typeof v === 'number');
  return values.length ? Math.max(...values) : null;
}

/** Links most traced first, then the most recent: the order the cards are shown in. */
export function sortLinksByActivity(history: NodeTracerouteLinkSnrHistory[]): NodeTracerouteLinkSnrHistory[] {
  const latest = (h: NodeTracerouteLinkSnrHistory) =>
    Math.max(0, ...[...h.inbound, ...h.outbound].map((p) => new Date(p.triggered_at).getTime()));
  return history
    .map((h) => ({ h, total: h.inbound.length + h.outbound.length, latest: latest(h) }))
    .sort((a, b) => b.total - a.total || b.latest - a.latest)
    .map(({ h }) => h);
}

/** How many drawn values (either direction) lie outside `[min, max]`, so the card can say they are off the scale. */
export function countOffScale(
  rows: Array<Record<string, unknown>>,
  keys: string[],
  [min, max]: [number, number]
): number {
  return rows.reduce(
    (n, r) =>
      n + keys.filter((k) => typeof r[k] === 'number' && ((r[k] as number) < min || (r[k] as number) > max)).length,
    0
  );
}
