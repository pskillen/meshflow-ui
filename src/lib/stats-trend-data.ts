import type { PaginatedResponse, StatsSnapshot } from '@/lib/models';
import {
  aggregateStats,
  aggregateStatsByType,
  globalSnapshotRows,
  snapshotsToCountSeries,
  type RawDataPoint,
} from '@/lib/stats-aggregation';
import type { StatsSnapshotStatType, MeshStatsProtocolScope } from '@/lib/stats-snapshot-types';
import type { StatsBucket, StatsRangeWindow } from '@/lib/stats-range';
import type { StatsSnapshotsParams } from '@/lib/types';
import { markPartialBuckets, type TrendInputRow, type TrendRow } from '@/lib/stats-trend';

type SnapshotPage = PaginatedResponse<StatsSnapshot> | undefined;
export type SnapshotPages = Partial<Record<StatsSnapshotStatType, SnapshotPage>>;

/** Protocol colours, the same on every dashboard: Meshtastic chart-1, MeshCore chart-4. */
export const PROTOCOL_SERIES = {
  meshtastic: { key: 'meshtastic', label: 'Meshtastic', color: 'hsl(var(--chart-1))' },
  meshcore: { key: 'meshcore', label: 'MeshCore', color: 'hsl(var(--chart-4))' },
} as const;

/** The series a scope draws: one per protocol shown. */
export function seriesForScope(scope: MeshStatsProtocolScope) {
  if (scope === 'meshtastic') return [PROTOCOL_SERIES.meshtastic];
  if (scope === 'meshcore') return [PROTOCOL_SERIES.meshcore];
  return [PROTOCOL_SERIES.meshtastic, PROTOCOL_SERIES.meshcore];
}

/**
 * Snapshot query for a range. Daily ranges (30d, 90d) ask the API for UTC-day rollups so 90 days fits one page;
 * `recordedAtAfter` is always sent because the API requires it with `bucket`. The other ranges read hourly rows and
 * aggregate here. An API that ignores `bucket` returns hourly rows, which `buildCountRows` aggregates the same way.
 */
export function snapshotParamsForRange(
  window: Pick<StatsRangeWindow, 'start' | 'end'>,
  bucket: StatsBucket
): Omit<StatsSnapshotsParams, 'statType'> {
  return {
    constellationId: -1,
    recordedAtAfter: window.start,
    recordedAtBefore: window.end,
    page_size: 1000,
    ...(bucket === 'daily' ? { bucket: '1d' as const } : {}),
  };
}

/** What a bucket is, in words, for "per ..." captions. */
export function bucketPhrase(bucket: StatsBucket): string {
  if (bucket === 'hourly') return 'hour';
  if (bucket === '6h') return '6-hour bucket';
  return 'UTC day';
}

export interface CountTrend {
  rows: TrendRow[];
  /** Latest bucket with data, or null. */
  latest: number | null;
  /** Whether any bucket is partial. */
  hasPartial: boolean;
  /** Snapshot rows the API has beyond what one page returned (an API without rollups on a long range). */
  truncated: boolean;
}

function pageTruncated(page: SnapshotPage): boolean {
  return !!page && page.count > page.results.length;
}

function mergeSeries(parts: { key: string; points: RawDataPoint[] }[]): TrendInputRow[] {
  const byTs = new Map<number, TrendInputRow>();
  for (const { key, points } of parts) {
    for (const p of points) {
      const row = byTs.get(p.timestamp) ?? { timestamp: p.timestamp };
      row[key] = p.value;
      if (p.samples != null) row.samples = Math.min(row.samples ?? p.samples, p.samples);
      byTs.set(p.timestamp, row);
    }
  }
  return Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function finish(rows: TrendInputRow[], window: StatsRangeWindow, bucket: StatsBucket, truncated: boolean): CountTrend {
  const marked = markPartialBuckets(rows, window, bucket);
  return {
    rows: marked,
    latest: marked.length ? marked[marked.length - 1]!.timestamp : null,
    hasPartial: marked.some((r) => r.partial),
    truncated,
  };
}

/**
 * Per-bucket counts for the scope's protocols. Gauges (`online_nodes`) average over a bucket, flows (`new_nodes`,
 * `packet_volume`) sum. Works on hourly rows or on rows the API already rolled up. Values are rounded to whole numbers.
 */
export function buildCountRows(args: {
  pages: SnapshotPages;
  scope: MeshStatsProtocolScope;
  mtStat: StatsSnapshotStatType;
  mcStat: StatsSnapshotStatType;
  mode: 'sum' | 'average';
  window: StatsRangeWindow;
  bucket: StatsBucket;
}): CountTrend {
  const { pages, scope, mtStat, mcStat, mode, window, bucket } = args;
  const parts: { key: string; points: RawDataPoint[] }[] = [];
  let truncated = false;
  for (const s of seriesForScope(scope)) {
    const stat = s.key === 'meshtastic' ? mtStat : mcStat;
    const page = pages[stat];
    truncated ||= pageTruncated(page);
    const points = aggregateStats(snapshotsToCountSeries(globalSnapshotRows(page)), bucket, mode).map((p) => ({
      ...p,
      value: Math.round(p.value),
    }));
    parts.push({ key: s.key, points });
  }
  return finish(mergeSeries(parts), window, bucket, truncated);
}

/** Per-bucket packet counts split by packet type, for one protocol. */
export function buildByTypeRows(args: {
  page: SnapshotPage;
  window: StatsRangeWindow;
  bucket: StatsBucket;
}): CountTrend {
  const { page, window, bucket } = args;
  const raw = globalSnapshotRows(page)
    .filter((s) => s.value?.by_type)
    .map((s) => ({
      timestamp: new Date(s.recorded_at).getTime(),
      byType: s.value.by_type!,
      ...(typeof s.value.samples === 'number' ? { samples: s.value.samples } : {}),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
  const rows: TrendInputRow[] = aggregateStatsByType(raw, bucket).map((p) => ({
    timestamp: p.timestamp,
    ...p.byType,
    ...(p.samples != null ? { samples: p.samples } : {}),
  }));
  return finish(rows, window, bucket, pageTruncated(page));
}

/** Sum of every series over every bucket (the headline of a flow chart). */
export function totalOf(rows: TrendRow[], keys: readonly string[]): number {
  return rows.reduce(
    (sum, r) => sum + keys.reduce((s, k) => s + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0),
    0
  );
}

/** Mean of each series over the buckets it has data for, added up (the headline of a gauge chart). */
export function meanOf(rows: TrendRow[], keys: readonly string[]): number {
  let total = 0;
  for (const k of keys) {
    const vals = rows.map((r) => r[k]).filter((v): v is number => typeof v === 'number');
    if (vals.length) total += vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return Math.round(total);
}
