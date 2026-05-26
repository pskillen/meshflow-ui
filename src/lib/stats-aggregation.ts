import { startOfDay } from 'date-fns';

export type AggregationWindow = 'hourly' | '6h' | 'daily';

/**
 * Determine aggregation window based on time range span.
 * - <= 2 days: hourly (no aggregation)
 * - > 2 days and <= 8 days: 6-hour windows (covers "7 days" which can span up to ~8 days)
 * - > 8 days: daily (local midnight)
 */
export function getAggregationWindow(startDate: Date, endDate: Date): AggregationWindow {
  const spanHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  if (spanHours <= 48) return 'hourly';
  if (spanHours <= 192) return '6h'; // 8 days = 192h; ensures "7 days" uses 6h bins
  return 'daily';
}

/**
 * Get the bucket start (local midnight or 6h boundary) for a given date.
 * For 6h: 00:00, 06:00, 12:00, 18:00
 * For daily: 00:00 (start of day)
 */
export function getBucketStart(date: Date, window: '6h' | 'daily'): Date {
  const d = new Date(date);
  if (window === 'daily') {
    return startOfDay(d);
  }
  // 6h: floor hour to 0, 6, 12, 18
  const hours = d.getHours();
  const bucketHour = Math.floor(hours / 6) * 6;
  d.setHours(bucketHour, 0, 0, 0);
  return d;
}

export interface RawDataPoint {
  timestamp: number;
  value: number;
}

/**
 * Aggregate raw hourly data into larger windows.
 * - packet_volume: SUM (cumulative over window)
 * - online_nodes: AVERAGE (point-in-time counts)
 */
export function aggregateStats(
  points: RawDataPoint[],
  window: AggregationWindow,
  mode: 'sum' | 'average'
): RawDataPoint[] {
  if (window === 'hourly' || points.length === 0) return points;

  const bucketKey = (ts: number) => {
    const d = getBucketStart(new Date(ts), window === '6h' ? '6h' : 'daily');
    return d.getTime();
  };

  const buckets = new Map<number, { sum: number; count: number }>();
  for (const p of points) {
    const key = bucketKey(p.timestamp);
    const existing = buckets.get(key) ?? { sum: 0, count: 0 };
    existing.sum += p.value;
    existing.count += 1;
    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .map(([ts, { sum, count }]) => ({
      timestamp: ts,
      value: mode === 'sum' ? sum : sum / count,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export interface ByTypeDataPoint {
  timestamp: number;
  byType: Record<string, number>;
}

/**
 * Aggregate by_type data into larger windows. Sums each type per bucket.
 */
export function aggregateStatsByType(points: ByTypeDataPoint[], window: AggregationWindow): ByTypeDataPoint[] {
  if (window === 'hourly' || points.length === 0) return points;

  const bucketKey = (ts: number) => {
    const d = getBucketStart(new Date(ts), window === '6h' ? '6h' : 'daily');
    return d.getTime();
  };

  const buckets = new Map<number, Record<string, number>>();
  for (const p of points) {
    const key = bucketKey(p.timestamp);
    const existing = buckets.get(key) ?? {};
    for (const [k, v] of Object.entries(p.byType)) {
      existing[k] = (existing[k] ?? 0) + v;
    }
    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .map(([ts, byType]) => ({ timestamp: ts, byType }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** Display names for packet types in charts */
import type { PaginatedResponse, StatsSnapshot } from '@/lib/models';

export function globalSnapshotRows(snapshots: PaginatedResponse<StatsSnapshot> | undefined): StatsSnapshot[] {
  if (!snapshots?.results) return [];
  return snapshots.results.filter((s) => s.constellation_id === null);
}

export function snapshotsToCountSeries(rows: StatsSnapshot[]): { timestamp: number; value: number }[] {
  return [...rows]
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((s) => ({
      timestamp: new Date(s.recorded_at).getTime(),
      value: s.value?.count ?? 0,
    }));
}

/** Merge MT and MC count series on timestamp for overlaid bar charts. */
export function mergeMeshtasticMeshcoreSeries(
  mt: { timestamp: number; value: number }[],
  mc: { timestamp: number; value: number }[]
): { timestamp: number; meshtastic: number; meshcore: number }[] {
  const byTs = new Map<number, { meshtastic: number; meshcore: number }>();
  for (const p of mt) {
    const row = byTs.get(p.timestamp) ?? { meshtastic: 0, meshcore: 0 };
    row.meshtastic = p.value;
    byTs.set(p.timestamp, row);
  }
  for (const p of mc) {
    const row = byTs.get(p.timestamp) ?? { meshtastic: 0, meshcore: 0 };
    row.meshcore = p.value;
    byTs.set(p.timestamp, row);
  }
  return Array.from(byTs.entries())
    .map(([timestamp, vals]) => ({ timestamp, ...vals }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export const PACKET_TYPE_DISPLAY_NAMES: Record<string, string> = {
  text_message: 'Messages',
  position: 'Position',
  node_info: 'Node Info',
  device_metrics: 'Device',
  local_stats: 'Local Stats',
  environment_metrics: 'Environment',
  traceroute: 'Traceroute',
};
