/** The preset time ranges every stats screen offers. "All" is deliberately not one of them. */
export const STATS_PRESET_KEYS = ['24h', '7d', '30d', '90d'] as const;
export type StatsPresetKey = (typeof STATS_PRESET_KEYS)[number];

/** Rolling two hours from now. Node lists only: it matches "Online now". */
export const STATS_ONLINE_KEY = '2h' as const;

export type StatsRangeKey = StatsPresetKey | typeof STATS_ONLINE_KEY;

export const DEFAULT_STATS_RANGE: StatsPresetKey = '7d';

export type StatsBucket = 'hourly' | '6h' | 'daily';

/** The API's `bucket` query value for a node metric request (`1h`, `6h`, `1d`). */
export type MetricApiBucket = '1h' | '6h' | '1d';

const METRIC_API_BUCKET: Record<StatsBucket, MetricApiBucket> = { hourly: '1h', '6h': '6h', daily: '1d' };

/** Map a range's bucket to the `bucket` the node metric endpoints expect, so a chart never picks it by hand. */
export function metricApiBucket(bucket: StatsBucket): MetricApiBucket {
  return METRIC_API_BUCKET[bucket];
}

export interface StatsRangeDef {
  key: StatsRangeKey;
  /** Short label for the range bar. */
  label: string;
  /** Longer label for chart titles and descriptions. */
  longLabel: string;
  hours: number;
  bucket: StatsBucket;
  /** Human wording of the bucket size, for captions ("6-hour"). */
  bucketLabel: string;
}

export const STATS_RANGES: Record<StatsRangeKey, StatsRangeDef> = {
  '2h': {
    key: '2h',
    label: 'Online (2h)',
    longLabel: 'last 2 hours',
    hours: 2,
    bucket: 'hourly',
    bucketLabel: 'hourly',
  },
  '24h': { key: '24h', label: '24h', longLabel: 'last 24 hours', hours: 24, bucket: 'hourly', bucketLabel: 'hourly' },
  '7d': { key: '7d', label: '7d', longLabel: 'last 7 days', hours: 168, bucket: '6h', bucketLabel: '6-hour' },
  '30d': { key: '30d', label: '30d', longLabel: 'last 30 days', hours: 720, bucket: 'daily', bucketLabel: 'daily' },
  '90d': { key: '90d', label: '90d', longLabel: 'last 90 days', hours: 2160, bucket: 'daily', bucketLabel: 'daily' },
};

const HOUR_MS = 60 * 60 * 1000;
const ONLINE_STEP_MS = 5 * 60 * 1000;
const BUCKET_MS: Record<StatsBucket, number> = { hourly: HOUR_MS, '6h': 6 * HOUR_MS, daily: 24 * HOUR_MS };

export interface StatsRangeWindow {
  start: Date;
  end: Date;
  /**
   * True when `end` falls inside a bucket (7d: 6h buckets, 30d/90d: daily buckets), so the last bucket is still in
   * progress and charts should mark it rather than read it as a dip. Always false for hourly buckets (24h, 2h).
   */
  partialEnd: boolean;
  /** Start of the bucket that contains `end`. Equals `end` when `partialEnd` is false. */
  lastBucketStart: Date;
}

export function isStatsRangeKey(value: unknown): value is StatsRangeKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STATS_RANGES, value);
}

function floorTo(ms: number, step: number): number {
  return Math.floor(ms / step) * step;
}

/**
 * Window for a range key, in UTC throughout: the API's rollups bucket by UTC hour, 6h (00/06/12/18) and UTC day, and
 * epoch arithmetic is UTC, so the result does not depend on the browser's time zone or DST.
 *
 * - Presets end at the current UTC hour, so the window (and any query key built from it) only changes once an hour.
 *   `start` is `end - hours` floored to the UTC boundary of the key's bucket, so the first bucket is whole; the
 *   last bucket is the one in progress (see `partialEnd`).
 * - Online (2h) ends at `now` floored to the 5-minute tick, so every component gets the same key; it matches
 *   "Online now" to within five minutes and is not bucket-aligned.
 */
export function statsRangeWindow(key: StatsRangeKey, now: Date = new Date()): StatsRangeWindow {
  const def = STATS_RANGES[key];
  const bucketMs = BUCKET_MS[def.bucket];
  if (key === STATS_ONLINE_KEY) {
    const endMs = floorTo(now.getTime(), ONLINE_STEP_MS);
    return {
      start: new Date(endMs - def.hours * HOUR_MS),
      end: new Date(endMs),
      partialEnd: false,
      lastBucketStart: new Date(endMs),
    };
  }
  const endMs = floorTo(now.getTime(), HOUR_MS);
  const lastBucketMs = floorTo(endMs, bucketMs);
  return {
    start: new Date(floorTo(endMs - def.hours * HOUR_MS, bucketMs)),
    end: new Date(endMs),
    partialEnd: lastBucketMs !== endMs,
    lastBucketStart: new Date(lastBucketMs),
  };
}

/** The window of the same length immediately before `window`, for period-on-period comparison. */
export function previousStatsWindow(window: StatsRangeWindow): StatsRangeWindow {
  const span = window.end.getTime() - window.start.getTime();
  const start = new Date(window.start.getTime() - span);
  return { start, end: window.start, partialEnd: false, lastBucketStart: window.start };
}

/** Bucket size for a range key. */
export function statsRangeBucket(key: StatsRangeKey): StatsBucket {
  return STATS_RANGES[key].bucket;
}

/**
 * Validate a raw value (URL param, stored value) against the options a screen allows.
 * Returns the key if allowed, otherwise null.
 */
export function parseStatsRange(
  raw: string | null | undefined,
  options: readonly StatsRangeKey[]
): StatsRangeKey | null {
  return isStatsRangeKey(raw) && options.includes(raw) ? raw : null;
}

/** The key to use when nothing valid is chosen: 7d if allowed, else the first allowed option. */
export function defaultStatsRange(options: readonly StatsRangeKey[]): StatsRangeKey {
  return options.includes(DEFAULT_STATS_RANGE) ? DEFAULT_STATS_RANGE : (options[0] ?? DEFAULT_STATS_RANGE);
}

/** Changes once per UTC step (1h for presets, 5min for Online); keeps a window stable across renders. */
export function windowStabilityTick(key: StatsRangeKey, now: Date): number {
  const step = key === STATS_ONLINE_KEY ? ONLINE_STEP_MS : HOUR_MS;
  return Math.floor(now.getTime() / step);
}
