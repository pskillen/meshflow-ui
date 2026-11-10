import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  STATS_PRESET_KEYS,
  STATS_RANGES,
  defaultStatsRange,
  isStatsRangeKey,
  parseStatsRange,
  comparisonWindows,
  statsRangeBucket,
  statsRangeWindow,
  windowStabilityTick,
  type StatsRangeKey,
} from './stats-range';

const now = new Date(Date.UTC(2026, 10, 9, 14, 37, 12)); // Mon 9 Nov 2026
const utc = (...a: [number, number, number, number?, number?, number?]) => new Date(Date.UTC(...a));

describe('statsRangeWindow', () => {
  it('presets end at the top of the current UTC hour', () => {
    for (const key of STATS_PRESET_KEYS) {
      expect(statsRangeWindow(key, now).end).toEqual(utc(2026, 10, 9, 14));
    }
  });

  it('start is aligned to the UTC boundary of the bucket, so the first bucket is whole', () => {
    // 24h hourly: exactly 24h
    expect(statsRangeWindow('24h', now).start).toEqual(utc(2026, 10, 8, 14));
    // 7d, 6h buckets: 14:00 - 7d = Mon 2 Nov 14:00, floored to 12:00
    expect(statsRangeWindow('7d', now).start).toEqual(utc(2026, 10, 2, 12));
    // 30d / 90d daily: floored to 00:00 UTC
    expect(statsRangeWindow('30d', now).start).toEqual(utc(2026, 9, 10, 0));
    expect(statsRangeWindow('90d', now).start).toEqual(utc(2026, 7, 11, 0));
  });

  it('is never shorter than the range and at most one bucket longer', () => {
    for (const key of STATS_PRESET_KEYS) {
      const w = statsRangeWindow(key, now);
      const span = w.end.getTime() - w.start.getTime();
      const hours = STATS_RANGES[key].hours * 3600_000;
      expect(span).toBeGreaterThanOrEqual(hours);
      expect(span - hours).toBeLessThan({ hourly: 3600_000, '6h': 6 * 3600_000, daily: 24 * 3600_000 }[STATS_RANGES[key].bucket] + 1);
    }
  });

  it('flags the in-progress last bucket', () => {
    const h = statsRangeWindow('24h', now);
    expect(h.partialEnd).toBe(false);
    expect(h.lastBucketStart).toEqual(h.end);
    const six = statsRangeWindow('7d', now);
    expect(six.partialEnd).toBe(true);
    expect(six.lastBucketStart).toEqual(utc(2026, 10, 9, 12));
    const day = statsRangeWindow('30d', now);
    expect(day.partialEnd).toBe(true);
    expect(day.lastBucketStart).toEqual(utc(2026, 10, 9, 0));
    // exactly on a 6h / day boundary: nothing partial
    expect(statsRangeWindow('7d', utc(2026, 10, 9, 12, 5)).partialEnd).toBe(false);
    expect(statsRangeWindow('30d', utc(2026, 10, 9, 0, 59)).partialEnd).toBe(false);
  });

  it('is identical for any two moments in the same hour', () => {
    const a = statsRangeWindow('7d', utc(2026, 10, 9, 14, 0, 1));
    const b = statsRangeWindow('7d', utc(2026, 10, 9, 14, 59, 59));
    expect(a).toEqual(b);
  });

  it('Online (2h) is 2h long and ends at now floored to the 5-minute tick', () => {
    const w = statsRangeWindow('2h', now);
    expect(w.end).toEqual(utc(2026, 10, 9, 14, 35));
    expect(w.start).toEqual(utc(2026, 10, 9, 12, 35));
    // two components rendering seconds apart get the same window (and so the same query key)
    expect(statsRangeWindow('2h', utc(2026, 10, 9, 14, 35, 1))).toEqual(statsRangeWindow('2h', utc(2026, 10, 9, 14, 39, 59)));
    expect(statsRangeWindow('2h', utc(2026, 10, 9, 14, 40)).end).toEqual(utc(2026, 10, 9, 14, 40));
  });
});

