import { describe, expect, it } from 'vitest';
import { getAggregationWindow } from '@/lib/stats-aggregation';
import {
  STATS_PRESET_KEYS,
  STATS_RANGES,
  defaultStatsRange,
  isStatsRangeKey,
  parseStatsRange,
  previousStatsWindow,
  statsRangeBucket,
  statsRangeWindow,
  windowStabilityTick,
  type StatsRangeKey,
} from './stats-range';

const now = new Date(2026, 10, 9, 14, 37, 12);

describe('statsRangeWindow', () => {
  it('presets end at the top of the current hour', () => {
    for (const key of STATS_PRESET_KEYS) {
      const w = statsRangeWindow(key, now);
      expect(w.end).toEqual(new Date(2026, 10, 9, 14, 0, 0));
      expect(w.end.getTime() - w.start.getTime()).toBe(STATS_RANGES[key].hours * 3600_000);
    }
  });

  it('is identical for any two moments in the same hour', () => {
    const a = statsRangeWindow('7d', new Date(2026, 10, 9, 14, 0, 1));
    const b = statsRangeWindow('7d', new Date(2026, 10, 9, 14, 59, 59));
    expect(a).toEqual(b);
  });

  it('Online (2h) is rolling from now, not hour-aligned', () => {
    const w = statsRangeWindow('2h', now);
    expect(w.end).toEqual(now);
    expect(w.start).toEqual(new Date(2026, 10, 9, 12, 37, 12));
  });
});

describe('buckets', () => {
  it('matches the agreed sizes', () => {
    expect(statsRangeBucket('24h')).toBe('hourly');
    expect(statsRangeBucket('7d')).toBe('6h');
    expect(statsRangeBucket('30d')).toBe('daily');
    expect(statsRangeBucket('90d')).toBe('daily');
  });

  it('agrees with getAggregationWindow for every window', () => {
    for (const key of Object.keys(STATS_RANGES) as StatsRangeKey[]) {
      const w = statsRangeWindow(key, now);
      expect(getAggregationWindow(w.start, w.end)).toBe(statsRangeBucket(key));
    }
  });
});

describe('parseStatsRange / defaultStatsRange', () => {
  it('accepts allowed keys only', () => {
    expect(parseStatsRange('30d', STATS_PRESET_KEYS)).toBe('30d');
    expect(parseStatsRange('2h', STATS_PRESET_KEYS)).toBeNull();
    expect(parseStatsRange('2h', ['2h', ...STATS_PRESET_KEYS])).toBe('2h');
    expect(parseStatsRange('all', STATS_PRESET_KEYS)).toBeNull();
    expect(parseStatsRange('toString', STATS_PRESET_KEYS)).toBeNull();
    expect(parseStatsRange(null, STATS_PRESET_KEYS)).toBeNull();
  });

  it('defaults to 7d, else the first allowed option', () => {
    expect(defaultStatsRange(STATS_PRESET_KEYS)).toBe('7d');
    expect(defaultStatsRange(['24h', '30d'])).toBe('24h');
  });

  it('isStatsRangeKey rejects prototype keys', () => {
    expect(isStatsRangeKey('constructor')).toBe(false);
    expect(isStatsRangeKey('90d')).toBe(true);
  });
});

describe('previousStatsWindow', () => {
  it('is the same length and ends where the window starts', () => {
    const w = statsRangeWindow('24h', now);
    const p = previousStatsWindow(w);
    expect(p.end).toEqual(w.start);
    expect(p.end.getTime() - p.start.getTime()).toBe(24 * 3600_000);
  });
});

describe('windowStabilityTick', () => {
  it('changes hourly for presets and every 5 minutes for 2h', () => {
    const a = new Date(2026, 10, 9, 14, 1);
    const b = new Date(2026, 10, 9, 14, 58);
    expect(windowStabilityTick('7d', a)).toBe(windowStabilityTick('7d', b));
    expect(windowStabilityTick('2h', new Date(2026, 10, 9, 14, 0, 1))).not.toBe(
      windowStabilityTick('2h', new Date(2026, 10, 9, 14, 6))
    );
  });
});
