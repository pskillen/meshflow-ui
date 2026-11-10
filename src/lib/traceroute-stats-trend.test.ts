import { describe, expect, it } from 'vitest';
import { statsRangeWindow } from '@/lib/stats-range';
import { buildOutcomeTrend } from '@/lib/traceroute-stats-trend';

const NOW = new Date('2026-11-09T14:30:00Z');
const H = 3_600_000;

describe('buildOutcomeTrend', () => {
  it('24h with bucket_start: hourly rows, current hour in progress, grid of 25', () => {
    const w = statsRangeWindow('24h', NOW);
    const rows = Array.from({ length: 25 }, (_, i) => ({
      date: '2026-11-08',
      bucket_start: new Date(w.start.getTime() + i * H).toISOString(),
      completed: 1,
      failed: 0,
    }));
    const t = buildOutcomeTrend(rows, '24h', w);
    expect(t.bucket).toBe('hourly');
    expect(t.fellBack).toBe(false);
    expect((t.window.end.getTime() - t.window.start.getTime()) / H).toBe(25);
    expect(t.rows.filter((r) => r.partial)).toHaveLength(1);
    expect(t.rows[24]?.partial).toBe(true);
  });

  it('24h without bucket_start falls back to UTC days', () => {
    const w = statsRangeWindow('24h', NOW);
    const t = buildOutcomeTrend(
      [
        { date: '2026-11-08', completed: 4, failed: 1 },
        { date: '2026-11-09', completed: 2, failed: 0 },
      ],
      '24h',
      w
    );
    expect(t.bucket).toBe('daily');
    expect(t.fellBack).toBe(true);
    expect(t.rows.map((r) => r.timestamp)).toEqual([Date.UTC(2026, 10, 8), Date.UTC(2026, 10, 9)]);
    // first day starts mid-day (13:00 on the 8th), the current day is in progress: both partial
    expect(t.rows.every((r) => r.partial)).toBe(true);
  });

  it('7d is daily, with the first (starts 12:00) and current days partial', () => {
    const w = statsRangeWindow('7d', NOW);
    const rows = Array.from({ length: 8 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 10, 2 + i)).toISOString().slice(0, 10),
      completed: 1,
      failed: 1,
    }));
    const t = buildOutcomeTrend(rows, '7d', w);
    expect(t.bucket).toBe('daily');
    expect(t.fellBack).toBe(false);
    expect(t.window.start.toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(t.window.end.toISOString()).toBe('2026-11-10T00:00:00.000Z');
    expect(t.rows.map((r) => r.partial)).toEqual([true, false, false, false, false, false, false, true]);
  });

  it('90d starting at UTC midnight has a whole first day', () => {
    const w = statsRangeWindow('90d', NOW);
    const t = buildOutcomeTrend(
      [{ date: new Date(w.start).toISOString().slice(0, 10), completed: 1, failed: 0 }],
      '90d',
      w
    );
    expect(t.rows[0]?.partial).toBe(false);
  });

  it('handles no rows', () => {
    const t = buildOutcomeTrend(undefined, '7d', statsRangeWindow('7d', NOW));
    expect(t.rows).toEqual([]);
  });
});
