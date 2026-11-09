import { describe, expect, it } from 'vitest';
import { batteryTone, describeBattery, formatBattery } from './battery';

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
  it('clamps negatives and rounds', () => {
    expect(describeBattery(-5)).toEqual({ kind: 'level', pct: 0, tone: 'low' });
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
