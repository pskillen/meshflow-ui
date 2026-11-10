import { describe, expect, it } from 'vitest';
import { batteryChartValue, batteryToneClass, batteryTone, describeBattery, formatBattery } from './battery';

describe('describeBattery', () => {
  it('treats null, undefined and NaN as no data', () => {
    expect(describeBattery(null)).toEqual({ kind: 'none' });
    expect(describeBattery(undefined)).toEqual({ kind: 'none' });
    expect(describeBattery(NaN)).toEqual({ kind: 'none' });
  });
  it('treats 0 as a real reading', () => {
    expect(describeBattery(0)).toEqual({ kind: 'level', pct: 0, tone: 'low' });
  });
  it('treats 101 and above as powered', () => {
    expect(describeBattery(101)).toEqual({ kind: 'powered' });
    expect(describeBattery(150)).toEqual({ kind: 'powered' });
  });
  it('keeps 100 as 100%', () => {
    expect(describeBattery(100)).toEqual({ kind: 'level', pct: 100, tone: 'good' });
  });
  it('treats negatives as no data', () => {
    expect(describeBattery(-1)).toEqual({ kind: 'none' });
    expect(describeBattery(-5)).toEqual({ kind: 'none' });
    expect(formatBattery(-1)).toBe('—');
  });
  it('clamps after rounding, so a fractional level above 100 never shows 101%', () => {
    expect(describeBattery(100.5)).toEqual({ kind: 'level', pct: 100, tone: 'good' });
    expect(formatBattery(100.5)).toBe('100%');
  });
  it('rounds', () => {
    expect(describeBattery(42.6)).toEqual({ kind: 'level', pct: 43, tone: 'warn' });
  });
});

describe('batteryTone', () => {
  it('uses 60 and 20 thresholds', () => {
    expect(batteryTone(61)).toBe('good');
    expect(batteryTone(60)).toBe('warn');
    expect(batteryTone(21)).toBe('warn');
    expect(batteryTone(20)).toBe('low');
  });
});

describe('formatBattery', () => {
  it('formats each case', () => {
    expect(formatBattery(null)).toBe('—');
    expect(formatBattery(101)).toBe('Powered');
    expect(formatBattery(0)).toBe('0%');
    expect(formatBattery(87)).toBe('87%');
  });
});

describe('batteryToneClass and batteryChartValue', () => {
  it.each([
    [87, 'text-green-500', 87],
    [61, 'text-green-500', 61],
    [60, 'text-yellow-500', 60],
    [21, 'text-yellow-500', 21],
    [20, 'text-red-500', 20],
    [0, 'text-red-500', 0],
    [101, 'text-muted-foreground', null],
    [null, 'text-muted-foreground', null],
    [undefined, 'text-muted-foreground', null],
    [NaN, 'text-muted-foreground', null],
  ])('%s -> %s, chart %s', (raw, cls, chart) => {
    expect(batteryToneClass(raw)).toBe(cls);
    expect(batteryChartValue(raw)).toBe(chart);
  });
});
