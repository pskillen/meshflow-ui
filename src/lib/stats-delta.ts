import { globalSnapshotRows, snapshotsToCountSeries, type RawDataPoint } from '@/lib/stats-aggregation';
import type { ComparisonWindows, StatsBucket } from '@/lib/stats-range';
import type { MeshStatsProtocolScope, StatsSnapshotStatType } from '@/lib/stats-snapshot-types';
import { TREND_BUCKET_SAMPLES } from '@/lib/stats-trend';
import { seriesForScope, type SnapshotPages } from '@/lib/stats-trend-data';

export type PeriodDelta =
  | { kind: 'change'; pct: number; current: number; previous: number }
  | { kind: 'none'; reason: 'loading' | 'no-previous-data' | 'thin-coverage' | 'truncated' };

const MINUS = '−';

interface Side {
  value: number;
  coverage: number;
  truncated: boolean;
}

function measureSide(args: {
  pages: SnapshotPages;
  scope: MeshStatsProtocolScope;
  mtStat: StatsSnapshotStatType;
  mcStat: StatsSnapshotStatType;
  mode: 'sum' | 'average';
  start: number;
  end: number;
  buckets: number;
  bucket: StatsBucket;
}): Side {
  const { pages, scope, mtStat, mcStat, mode, start, end, buckets, bucket } = args;
  let value = 0;
  let coverage = Infinity;
  let truncated = false;
  const expectedPerProtocol = buckets * TREND_BUCKET_SAMPLES[bucket];
  const series = seriesForScope(scope);
  for (const s of series) {
    const page = pages[s.key === 'meshtastic' ? mtStat : mcStat];
    truncated ||= !!page && page.count > page.results.length;
    const points: RawDataPoint[] = snapshotsToCountSeries(globalSnapshotRows(page)).filter(
      (p) => p.timestamp >= start && p.timestamp < end
    );
    let sum = 0;
    let weighted = 0;
    let n = 0;
    for (const p of points) {
      const w = p.samples ?? 1;
      sum += p.value;
      weighted += p.value * w;
      n += w;
    }
    // Flows are scaled to the full window, so a side with a few missing hours is not read as a drop in traffic.
    value += mode === 'sum' ? (n > 0 ? (sum * expectedPerProtocol) / n : 0) : n > 0 ? weighted / n : 0;
    // Each protocol must be covered on its own: one full protocol must not hide a hole in the other.
    coverage = Math.min(coverage, expectedPerProtocol > 0 ? n / expectedPerProtocol : 0);
  }
  return { value, coverage: Number.isFinite(coverage) ? coverage : 0, truncated };
}

/**
 * Change of the current period against the one before, from whole buckets on both sides. Works from the snapshot pages
 * (not the trend rows, which lose `samples`). Flows sum (scaled to the full window when some hours are missing), gauges take the sample-weighted mean; protocols add up to
 * match the headline. Neutral when either side has too little data, a page is truncated, or the previous value is 0.
 */
export function comparePeriods(args: {
  currentPages: SnapshotPages;
  previousPages: SnapshotPages | undefined;
  scope: MeshStatsProtocolScope;
  mtStat: StatsSnapshotStatType;
  mcStat: StatsSnapshotStatType;
  mode: 'sum' | 'average';
  windows: ComparisonWindows;
  bucket: StatsBucket;
  minCoverage?: number;
}): PeriodDelta {
  const { currentPages, previousPages, scope, mtStat, mcStat, mode, windows, bucket } = args;
  const minCoverage = args.minCoverage ?? 0.9;
  if (!previousPages || windows.buckets === 0) return { kind: 'none', reason: 'loading' };
  const base = { scope, mtStat, mcStat, mode, buckets: windows.buckets, bucket };
  const cur = measureSide({
    ...base,
    pages: currentPages,
    start: windows.current.start.getTime(),
    end: windows.current.end.getTime(),
  });
  const prev = measureSide({
    ...base,
    pages: previousPages,
    start: windows.previous.start.getTime(),
    end: windows.previous.end.getTime(),
  });
  if (cur.truncated || prev.truncated) return { kind: 'none', reason: 'truncated' };
  if (cur.coverage < minCoverage || prev.coverage < minCoverage) return { kind: 'none', reason: 'thin-coverage' };
  if (prev.value === 0) return { kind: 'none', reason: 'no-previous-data' };
  const pct = Math.round(((cur.value - prev.value) / prev.value) * 100);
  return { kind: 'change', pct, current: cur.value, previous: prev.value };
}

/** Why there is no comparison, for a tooltip beside the short "No comparison" text. */
export function describeNoComparison(delta: Extract<PeriodDelta, { kind: 'none' }>): string | undefined {
  switch (delta.reason) {
    case 'truncated':
      return 'The range only partly loaded, so it cannot be compared.';
    case 'no-previous-data':
      return 'There was nothing to compare against in the previous period.';
    case 'thin-coverage':
      return 'Too little data in one of the two periods to compare them.';
    default:
      return undefined;
  }
}

/** "+12% vs previous 7d", "−4% vs previous 7d", "No change vs previous 7d", or a neutral no-comparison line. */
export function formatDelta(delta: PeriodDelta, rangeLabel: string): string | undefined {
  if (delta.kind === 'none') {
    if (delta.reason === 'loading') return undefined;
    return 'No comparison';
  }
  if (delta.pct === 0) return `No change vs previous ${rangeLabel}`;
  return `${delta.pct > 0 ? '+' : MINUS}${Math.abs(delta.pct)}% vs previous ${rangeLabel}`;
}
