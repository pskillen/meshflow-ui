import type { PaginatedResponse, StatsSnapshot } from '@/lib/models';

export type AggregationWindow = 'hourly' | '6h' | 'daily';

/**
 * Determine aggregation window based on time range span.
 * - <= 2 days: hourly (no aggregation)
 * - > 2 days and <= 8 days: 6-hour windows ("7 days" is exactly 168h; the margin tolerates custom ranges)
 * - > 8 days: daily (UTC midnight)
 */
export function getAggregationWindow(startDate: Date, endDate: Date): AggregationWindow {
  const spanHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  if (spanHours <= 48) return 'hourly';
  if (spanHours <= 192) return '6h'; // 8 days = 192h
  return 'daily';
}

const HOUR_MS = 3_600_000;

/**
 * Get the bucket start for a timestamp, in UTC: 6h buckets start at 00/06/12/18 UTC, daily at UTC midnight.
 * The API rolls up by UTC hour, 6h and UTC day, and the range windows (`statsRangeWindow`) are UTC too, so buckets
 * line up whatever the browser's time zone.
 */
export function getBucketStart(date: Date, window: '6h' | 'daily'): Date {
  const size = (window === 'daily' ? 24 : 6) * HOUR_MS;
  return new Date(Math.floor(date.getTime() / size) * size);
}

export interface RawDataPoint {
  timestamp: number;
  value: number;
  /**
   * How many hourly samples the value covers. Absent on raw hourly rows (counts as 1); present on rows the API
   * already rolled up (`bucket=1d`) and on the output of `aggregateStats`.
   */
  samples?: number;
}

function bucketKeyFor(window: AggregationWindow) {
  return (ts: number) => getBucketStart(new Date(ts), window === '6h' ? '6h' : 'daily').getTime();
}

/**
 * Aggregate hourly data (or rows the API already rolled up) into larger UTC buckets.
 * - packet_volume, new_nodes: SUM (cumulative over the bucket)
 * - online_nodes: AVERAGE (point-in-time counts), weighted by `samples` so rolled-up days merge correctly
 * Output points carry `samples`, so callers can tell a partial bucket from a whole one. Hourly input is returned as is.
 */
export function aggregateStats(
  points: RawDataPoint[],
  window: AggregationWindow,
  mode: 'sum' | 'average'
): RawDataPoint[] {
  if (window === 'hourly' || points.length === 0) return points;

  const bucketKey = bucketKeyFor(window);
  const buckets = new Map<number, { sum: number; weighted: number; samples: number }>();
  for (const p of points) {
    const key = bucketKey(p.timestamp);
    const weight = p.samples ?? 1;
    const existing = buckets.get(key) ?? { sum: 0, weighted: 0, samples: 0 };
    existing.sum += p.value;
    existing.weighted += p.value * weight;
    existing.samples += weight;
    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .map(([ts, { sum, weighted, samples }]) => ({
      timestamp: ts,
      value: mode === 'sum' ? sum : samples > 0 ? weighted / samples : 0,
      samples,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export interface ByTypeDataPoint {
  timestamp: number;
  byType: Record<string, number>;
}

/**
 * Aggregate by_type data into larger UTC buckets. Sums each type per bucket.
 */
export function aggregateStatsByType(points: ByTypeDataPoint[], window: AggregationWindow): ByTypeDataPoint[] {
  if (window === 'hourly' || points.length === 0) return points;

  const bucketKey = bucketKeyFor(window);
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

export function globalSnapshotRows(snapshots: PaginatedResponse<StatsSnapshot> | undefined): StatsSnapshot[] {
  if (!snapshots?.results) return [];
  return snapshots.results.filter((s) => s.constellation_id === null);
}

export function snapshotsToCountSeries(rows: StatsSnapshot[]): RawDataPoint[] {
  return [...rows]
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((s) => ({
      timestamp: new Date(s.recorded_at).getTime(),
      value: s.value?.count ?? 0,
      // Present only on rolled-up rows (bucket=1d): how many hourly samples the day covers.
      ...(typeof s.value?.samples === 'number' ? { samples: s.value.samples } : {}),
    }));
}

/** Merge MT and MC count series on timestamp for overlaid bar charts. */
export function mergeMeshtasticMeshcoreSeries(
  mt: RawDataPoint[],
  mc: RawDataPoint[]
): { timestamp: number; meshtastic: number; meshcore: number; samples?: number }[] {
  const byTs = new Map<number, { meshtastic: number; meshcore: number; samples?: number }>();
  for (const p of mt) {
    const row = byTs.get(p.timestamp) ?? { meshtastic: 0, meshcore: 0 };
    row.meshtastic = p.value;
    if (p.samples != null) row.samples = p.samples;
    byTs.set(p.timestamp, row);
  }
  for (const p of mc) {
    const row = byTs.get(p.timestamp) ?? { meshtastic: 0, meshcore: 0 };
    row.meshcore = p.value;
    if (p.samples != null) row.samples = Math.min(row.samples ?? p.samples, p.samples);
    byTs.set(p.timestamp, row);
  }
  return Array.from(byTs.entries())
    .map(([timestamp, vals]) => ({ timestamp, ...vals }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** Display names for packet types in charts */
export const PACKET_TYPE_DISPLAY_NAMES: Record<string, string> = {
  text_message: 'Messages',
  position: 'Position',
  node_info: 'Node Info',
  device_metrics: 'Device',
  local_stats: 'Local Stats',
  environment_metrics: 'Environment',
  traceroute: 'Traceroute',
};
