import { describe, expect, it } from 'vitest';

import { getAggregationWindow } from '@/lib/stats-aggregation';
import { windowForTimeRangeKey } from '@/lib/time-range';

const HOUR = 3600_000;

describe('windowForTimeRangeKey', () => {
  const now = new Date(2026, 5, 15, 14, 30);

  it('is deterministic for a fixed now and lands 2d in the hourly bucket', () => {
    const load = windowForTimeRangeKey('2d', now);
    const reselect = windowForTimeRangeKey('2d', now);
    expect(load).toEqual(reselect);
    expect(getAggregationWindow(load.startDate, load.endDate)).toBe('hourly');
  });

  it.each([2, 7, 30, 90])('spans exactly %i x 24h', (n) => {
    const w = windowForTimeRangeKey(`${n}d`, now);
    expect(w.endDate).toBe(now);
    expect(w.endDate.getTime() - w.startDate.getTime()).toBe(n * 24 * HOUR);
  });

  it('keeps the span fixed across a clock change', () => {
    // Europe/London spring forward is 2026-03-29; local-calendar subtraction would give 47h or 49h there.
    const clockChangeDay = new Date(Date.UTC(2026, 2, 30, 12, 0));
    const w = windowForTimeRangeKey('2d', clockChangeDay);
    expect(w.endDate.getTime() - w.startDate.getTime()).toBe(48 * HOUR);
    expect(getAggregationWindow(w.startDate, w.endDate)).toBe('hourly');
  });

  it('keeps 1d as start of today', () => {
    const w = windowForTimeRangeKey('1d', now);
    expect(w.startDate).toEqual(new Date(2026, 5, 15, 0, 0));
  });

  it('handles hour keys and falls back to 7 days', () => {
    expect(windowForTimeRangeKey('48h', now).startDate.getTime()).toBe(now.getTime() - 48 * HOUR);
    const fb = windowForTimeRangeKey('weird', now);
    expect(fb.endDate.getTime() - fb.startDate.getTime()).toBeGreaterThanOrEqual(167 * HOUR);
  });

  it('7d lands in the 6h bucket', () => {
    const w = windowForTimeRangeKey('7d', now);
    expect(getAggregationWindow(w.startDate, w.endDate)).toBe('6h');
  });
});
