import { describe, expect, it } from 'vitest';
import type { PaginatedResponse, StatsSnapshot } from '@/lib/models';
import { comparePeriods, formatDelta } from '@/lib/stats-delta';
import { comparisonWindows, statsRangeWindow } from '@/lib/stats-range';
import type { StatsSnapshotStatType } from '@/lib/stats-snapshot-types';

const utc = (...a: [number, number, number, number?]) => new Date(Date.UTC(...a));
const HOUR = 3_600_000;

type Row = { at: number; count: number; samples?: number };

function page(stat: StatsSnapshotStatType, rows: Row[], extraCount = 0): PaginatedResponse<StatsSnapshot> {
  const results = rows.map((r, i) => ({
    id: i,
    recorded_at: new Date(r.at).toISOString(),
    stat_type: stat,
    constellation_id: null,
    value: { count: r.count, ...(r.samples != null ? { samples: r.samples } : {}) },
  })) as unknown as StatsSnapshot[];
  return { count: results.length + extraCount, next: null, previous: null, results } as PaginatedResponse<StatsSnapshot>;
}

/** One hourly row per hour in [start, end), each with the given count. */
function hourly(start: Date, end: Date, count: number): Row[] {
  const rows: Row[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += HOUR) rows.push({ at: t, count });
  return rows;
}

const now = utc(2026, 10, 9, 14);
const w24 = statsRangeWindow('24h', now);
const c24 = comparisonWindows(w24, 'hourly');

function run(
  over: Partial<Parameters<typeof comparePeriods>[0]> & {
    cur?: Row[];
    prev?: Row[] | null;
    stat?: StatsSnapshotStatType;
  }
) {
  const stat = over.stat ?? 'packet_volume';
  return comparePeriods({
    currentPages: { [stat]: page(stat, over.cur ?? []) },
    previousPages: over.prev === null ? undefined : { [stat]: page(stat, over.prev ?? []) },
    scope: 'meshtastic',
    mtStat: stat,
    mcStat: 'mc_packet_volume',
    mode: 'sum',
    windows: c24,
    bucket: 'hourly',
    ...over,
  });
}

