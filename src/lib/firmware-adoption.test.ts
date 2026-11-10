import { describe, expect, it } from 'vitest';
import type { StatsSnapshot } from '@/lib/models';
import { buildFirmwareAdoption, buildFirmwareTrend, describeWindow } from './firmware-adoption';

function row(day: number, by_type?: Record<string, number>): StatsSnapshot {
  return {
    id: day,
    recorded_at: `2026-11-${String(day).padStart(2, '0')}T00:00:00Z`,
    stat_type: 'node_firmware',
    constellation_id: null,
    value: { count: 0, window_hours: 168, ...(by_type ? { by_type } : {}) },
  };
}

const labels = (rows: StatsSnapshot[]) => buildFirmwareAdoption(rows).series.map((s) => s.label);

describe('buildFirmwareAdoption', () => {
  it('orders numerically with 2.10 after 2.8 and unknown last', () => {
    const r = buildFirmwareAdoption([row(2, { unknown: 1, '2.10': 1, '3.0': 1, '2.8': 1, '2.7': 1 })]);
    expect(r.series.map((s) => s.key)).toEqual(['2.7', '2.8', '2.10', '3.0', 'unknown']);
  });

  it('labels lowest, middle and highest', () => {
    expect(labels([row(1, { '2.7': 1, '2.8': 1, '2.9': 1 })])).toEqual(['2.7 or earlier', '2.8', '2.9+']);
  });

  it('treats a single numeric key as lowest', () => {
    expect(labels([row(1, { '2.7': 1 })])).toEqual(['2.7 or earlier']);
  });

  it('an unseen 2.9 changes labels with no code change', () => {
    const old = row(1, { '2.7': 1, '2.8': 1, unknown: 1 });
    const next = row(2, { '2.7': 1, '2.8': 1, '2.9': 1, unknown: 1 });
    expect(labels([old])).toEqual(['2.7 or earlier', '2.8+', 'Unknown']);
    expect(labels([next, old])).toEqual(['2.7 or earlier', '2.8', '2.9+', 'Unknown']);
  });

  it('labels unknown exactly "Unknown", last, with non-numeric keys verbatim before it', () => {
    const r = buildFirmwareAdoption([row(1, { unknown: 1, beta: 2, '2.7': 3 })]);
    expect(r.series.map((s) => s.label)).toEqual(['2.7 or earlier', 'beta', 'Unknown']);
    expect(r.series[2].color).toBe('hsl(var(--muted-foreground))');
  });

  it('fills missing keys with 0 in line and omits zero pie slices', () => {
    const r = buildFirmwareAdoption([row(2, { '2.7': 5 }), row(1, { '2.7': 3, '2.8': 2 })]);
    const id28 = r.series.find((s) => s.key === '2.8')!.id;
    expect(r.line[1][id28]).toBe(0);
    expect(r.pie.map((p) => p.key)).toEqual(['2.7']);
  });

  it('returns line oldest first from newest-first input and pie from newest', () => {
    const r = buildFirmwareAdoption([row(3, { '2.7': 30 }), row(2, { '2.7': 20 }), row(1, { '2.7': 10 })]);
    expect(r.line.map((p) => p[r.series[0].id])).toEqual([10, 20, 30]);
    expect(r.pie[0].count).toBe(30);
    expect(r.total).toBe(30);
    expect(r.windowHours).toBe(168);
  });

  it('ignores rows with no by_type', () => {
    const r = buildFirmwareAdoption([row(2), row(1, { '2.7': 4 })]);
    expect(r.line).toHaveLength(1);
    expect(r.pie[0].count).toBe(4);
  });

  it('handles empty input', () => {
    expect(buildFirmwareAdoption([])).toEqual({ series: [], pie: [], line: [], windowHours: null, total: 0 });
  });

  it('uses dot-free series ids', () => {
    const r = buildFirmwareAdoption([row(1, { '2.7': 1, '2.8': 1, unknown: 1 })]);
    for (const s of r.series) expect(s.id).toMatch(/^series\d+$/);
  });

  it('computes percentages', () => {
    const r = buildFirmwareAdoption([row(1, { '2.7': 3, unknown: 1 })]);
    expect(r.pie.map((p) => p.percent)).toEqual([75, 25]);
  });
});

describe('buildFirmwareTrend', () => {
  const adoption = buildFirmwareAdoption([row(1, { '2.7': 9 }), row(5, { '2.7': 8 }), row(8, { '2.7': 7 })]);
  const window = { start: new Date('2026-11-04T06:00:00Z'), end: new Date('2026-11-09T10:00:00Z') };

  it('keeps one row per UTC day inside the window and floors the start to its day', () => {
    const trend = buildFirmwareTrend(adoption, window);
    expect(trend.rows.map((r) => r.timestamp)).toEqual([Date.UTC(2026, 10, 5), Date.UTC(2026, 10, 8)]);
    expect(trend.window.start.toISOString()).toBe('2026-11-04T00:00:00.000Z');
    expect(trend.window.end).toEqual(window.end);
  });

  it('is empty when no snapshot falls in the window', () => {
    const trend = buildFirmwareTrend(adoption, { start: new Date('2026-11-09T00:00:00Z'), end: window.end });
    expect(trend.rows).toEqual([]);
  });
});

describe('describeWindow', () => {
  it('is a whole phrase when the window is unknown', () => {
    expect(describeWindow(null)).toBe('nodes heard recently');
    expect(describeWindow(0)).toBe('nodes heard recently');
  });

  it('says hours for 24h and for windows that are not whole days', () => {
    expect(describeWindow(24)).toBe('nodes heard in the last 24h');
    expect(describeWindow(36)).toBe('nodes heard in the last 36h');
  });

  it('says days for whole days beyond one', () => {
    expect(describeWindow(168)).toBe('nodes heard in the last 7d');
  });
});
