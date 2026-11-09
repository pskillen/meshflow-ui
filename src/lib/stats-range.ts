import { startOfHour, subHours } from 'date-fns';

/** The preset time ranges every stats screen offers. "All" is deliberately not one of them. */
export const STATS_PRESET_KEYS = ['24h', '7d', '30d', '90d'] as const;
export type StatsPresetKey = (typeof STATS_PRESET_KEYS)[number];

/** Rolling two hours from now. Node lists only: it matches "Online now". */
export const STATS_ONLINE_KEY = '2h' as const;

export type StatsRangeKey = StatsPresetKey | typeof STATS_ONLINE_KEY;

export const DEFAULT_STATS_RANGE: StatsPresetKey = '7d';

export type StatsBucket = 'hourly' | '6h' | 'daily';

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

export interface StatsRangeWindow {
  start: Date;
  end: Date;
}

export function isStatsRangeKey(value: unknown): value is StatsRangeKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STATS_RANGES, value);
}

/**
 * Window for a range key.
 * Presets end at the top of the current hour, so the window (and any query key built from it) only changes
 * once an hour. Online (2h) ends at `now` so it matches "Online now".
 */
export function statsRangeWindow(key: StatsRangeKey, now: Date = new Date()): StatsRangeWindow {
  const def = STATS_RANGES[key];
  const end = key === STATS_ONLINE_KEY ? now : startOfHour(now);
  return { start: subHours(end, def.hours), end };
}

/** The window of the same length immediately before `window`, for period-on-period comparison. */
export function previousStatsWindow(window: StatsRangeWindow): StatsRangeWindow {
  const span = window.end.getTime() - window.start.getTime();
  return { start: new Date(window.start.getTime() - span), end: window.start };
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

/** Changes once per step (1h for presets, 5min for Online); used to keep a window stable across renders. */
export function windowStabilityTick(key: StatsRangeKey, now: Date): number {
  const step = key === STATS_ONLINE_KEY ? 5 * 60 * 1000 : 60 * 60 * 1000;
  return Math.floor(now.getTime() / step);
}