// Windows are UTC, so they must not move with the browser's zone: Kolkata is +5:30 (a local hour is never a UTC
// hour), London's window below spans the clocks going back on 25 Oct 2026.
describe.each(['UTC', 'Europe/London', 'Asia/Kolkata'])('statsRangeWindow under TZ=%s', (tz) => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = tz;
  });
  afterAll(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it('is the same instants as under UTC, aligned to UTC buckets', () => {
    expect(new Date(2026, 0, 1, 12).getTimezoneOffset()).toBe(
      { UTC: 0, 'Europe/London': 0, 'Asia/Kolkata': -330 }[tz]
    );
    const at = utc(2026, 10, 9, 14, 37, 12);
    expect(statsRangeWindow('24h', at).start.toISOString()).toBe('2026-11-08T14:00:00.000Z');
    const w7 = statsRangeWindow('7d', at);
    expect(w7.start.toISOString()).toBe('2026-11-02T12:00:00.000Z');
    expect(w7.end.toISOString()).toBe('2026-11-09T14:00:00.000Z');
    const w30 = statsRangeWindow('30d', at); // spans the London DST change
    expect(w30.start.toISOString()).toBe('2026-10-10T00:00:00.000Z');
    expect(w30.end.toISOString()).toBe('2026-11-09T14:00:00.000Z');
    for (const key of Object.keys(STATS_RANGES) as StatsRangeKey[]) {
      const w = statsRangeWindow(key, at);
      const step = STATS_RANGES[key].bucket === 'daily' ? 24 : STATS_RANGES[key].bucket === '6h' ? 6 : 1;
      if (key !== '2h') expect(w.start.getTime() % (step * 3600_000)).toBe(0);
    }
  });

  it('keeps a stable tick across the DST change', () => {
    expect(windowStabilityTick('7d', utc(2026, 9, 25, 0, 30))).toBe(windowStabilityTick('7d', utc(2026, 9, 25, 0, 59)));
    expect(windowStabilityTick('7d', utc(2026, 9, 25, 1, 0))).toBe(windowStabilityTick('7d', utc(2026, 9, 25, 0, 59)) + 1);
  });
});

describe('buckets', () => {
  it('matches the agreed sizes', () => {
    expect(statsRangeBucket('24h')).toBe('hourly');
    expect(statsRangeBucket('7d')).toBe('6h');
    expect(statsRangeBucket('30d')).toBe('daily');
    expect(statsRangeBucket('90d')).toBe('daily');
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

describe('comparisonWindows', () => {
  it('24h: 24 hourly buckets, previous is the 24 before', () => {
    const c = comparisonWindows(statsRangeWindow('24h', now), 'hourly');
    expect(c.buckets).toBe(24);
    expect(c.current).toEqual({ start: utc(2026, 10, 8, 14), end: utc(2026, 10, 9, 14) });
    expect(c.previous).toEqual({ start: utc(2026, 10, 7, 14), end: utc(2026, 10, 8, 14) });
  });

  it('7d at 14:20 UTC: 28 six-hour buckets, the one in progress left out', () => {
    const c = comparisonWindows(statsRangeWindow('7d', utc(2026, 10, 9, 14, 20)), '6h');
    expect(c.buckets).toBe(28);
    expect(c.current).toEqual({ start: utc(2026, 10, 2, 12), end: utc(2026, 10, 9, 12) });
    expect(c.previous).toEqual({ start: utc(2026, 9, 26, 12), end: utc(2026, 10, 2, 12) });
  });

  it('7d exactly on a bucket boundary keeps every bucket', () => {
    const c = comparisonWindows(statsRangeWindow('7d', utc(2026, 10, 9, 12, 5)), '6h');
    expect(c.buckets).toBe(28);
    expect(c.current.end).toEqual(utc(2026, 10, 9, 12));
  });

  it('30d and 90d: whole UTC days', () => {
    const c30 = comparisonWindows(statsRangeWindow('30d', now), 'daily');
    expect(c30.buckets).toBe(30);
    expect(c30.current).toEqual({ start: utc(2026, 9, 10), end: utc(2026, 10, 9) });
    expect(c30.previous).toEqual({ start: utc(2026, 8, 10), end: utc(2026, 9, 10) });
    const c90 = comparisonWindows(statsRangeWindow('90d', now), 'daily');
    expect(c90.buckets).toBe(90);
    expect(c90.previous.end).toEqual(c90.current.start);
    expect(c90.previous.start.getUTCHours()).toBe(0);
  });
});

describe('windowStabilityTick', () => {
  it('changes hourly for presets and every 5 minutes for 2h', () => {
    const a = utc(2026, 10, 9, 14, 1);
    const b = utc(2026, 10, 9, 14, 58);
    expect(windowStabilityTick('7d', a)).toBe(windowStabilityTick('7d', b));
    expect(windowStabilityTick('2h', utc(2026, 10, 9, 14, 0, 1))).not.toBe(
      windowStabilityTick('2h', utc(2026, 10, 9, 14, 6))
    );
  });
});
