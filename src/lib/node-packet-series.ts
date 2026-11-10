import type { GlobalStats, PacketStatsInterval } from '@/lib/models';
import type { StatsBucket, StatsRangeWindow } from '@/lib/stats-range';
import {
  densifyTrendRows,
  markPartialBuckets,
  TREND_BUCKET_MS,
  type TrendInputRow,
  type TrendRow,
} from '@/lib/stats-trend';

/** One stack segment of a node's packet chart. Colours are the long-standing per-type colours, not chart tokens. */
export interface PacketTypeSeries {
  key: string;
  label: string;
  color: string;
}

/** Stack order, bottom to top. `OTHER` also takes any type not listed here. */
export const NODE_PACKET_TYPE_SERIES: PacketTypeSeries[] = [
  { key: 'text_message', label: 'Text Message', color: '#3b82f6' },
  { key: 'position', label: 'Position', color: '#10b981' },
  { key: 'device_metrics', label: 'Device Metrics', color: '#f59e0b' },
  { key: 'node_info', label: 'Node Info', color: '#8b5cf6' },
  { key: 'local_stats', label: 'Local Stats', color: '#ec4899' },
  { key: 'environment_metrics', label: 'Environment Metrics', color: '#ef4444' },
  { key: 'OTHER', label: 'Other', color: '#6b7280' },
];

const KNOWN = new Set(NODE_PACKET_TYPE_SERIES.map((s) => s.key));
const OTHER = 'OTHER';

/** The series to draw: stack order, without `OTHER` when it has no packets (the server only sends known types). */
export function packetTypeSeries(rows: TrendRow[]): PacketTypeSeries[] {
  const hasOther = rows.some((r) => typeof r[OTHER] === 'number' && (r[OTHER] as number) > 0);
  return hasOther ? NODE_PACKET_TYPE_SERIES : NODE_PACKET_TYPE_SERIES.filter((s) => s.key !== OTHER);
}

/**
 * The `interval_type` to ask for. Daily ranges ask for days; 24h and 7d ask for hours and are rolled up here,
 * because the API's `interval=6` leaves buckets hourly (it is never sent). Never send `interval > 1`.
 */
export function packetIntervalType(bucket: StatsBucket): 'hour' | 'day' {
  return bucket === 'daily' ? 'day' : 'hour';
}

/**
 * Roll the API's intervals up into one row per range bucket, a count per packet type. An interval lands in the
 * bucket that contains its start, so hourly rows fold into 6-hour buckets. Types outside the known set add to
 * `OTHER`. `total` is the sum of the bars the chart draws: intervals outside the window's bucket grid (the query
 * runs an hour past `window.end`) are left out of the rows and the total, as the chart would drop them anyway.
 */
export function buildPacketTypeRows(
  stats: Pick<GlobalStats, 'intervals'> | null | undefined,
  window: StatsRangeWindow,
  bucket: StatsBucket
): { rows: TrendRow[]; total: number } {
  const step = TREND_BUCKET_MS[bucket];
  const lo = window.start.getTime();
  const byTs = new Map<number, TrendInputRow>();
  for (const interval of (stats?.intervals ?? []) as unknown as PacketStatsInterval[]) {
    const ms = new Date(interval.start_date).getTime();
    if (!Number.isFinite(ms) || ms < lo) continue;
    const ts = Math.floor(ms / step) * step;
    const row = byTs.get(ts) ?? { timestamp: ts };
    for (const { packet_type, count } of interval.packet_types ?? []) {
      if (typeof count !== 'number' || !Number.isFinite(count)) continue;
      const key = KNOWN.has(packet_type) ? packet_type : 'OTHER';
      row[key] = (row[key] ?? 0) + count;
    }
    byTs.set(ts, row);
  }
  const sorted = [...byTs.values()].sort((a, b) => a.timestamp - b.timestamp);
  const marked = markPartialBuckets(sorted, window, bucket);
  const grid = new Set(densifyTrendRows([], window, bucket).map((r) => r.timestamp));
  const rows = marked.filter((r) => grid.has(r.timestamp));
  let total = 0;
  for (const row of rows) {
    for (const s of NODE_PACKET_TYPE_SERIES) total += typeof row[s.key] === 'number' ? (row[s.key] as number) : 0;
  }
  return { rows, total };
}
