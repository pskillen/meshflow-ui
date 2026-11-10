import { describe, expect, it } from 'vitest';
import type { ObservedNode } from '@/lib/models';
import { buildNodeNowCells, formatAgoShort, formatUptimeShort } from '@/lib/node-now';

const NOW = new Date('2026-11-10T12:00:00Z');
const node = (over: Partial<ObservedNode> = {}) =>
  ({ last_heard: null, latest_device_metrics: null, ...over }) as ObservedNode;

describe('formatUptimeShort', () => {
  it.each([
    [14 * 86400 + 99, '14d'],
    [5 * 3600 + 10, '5h'],
    [12 * 60 + 3, '12m'],
    [null, '—'],
    [-1, '—'],
  ])('%s -> %s', (input, out) => expect(formatUptimeShort(input as number | null)).toBe(out));
});

describe('formatAgoShort', () => {
  it('formats minutes, hours and days', () => {
    expect(formatAgoShort(new Date('2026-11-10T11:55:00Z'), NOW)).toBe('5m ago');
    expect(formatAgoShort(new Date('2026-11-10T09:00:00Z'), NOW)).toBe('3h ago');
    expect(formatAgoShort(new Date('2026-11-07T12:00:00Z'), NOW)).toBe('3d ago');
    expect(formatAgoShort(null, NOW)).toBe('—');
  });
});

describe('buildNodeNowCells', () => {
  it('returns only Last heard without device metrics', () => {
    expect(buildNodeNowCells(node(), NOW).map((c) => c.key)).toEqual(['heard']);
  });

  it('reads battery through describeBattery: 0 is real, 101 is Powered, null is a dash', () => {
    const dm = (battery_level: number | null) =>
      node({
        latest_device_metrics: {
          battery_level,
          voltage: 3.7,
          meshtastic_channel_utilization: 1,
          meshtastic_air_util_tx: 1,
          uptime_seconds: 60,
        } as unknown as ObservedNode['latest_device_metrics'],
      });
    expect(buildNodeNowCells(dm(0), NOW)[0]?.value).toBe('0%');
    expect(buildNodeNowCells(dm(101), NOW)[0]?.value).toBe('Powered');
    expect(buildNodeNowCells(dm(null), NOW)[0]?.value).toBe('—');
  });
});
