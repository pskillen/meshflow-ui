import { describe, expect, it } from 'vitest';

import { fitAxis, maxStackTotal, niceAxisMax } from '@/lib/axis-ticks';

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
    expect(niceAxisMax(3).ticks).toEqual([0, 1, 2, 3, 4]);
    expect(niceAxisMax(0).ticks).toEqual([0, 1]);
  });

  it('adds one step of headroom when the maximum is already a step multiple', () => {
    expect(niceAxisMax(15).max).toBe(20);
    expect(niceAxisMax(15).ticks).toEqual([0, 5, 10, 15, 20]);
    expect(niceAxisMax(100).max).toBe(120);
    expect(niceAxisMax(1).ticks).toEqual([0, 1, 2]);
  });
});

describe('maxStackTotal', () => {
  it('sums the series in each row, ignoring timestamp, and returns the largest total', () => {
    const rows = [
      { timestamp: 1_700_000_000_000, text: 40, position: 30, telemetry: 30 },
      { timestamp: 1_700_003_600_000, text: 10, position: 5, telemetry: 5 },
    ];
    expect(maxStackTotal(rows)).toBe(100);
    // The stack exceeds every single value, so a single-value max would stop the axis at about half.
    expect(niceAxisMax(maxStackTotal(rows)).max).toBeGreaterThan(100);
    expect(maxStackTotal([])).toBe(0);
  });
});

describe('fitAxis', () => {
  it('hugs a narrow band instead of starting at 0, with decimal ticks', () => {
    const a = fitAxis(3.62, 4.1);
    expect(a.min).toBeGreaterThan(3);
    expect(a.max).toBeLessThan(4.5);
    expect(a.min).toBeLessThanOrEqual(3.62);
    expect(a.max).toBeGreaterThanOrEqual(4.1);
    expect(a.ticks[0]).toBe(a.min);
    expect(a.ticks.at(-1)).toBe(a.max);
  });

  it('gives a flat series a visible span', () => {
    const a = fitAxis(3.9, 3.9);
    expect(a.max).toBeGreaterThan(a.min);
    expect(a.ticks.length).toBeGreaterThanOrEqual(2);
  });
});
