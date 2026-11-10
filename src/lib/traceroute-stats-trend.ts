import type { StatsBucket, StatsRangeKey, StatsRangeWindow } from '@/lib/stats-range';
import type { TrendRow } from '@/lib/stats-trend';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** One `success_over_time` row. `bucket_start` is present on hourly rows (`bucket=1h`); older APIs omit it. */
export interface OutcomeRow {
  date: string;
  bucket_start?: string;
  completed: number;
  failed: number;
}

/** Hourly rows are only requested (and only allowed by the API, up to 7 days) at 24h. */
export function wantsHourlyOutcomes(key: StatsRangeKey): boolean {
  return key === '24h';
}

export interface OutcomeTrend {
  bucket: Extract<StatsBucket, 'hourly' | 'daily'>;
  /** Grid for `TrendChart`: includes the bucket in progress. */
  window: Pick<StatsRangeWindow, 'start' | 'end'>;
  rows: TrendRow[];
  /** Hourly was asked for but the API sent daily rows (not deployed yet). */
  fellBack: boolean;
}

const floorTo = (ms: number, step: number) => Math.floor(ms / step) * step;

/**
 * Chart rows for the Outcomes chart.
 *
 * - 24h with `bucket_start` on every row: one bar per UTC hour, the current hour in progress.
 * - Everything else is UTC days (the API only buckets traceroutes by hour or day, so 7d is daily, not 6-hourly).
 *   The first day is partial when the range starts mid-day; the current day always is.
 * - 24h without `bucket_start`: daily fallback, `fellBack` set so the card can say so.
 */
export function buildOutcomeTrend(
  rows: readonly OutcomeRow[] | undefined,
  key: StatsRangeKey,
  window: StatsRangeWindow
): OutcomeTrend {
  const list = rows ?? [];
  const startMs = window.start.getTime();
  const endMs = window.end.getTime();
  const wantsHourly = wantsHourlyOutcomes(key);
  const hourly = wantsHourly && list.every((r) => r.bucket_start);

  if (hourly) {
    const out: TrendRow[] = list.map((r) => {
      const timestamp = Date.parse(r.bucket_start as string);
      return { timestamp, completed: r.completed, failed: r.failed, partial: timestamp >= endMs };
    });
    return {
      bucket: 'hourly',
      window: { start: window.start, end: new Date(endMs + HOUR_MS) },
      rows: out,
      fellBack: false,
    };
  }

  const dayStart = floorTo(startMs, DAY_MS);
  const lastDay = floorTo(endMs, DAY_MS);
  const out: TrendRow[] = list.map((r) => {
    const timestamp = floorTo(Date.parse(r.date), DAY_MS);
    return {
      timestamp,
      completed: r.completed,
      failed: r.failed,
      partial: timestamp >= lastDay || (timestamp === dayStart && startMs > dayStart),
    };
  });
  return {
    bucket: 'daily',
    window: { start: new Date(dayStart), end: new Date(lastDay + DAY_MS) },
    rows: out,
    fellBack: wantsHourly,
  };
}
