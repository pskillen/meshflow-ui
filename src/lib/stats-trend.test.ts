import { describe, expect, it } from 'vitest';
import { statsRangeWindow } from '@/lib/stats-range';
import {
  buildBucketGrid,
  densifyTrendRows,
  formatTrendLabel,
  formatTrendTick,
  evenTrendTicks,
  maxTrendTicks,
  markPartialBuckets,
  splitPartialLine,
} from '@/lib/stats-trend';

const DAY = 86_400_000;
const NOW = new Date('2026-11-09T14:30:00Z');

describe('buildBucketGrid', () => {
  it('has one daily bucket per UTC day for 30d, including the day in progress', () => {
    const w = statsRangeWindow('30d', NOW);
    const grid = buildBucketGrid(w, 'daily');
    expect(grid[0]).toBe(w.start.getTime());
    expect(grid[grid.length - 1]).toBe(w.lastBucketStart.getTime());
    expect(grid).toHaveLength(31);
    expect(grid.every((t) => t % DAY === 0)).toBe(true);
  });

  it('covers 90d with daily buckets', () => {
    expect(buildBucketGrid(statsRangeWindow('90d', NOW), 'daily')).toHaveLength(91);
  });

  it('has 24 hourly buckets for 24h, none in progress', () => {
    expect(buildBucketGrid(statsRangeWindow('24h', NOW), 'hourly')).toHaveLength(24);
  });
});

describe('markPartialBuckets', () => {
  it('flags the bucket in progress', () => {
    const w = statsRangeWindow('7d', NOW);
    const rows = [
      { timestamp: w.start.getTime(), v: 1, samples: 6 },
      { timestamp: w.lastBucketStart.getTime(), v: 2, samples: 2 },
    ];
    const out = markPartialBuckets(rows, w, '6h');
    expect(out.map((r) => r.partial)).toEqual([false, true]);
  });

  it('flags a first bucket that holds fewer samples than a whole one', () => {
    const w = statsRangeWindow('30d', NOW);
    const out = markPartialBuckets(
      [
        { timestamp: w.start.getTime(), v: 1, samples: 9 },
        { timestamp: w.start.getTime() + DAY, v: 1, samples: 24 },
      ],
      w,
      'daily'
    );
    expect(out.map((r) => r.partial)).toEqual([true, false]);
  });

  it('does not flag a mid-range day with a few missing samples, or the first day when whole', () => {
    const w = statsRangeWindow('30d', NOW);
    const out = markPartialBuckets(
      [
        { timestamp: w.start.getTime(), v: 1, samples: 24 },
        { timestamp: w.start.getTime() + DAY, v: 1, samples: 20 },
      ],
      w,
      'daily'
    );
    expect(out.map((r) => r.partial)).toEqual([false, false]);
  });

  it('never flags 24h hourly points', () => {
    const w = statsRangeWindow('24h', NOW);
    const out = markPartialBuckets([{ timestamp: w.start.getTime(), v: 1 }], w, 'hourly');
    expect(out[0]?.partial).toBe(false);
  });
});

describe('densifyTrendRows', () => {
  it('lays rows on the full grid with gaps for missing buckets', () => {
    const w = statsRangeWindow('24h', NOW);
    const t = w.start.getTime() + 3_600_000 * 5;
    const out = densifyTrendRows([{ timestamp: t, v: 4 }], w, 'hourly');
    expect(out).toHaveLength(24);
    expect(out[5]).toEqual({ timestamp: t, v: 4 });
    expect(out[6]).toEqual({ timestamp: t + 3_600_000 });
  });
});

describe('splitPartialLine', () => {
  it('nulls the solid series on partial rows and joins the dashed one to its neighbour', () => {
    const rows = [
      { timestamp: 1, v: 10, partial: false },
      { timestamp: 2, v: 11, partial: false },
      { timestamp: 3, v: 12, partial: true },
    ];
    const out = splitPartialLine(rows, ['v']);
    expect(out.map((r) => r.v)).toEqual([10, 11, null]);
    expect(out.map((r) => r.v__partial)).toEqual([null, 11, 12]);
  });
});

describe('UTC formatting', () => {
  it('formats buckets in UTC whatever the browser zone', () => {
    const ts = Date.UTC(2026, 10, 9, 6, 0);
    expect(formatTrendTick(ts, 'hourly')).toBe('06:00');
    expect(formatTrendTick(ts, 'daily')).toBe('9 Nov');
    expect(formatTrendLabel(ts, '6h')).toBe('Mon 9 Nov 06:00-12:00 UTC');
    expect(formatTrendLabel(ts, 'daily')).toBe('Mon 9 Nov (UTC day)');
  });
});

describe('narrow x ticks', () => {
  it('allows 3 labels on a narrow plot and 6 on a wide one', () => {
    expect(maxTrendTicks(200)).toBe(3);
    expect(maxTrendTicks(300)).toBe(3);
    expect(maxTrendTicks(400)).toBe(5);
    expect(maxTrendTicks(900)).toBe(6);
  });

  it('thins the ticks to the limit, evenly, from the first', () => {
    const ts = Array.from({ length: 28 }, (_, i) => i * 6 * 3_600_000);
    const ticks = evenTrendTicks(ts, 3);
    expect(ticks.length).toBeLessThanOrEqual(3);
    expect(ticks[0]).toBe(ts[0]);
    expect(evenTrendTicks(ts).length).toBeLessThanOrEqual(6);
  });
});
