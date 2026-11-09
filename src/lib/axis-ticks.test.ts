import { describe, expect, it } from 'vitest';

import { niceAxisMax } from '@/lib/axis-ticks';

describe('niceAxisMax', () => {
  const inputs = [0, -3, NaN, 0.4, 1, 2, 3, 7, 18, 21, 22.4, 99, 101, 640, 1234.56, 98765, 1_234_567];

  it.each(inputs)('gives a round, covering, whole and distinct axis for %s', (input) => {
    const { max, ticks } = niceAxisMax(input);
    expect(max).toBeGreaterThanOrEqual(Number.isFinite(input) ? Math.max(input, 0) : 0);
    expect(Number.isInteger(max)).toBe(true);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(max);
    expect(ticks.every(Number.isInteger)).toBe(true);
    expect(new Set(ticks).size).toBe(ticks.length);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.length).toBeLessThanOrEqual(8);
  });

  it('rounds the top to a 1/2/5 multiple of the step', () => {
    expect(niceAxisMax(21).max).toBe(25);
    expect(niceAxisMax(18).ticks).toEqual([0, 5, 10, 15, 20]);
    expect(niceAxisMax(1234.56).max).toBe(1500);
    expect(niceAxisMax(98765).max).toBe(100000);
  });

  it('uses unit steps for small values', () => {
    expect(niceAxisMax(3).ticks).toEqual([0, 1, 2, 3]);
    expect(niceAxisMax(0).ticks).toEqual([0, 1]);
  });
});