describe('comparePeriods', () => {
  it('flows sum', () => {
    const d = run({
      cur: hourly(c24.current.start, c24.current.end, 12),
      prev: hourly(c24.previous.start, c24.previous.end, 10),
    });
    expect(d).toEqual({ kind: 'change', pct: 20, current: 288, previous: 240 });
  });

  it('gauges average', () => {
    const d = run({
      stat: 'online_nodes',
      mtStat: 'online_nodes',
      mode: 'average',
      cur: hourly(c24.current.start, c24.current.end, 110),
      prev: hourly(c24.previous.start, c24.previous.end, 100),
    });
    expect(d).toMatchObject({ kind: 'change', pct: 10, current: 110, previous: 100 });
  });

  it('leaves out the in-progress bucket on both sides', () => {
    const w = statsRangeWindow('7d', utc(2026, 10, 9, 14));
    const c = comparisonWindows(w, '6h');
    const cur = hourly(c.current.start, c.current.end, 1);
    // Rows in the bucket in progress (12:00-14:00) must not count.
    cur.push({ at: utc(2026, 10, 9, 12).getTime(), count: 1000 }, { at: utc(2026, 10, 9, 13).getTime(), count: 1000 });
    const prev = hourly(c.previous.start, c.previous.end, 1);
    const d = run({ windows: c, bucket: '6h', cur, prev });
    expect(d).toMatchObject({ kind: 'change', pct: 0, current: 168, previous: 168 });
  });

  it('a previous window below 90% coverage is neutral', () => {
    const prev = hourly(c24.previous.start, c24.previous.end, 10).slice(0, 20); // 20/24 = 83%
    const d = run({ cur: hourly(c24.current.start, c24.current.end, 10), prev });
    expect(d).toEqual({ kind: 'none', reason: 'thin-coverage' });
  });

  it('a previous window in a snapshot hole (no rows) is neutral', () => {
    const d = run({ cur: hourly(c24.current.start, c24.current.end, 10), prev: [] });
    expect(d).toEqual({ kind: 'none', reason: 'thin-coverage' });
  });

  it('just over 90% coverage (22 of 24) still compares', () => {
    const cur = hourly(c24.current.start, c24.current.end, 10);
    const prev = hourly(c24.previous.start, c24.previous.end, 10).slice(0, 22); // 22/24 = 91.7%
    expect(run({ cur, prev }).kind).toBe('change');
  });

  it('flows are scaled to the full window, so missing hours are not read as change', () => {
    const cur = hourly(c24.current.start, c24.current.end, 10);
    const prev = hourly(c24.previous.start, c24.previous.end, 10).slice(0, 22); // 22/24, same rate
    expect(run({ cur, prev })).toMatchObject({ kind: 'change', pct: 0, current: 240, previous: 240 });
  });

  it('both scope needs each protocol covered, not the pooled total', () => {
    const both = (mcPrev: Row[]) =>
      comparePeriods({
        currentPages: {
          packet_volume: page('packet_volume', hourly(c24.current.start, c24.current.end, 10)),
          mc_packet_volume: page('mc_packet_volume', hourly(c24.current.start, c24.current.end, 5)),
        },
        previousPages: {
          packet_volume: page('packet_volume', hourly(c24.previous.start, c24.previous.end, 10)),
          mc_packet_volume: page('mc_packet_volume', mcPrev),
        },
        scope: 'both',
        mtStat: 'packet_volume',
        mcStat: 'mc_packet_volume',
        mode: 'sum',
        windows: c24,
        bucket: 'hourly',
      });
    const mcFull = hourly(c24.previous.start, c24.previous.end, 5);
    // MC at 20/24 (83%) while MT is full: pooled would be 44/48 (92%) and pass.
    expect(both(mcFull.slice(0, 20))).toEqual({ kind: 'none', reason: 'thin-coverage' });
    expect(both(mcFull)).toMatchObject({ kind: 'change', pct: 0 });
  });

  it('previous = 0 is neutral', () => {
    const d = run({
      cur: hourly(c24.current.start, c24.current.end, 5),
      prev: hourly(c24.previous.start, c24.previous.end, 0),
    });
    expect(d).toEqual({ kind: 'none', reason: 'no-previous-data' });
  });

  it('a truncated page is neutral', () => {
    const stat = 'packet_volume';
    const d = comparePeriods({
      currentPages: { [stat]: page(stat, hourly(c24.current.start, c24.current.end, 5), 50) },
      previousPages: { [stat]: page(stat, hourly(c24.previous.start, c24.previous.end, 5)) },
      scope: 'meshtastic',
      mtStat: stat,
      mcStat: 'mc_packet_volume',
      mode: 'sum',
      windows: c24,
      bucket: 'hourly',
    });
    expect(d).toEqual({ kind: 'none', reason: 'truncated' });
  });

  it('undefined previous pages are loading', () => {
    expect(run({ cur: [], prev: null })).toEqual({ kind: 'none', reason: 'loading' });
  });

  it('both scope sums the protocols', () => {
    const d = comparePeriods({
      currentPages: {
        packet_volume: page('packet_volume', hourly(c24.current.start, c24.current.end, 10)),
        mc_packet_volume: page('mc_packet_volume', hourly(c24.current.start, c24.current.end, 5)),
      },
      previousPages: {
        packet_volume: page('packet_volume', hourly(c24.previous.start, c24.previous.end, 10)),
        mc_packet_volume: page('mc_packet_volume', hourly(c24.previous.start, c24.previous.end, 5)),
      },
      scope: 'both',
      mtStat: 'packet_volume',
      mcStat: 'mc_packet_volume',
      mode: 'sum',
      windows: c24,
      bucket: 'hourly',
    });
    expect(d).toMatchObject({ kind: 'change', pct: 0, current: 360, previous: 360 });
  });

  it('the 90% boundary is inclusive: 27 of 30 days compares, 26 does not', () => {
    const w = statsRangeWindow('30d', now);
    const c = comparisonWindows(w, 'daily');
    const days = (start: Date, end: Date): Row[] => {
      const rows: Row[] = [];
      for (let t = start.getTime(); t < end.getTime(); t += 24 * HOUR) rows.push({ at: t, count: 100, samples: 24 });
      return rows;
    };
    const base = { stat: 'online_nodes' as const, mtStat: 'online_nodes' as const, mode: 'average' as const };
    const cur = days(c.current.start, c.current.end);
    const prev = days(c.previous.start, c.previous.end);
    expect(c.buckets).toBe(30);
    expect(run({ ...base, windows: c, bucket: 'daily', cur, prev: prev.slice(0, 27) }).kind).toBe('change');
    expect(run({ ...base, windows: c, bucket: 'daily', cur, prev: prev.slice(0, 26) })).toEqual({
      kind: 'none',
      reason: 'thin-coverage',
    });
  });

  it('daily rollups count value.samples for coverage and weight gauges by it', () => {
    const w = statsRangeWindow('30d', now);
    const c = comparisonWindows(w, 'daily');
    const days = (start: Date, end: Date, count: number, samples: number): Row[] => {
      const rows: Row[] = [];
      for (let t = start.getTime(); t < end.getTime(); t += 24 * HOUR) rows.push({ at: t, count, samples });
      return rows;
    };
    const full = run({
      stat: 'online_nodes',
      mtStat: 'online_nodes',
      mode: 'average',
      windows: c,
      bucket: 'daily',
      cur: days(c.current.start, c.current.end, 120, 24),
      prev: days(c.previous.start, c.previous.end, 100, 24),
    });
    expect(full).toMatchObject({ kind: 'change', pct: 20 });
    // Days present but only 12 of 24 hourly samples each: 50% coverage.
    const thin = run({
      stat: 'online_nodes',
      mtStat: 'online_nodes',
      mode: 'average',
      windows: c,
      bucket: 'daily',
      cur: days(c.current.start, c.current.end, 120, 24),
      prev: days(c.previous.start, c.previous.end, 100, 12),
    });
    expect(thin).toEqual({ kind: 'none', reason: 'thin-coverage' });
  });
});

describe('formatDelta', () => {
  const ch = (pct: number) => ({ kind: 'change' as const, pct, current: 1, previous: 1 });
  it('formats signs with a real minus', () => {
    expect(formatDelta(ch(12), '7d')).toBe('+12% vs previous 7d');
    expect(formatDelta(ch(-4), '7d')).toBe('−4% vs previous 7d');
    expect(formatDelta(ch(0), '7d')).toBe('No change vs previous 7d');
  });
  it('neutral states', () => {
    expect(formatDelta({ kind: 'none', reason: 'thin-coverage' }, '7d')).toBe('No comparison');
    expect(formatDelta({ kind: 'none', reason: 'truncated' }, '7d')).toBe('No comparison');
    expect(formatDelta({ kind: 'none', reason: 'loading' }, '7d')).toBeUndefined();
  });
});
