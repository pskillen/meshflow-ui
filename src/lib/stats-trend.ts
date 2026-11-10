import type { StatsBucket, StatsRangeWindow } from '@/lib/stats-range';

const HOUR_MS = 3_600_000;

/** What a bucket is, in words, for "per ..." captions. */
export function bucketPhrase(bucket: StatsBucket): string {
  if (bucket === 'hourly') return 'hour';
  if (bucket === '6h') return '6-hour bucket';
  return 'UTC day';
}

/** Bucket length in ms. */
export const TREND_BUCKET_MS: Record<StatsBucket, number> = {
  hourly: HOUR_MS,
  '6h': 6 * HOUR_MS,
  daily: 24 * HOUR_MS,
};

/** Hourly samples a whole bucket should hold. */
export const TREND_BUCKET_SAMPLES: Record<StatsBucket, number> = { hourly: 1, '6h': 6, daily: 24 };

/** One chart row: a bucket start, one number per series key, and whether the bucket is incomplete. */
export interface TrendRow {
  timestamp: number;
  /** True when the bucket is still in progress or only partly covered by data. */
  partial?: boolean;
  [seriesKey: string]: number | boolean | undefined;
}

/** A row as the data layer builds it: values plus how many hourly samples they cover, when known. */
export interface TrendInputRow {
  timestamp: number;
  samples?: number;
  [seriesKey: string]: number | undefined;
}

/**
 * Every bucket start in the window, oldest first. `start` is expected to be bucket-aligned (`statsRangeWindow`
 * does that). A bucket that is still in progress at `end` is included, because its start is before `end`.
 */
export function buildBucketGrid(window: Pick<StatsRangeWindow, 'start' | 'end'>, bucket: StatsBucket): number[] {
  const step = TREND_BUCKET_MS[bucket];
  const out: number[] = [];
  for (let t = window.start.getTime(); t < window.end.getTime(); t += step) out.push(t);
  return out;
}

/**
 * Flag partial buckets, so charts can mark them:
 * - the bucket in progress at the end of the window (`window.partialEnd`, from `lastBucketStart`);
 * - the first bucket when its rows cover fewer hourly samples than a whole bucket (data starts mid-bucket).
 * A gap in the middle of the range is not flagged: it is missing data, not an incomplete bucket.
 */
export function markPartialBuckets(
  rows: TrendInputRow[],
  window: Pick<StatsRangeWindow, 'start' | 'partialEnd' | 'lastBucketStart'>,
  bucket: StatsBucket
): TrendRow[] {
  const whole = TREND_BUCKET_SAMPLES[bucket];
  const firstTs = window.start.getTime();
  const lastTs = window.lastBucketStart.getTime();
  return rows.map(({ samples, ...rest }) => {
    const inProgress = window.partialEnd && rest.timestamp >= lastTs;
    const thin = rest.timestamp === firstTs && samples != null && samples < whole;
    return { ...rest, partial: inProgress || thin };
  });
}

/**
 * Lay rows out on the full bucket grid, so every chart on a screen has the same x positions (shared hover) and
 * missing buckets show as gaps rather than shifting neighbours. Rows outside the grid are dropped.
 */
export function densifyTrendRows(
  rows: TrendRow[],
  window: Pick<StatsRangeWindow, 'start' | 'end'>,
  bucket: StatsBucket
): TrendRow[] {
  const byTs = new Map(rows.map((r) => [r.timestamp, r]));
  return buildBucketGrid(window, bucket).map((timestamp) => byTs.get(timestamp) ?? { timestamp });
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function utcFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' });
    fmtCache.set(key, f);
  }
  return f;
}

