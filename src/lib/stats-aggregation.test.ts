import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aggregateStats, aggregateStatsByType, getBucketStart, snapshotsToCountSeries } from '@/lib/stats-aggregation';
import type { StatsSnapshot } from '@/lib/models';

describe.each(['UTC', 'Europe/London', 'Asia/Kolkata'])('UTC bucketing under TZ=%s', (tz) => {
  const original = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = tz;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it('buckets by UTC day and UTC 6h boundary regardless of the local zone', () => {
    const t = new Date('2026-10-25T23:30:00Z');
    expect(getBucketStart(t, 'daily').toISOString()).toBe('2026-10-25T00:00:00.000Z');
    expect(getBucketStart(t, '6h').toISOString()).toBe('2026-10-25T18:00:00.000Z');
  });
});

describe('aggregateStats', () => {
  const h = (iso: string, value: number, samples?: number) => ({
    timestamp: Date.parse(iso),
    value,
    ...(samples != null ? { samples } : {}),
  });

  it('sums hourly rows into a UTC day and counts the samples', () => {
    const out = aggregateStats(
      [h('2026-11-08T22:00:00Z', 1), h('2026-11-08T23:00:00Z', 2), h('2026-11-09T00:00:00Z', 4)],
      'daily',
      'sum'
    );
    expect(out).toEqual([
      { timestamp: Date.parse('2026-11-08T00:00:00Z'), value: 3, samples: 2 },
      { timestamp: Date.parse('2026-11-09T00:00:00Z'), value: 4, samples: 1 },
    ]);
  });

  it('passes API-rolled days through unchanged, and weights averages by samples', () => {
    const rolled = [h('2026-11-08T00:00:00Z', 80, 24), h('2026-11-09T00:00:00Z', 90, 6)];
    expect(aggregateStats(rolled, 'daily', 'average')).toEqual(rolled);
    expect(aggregateStats(rolled, 'daily', 'sum')[1]?.value).toBe(90);
    const merged = aggregateStats([h('2026-11-09T00:00:00Z', 100, 3), h('2026-11-09T06:00:00Z', 40, 1)], 'daily', 'average');
    expect(merged[0]?.value).toBe(85);
  });

  it('leaves hourly data alone', () => {
    const pts = [h('2026-11-09T00:00:00Z', 1)];
    expect(aggregateStats(pts, 'hourly', 'sum')).toBe(pts);
  });
});

describe('aggregateStatsByType', () => {
  it('sums each type per UTC day', () => {
    const out = aggregateStatsByType(
      [
        { timestamp: Date.parse('2026-11-09T01:00:00Z'), byType: { a: 1, b: 2 } },
        { timestamp: Date.parse('2026-11-09T05:00:00Z'), byType: { a: 3 } },
      ],
      'daily'
    );
    expect(out).toEqual([{ timestamp: Date.parse('2026-11-09T00:00:00Z'), byType: { a: 4, b: 2 }, samples: 2 }]);
  });
});

describe('snapshotsToCountSeries', () => {
  it('carries value.samples from rolled-up rows only', () => {
    const rows = [
      { recorded_at: '2026-11-09T00:00:00Z', value: { count: 5, samples: 24 } },
      { recorded_at: '2026-11-08T00:00:00Z', value: { count: 7 } },
    ] as unknown as StatsSnapshot[];
    expect(snapshotsToCountSeries(rows)).toEqual([
      { timestamp: Date.parse('2026-11-08T00:00:00Z'), value: 7 },
      { timestamp: Date.parse('2026-11-09T00:00:00Z'), value: 5, samples: 24 },
    ]);
  });
});
