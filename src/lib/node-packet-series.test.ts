import { describe, expect, it } from 'vitest';
import { buildPacketTypeRows, packetIntervalType } from '@/lib/node-packet-series';
import { statsRangeWindow } from '@/lib/stats-range';

const NOW = new Date('2026-11-10T09:37:00Z');
const HOUR = 3_600_000;

function hourly(from: Date, to: Date, types: Array<[string, number]>) {
  const intervals = [];
  for (let t = from.getTime(); t < to.getTime(); t += HOUR) {
    intervals.push({
      start_date: new Date(t).toISOString(),
      end_date: new Date(t + HOUR).toISOString(),
      packets: 0,
      packet_types: types.map(([packet_type, count]) => ({ packet_type, count })),
    });
  }
  return { intervals } as never;
}

describe('packetIntervalType', () => {
  it('asks for hours at 24h and 7d (never interval 6), days at 30d and 90d', () => {
    expect(packetIntervalType('hourly')).toBe('hour');
    expect(packetIntervalType('6h')).toBe('hour');
    expect(packetIntervalType('daily')).toBe('day');
  });
});

describe('buildPacketTypeRows', () => {
  it('rolls hourly intervals up into 6-hour buckets, summing each type', () => {
    const w = statsRangeWindow('7d', NOW);
    const { rows, total } = buildPacketTypeRows(hourly(w.start, w.end, [['position', 2]]), w, '6h');
    expect(rows.length).toBeLessThanOrEqual(29);
    expect(rows[0]).toMatchObject({ position: 12 });
    expect(total).toBe(((w.end.getTime() - w.start.getTime()) / HOUR) * 2);
  });

  it('folds unknown packet types into OTHER and keeps known ones apart', () => {
    const w = statsRangeWindow('24h', NOW);
    const { rows } = buildPacketTypeRows(
      hourly(w.start, new Date(w.start.getTime() + HOUR), [
        ['text_message', 1],
        ['traceroute', 3],
        ['OTHER', 2],
      ]),
      w,
      'hourly'
    );
    expect(rows[0]).toMatchObject({ text_message: 1, OTHER: 5 });
  });

  it('counts the newest hour into the bucket in progress and marks it partial', () => {
    const w = statsRangeWindow('7d', NOW);
    // 09:00-10:00 is past window.end (09:00); it belongs to the 06:00 bucket, the one in progress.
    const { rows } = buildPacketTypeRows(hourly(w.start, new Date(w.end.getTime() + HOUR), [['position', 1]]), w, '6h');
    const last = rows[rows.length - 1]!;
    expect(last.timestamp).toBe(w.lastBucketStart.getTime());
    expect(last.partial).toBe(true);
    expect(last.position).toBe(4);
  });

  it('drops intervals before the window and tolerates intervals without types', () => {
    const w = statsRangeWindow('24h', NOW);
    const early = new Date(w.start.getTime() - HOUR).toISOString();
    const inWindow = w.start.toISOString();
    const { rows, total } = buildPacketTypeRows(
      {
        intervals: [
          { start_date: early, end_date: early, packets: 1, packet_types: [{ packet_type: 'position', count: 1 }] },
          { start_date: inWindow, end_date: inWindow, packets: 0 },
        ],
      } as never,
      w,
      'hourly'
    );
    expect(total).toBe(0);
    expect(rows.every((r) => r.position == null)).toBe(true);
  });
});