/** Short x-axis label for a bucket start, in UTC (the buckets are UTC). */
export function formatTrendTick(timestamp: number, bucket: StatsBucket): string {
  const d = new Date(timestamp);
  if (bucket === 'hourly') return utcFormat({ hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  if (bucket === '6h') return utcFormat({ weekday: 'short', day: 'numeric', hour: '2-digit', hour12: false }).format(d);
  return utcFormat({ day: 'numeric', month: 'short' }).format(d);
}

/** Full tooltip label: the bucket's span, in UTC. */
export function formatTrendLabel(timestamp: number, bucket: StatsBucket): string {
  const d = new Date(timestamp);
  const day = utcFormat({ weekday: 'short', day: 'numeric', month: 'short' }).format(d);
  if (bucket === 'daily') return `${day} (UTC day)`;
  const time = (ms: number) => utcFormat({ hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
  return `${day} ${time(timestamp)}-${time(timestamp + TREND_BUCKET_MS[bucket])} UTC`;
}

/** Compact number for axis ticks: 1200 -> 1.2k. */
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(value);
}

/** Suffix of the extra dashed-line field `splitPartialLine` adds per series. */
export const PARTIAL_LINE_SUFFIX = '__partial';

/**
 * Prepare rows for a line chart that draws partial buckets dashed. Per series key the solid field is null on partial
 * rows, and `<key>__partial` holds the partial rows plus their neighbours so the dashed stretch joins the solid line.
 */
export function splitPartialLine(rows: TrendRow[], keys: readonly string[]): Record<string, number | boolean | null>[] {
  return rows.map((row, i) => {
    const out: Record<string, number | boolean | null> = { timestamp: row.timestamp, partial: row.partial === true };
    const touchesPartial = row.partial === true || rows[i - 1]?.partial === true || rows[i + 1]?.partial === true;
    for (const key of keys) {
      const v = row[key];
      const value = typeof v === 'number' ? v : null;
      out[key] = row.partial ? null : value;
      out[`${key}${PARTIAL_LINE_SUFFIX}`] = touchesPartial ? value : null;
    }
    return out;
  });
}

const countFormat = new Intl.NumberFormat('en-GB');

/**
 * Words for a screen reader. `name` is the chart's accessible name: the title and range (`label`), one value per
 * bucket size, the headline, the latest bucket's values and whether the last bucket is still in progress. `table`
 * has one row per bucket on the grid, with "no data" for gaps.
 */
export function describeTrend(args: {
  label?: string;
  headline?: string;
  bucket: StatsBucket;
  rows: TrendRow[];
  series: { key: string; label: string }[];
}): { name: string; table: { timestamp: number; label: string; cells: string[] }[] } {
  const { label, headline, bucket, rows, series } = args;
  const valueOf = (row: TrendRow, key: string) => (typeof row[key] === 'number' ? (row[key] as number) : null);
  const withData = (row: TrendRow) => series.some((s) => valueOf(row, s.key) != null);

  const parts = [`${label ?? 'Chart'}.`, `One value per ${bucketPhrase(bucket)}.`];
  if (headline) parts.push(`${headline}.`);
  const latest = [...rows].reverse().find(withData);
  if (latest) {
    const values = series
      .map((s) => ({ s, v: valueOf(latest, s.key) }))
      .filter((x) => x.v != null)
      .map((x) => `${x.s.label} ${countFormat.format(x.v!)}`)
      .join(', ');
    parts.push(`Latest, ${formatTrendLabel(latest.timestamp, bucket)}: ${values}.`);
  }
  if (rows[rows.length - 1]?.partial) parts.push('The last bucket is in progress.');

  const table = rows.map((row) => ({
    timestamp: row.timestamp,
    label: `${formatTrendLabel(row.timestamp, bucket)}${row.partial ? ' (partial)' : ''}`,
    cells: series.map((s) => {
      const v = valueOf(row, s.key);
      return v == null ? 'no data' : countFormat.format(v);
    }),
  }));
  return { name: parts.join(' '), table };
}

/**
 * X ticks for a bucket grid: at most about six, a whole number of buckets apart starting at the first, so the labels
 * are evenly spaced (a "preserve start and end" tick on a grid that does not divide evenly leaves an odd last gap).
 */
export function evenTrendTicks(timestamps: number[]): number[] {
  const stride = Math.max(1, Math.ceil(timestamps.length / 6));
  return timestamps.filter((_, i) => i % stride === 0);
}
