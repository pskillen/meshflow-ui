import { describe, expect, it } from 'vitest';
import type { StatsSnapshot } from '@/lib/models';
import { statsRangeWindow } from '@/lib/stats-range';
import {
  buildByTypeRows,
  buildCountRows,
  meanOf,
  snapshotParamsForRange,
  totalOf,
  type SnapshotPages,
} from '@/lib/stats-trend-data';

const NOW = new Date('2026-11-09T14:30:00Z');
const DAY = 86_400_000;

function page(rows: Partial<StatsSnapshot>[], count = rows.length): SnapshotPages['online_nodes'] {
  return { count, next: null, previous: null, results: rows as StatsSnapshot[] };
}
const row = (stat: string, ms: number, value: StatsSnapshot['value']) =>
  ({ id: null, recorded_at: new Date(ms).toISOString(), stat_type: stat, constellation_id: null, value }) as Partial<StatsSnapshot>;

describe('snapshotParamsForRange', () => {
  it('sends bucket=1d with a UTC-midnight start for daily ranges only', () => {
    const w = statsRangeWindow('90d', NOW);
    const p = snapshotParamsForRange(w, 'daily');
    expect(p.bucket).toBe('1d');
    expect(p.recordedAtAfter!.getTime() % DAY).toBe(0);
    expect(snapshotParamsForRange(statsRangeWindow('7d', NOW), '6h').bucket).toBeUndefined();
    expect(snapshotParamsForRange(statsRangeWindow('24h', NOW), 'hourly').bucket).toBeUndefined();
  });
});

describe('buildCountRows against a mocked 90d rollup', () => {
  const w = statsRangeWindow('90d', NOW);
  const rolled = Array.from({ length: 91 }, (_, i) => {
    const ts = w.start.getTime() + i * DAY;
    const last = ts === w.lastBucketStart.getTime();
    return row('new_nodes', ts, { count: 3, samples: last ? 14 : 24 });
  });

  it('keeps every rolled day and flags only the day in progress', () => {
    const t = buildCountRows({
      pages: { new_nodes: page(rolled) },
      scope: 'meshtastic',
      mtStat: 'new_nodes',
      mcStat: 'mc_new_nodes',
      mode: 'sum',
      window: w,
      bucket: 'daily',
    });
    expect(t.rows).toHaveLength(91);
    expect(t.rows.filter((r) => r.partial)).toHaveLength(1);
    expect(t.rows[90]?.partial).toBe(true);
    expect(totalOf(t.rows, ['meshtastic'])).toBe(273);
    expect(t.truncated).toBe(false);
  });

  it('degrades when the API ignores bucket: hourly rows are rolled up here, and a short page is flagged', () => {
    const hourly = Array.from({ length: 48 }, (_, i) =>
      row('online_nodes', w.lastBucketStart.getTime() - DAY + i * 3_600_000, { count: i < 24 ? 10 : 20 })
    );
    const t = buildCountRows({
      pages: { online_nodes: page(hourly, 2160) },
      scope: 'meshtastic',
      mtStat: 'online_nodes',
      mcStat: 'mc_online_nodes',
      mode: 'average',
      window: w,
      bucket: 'daily',
    });
    expect(t.rows.map((r) => r.meshtastic)).toEqual([10, 20]);
    expect(t.truncated).toBe(true);
    expect(meanOf(t.rows, ['meshtastic'])).toBe(15);
  });

  it('overlays both protocols as separate series', () => {
    const t = buildCountRows({
      pages: {
        online_nodes: page([row('online_nodes', w.start.getTime(), { count: 5, samples: 24 })]),
        mc_online_nodes: page([row('mc_online_nodes', w.start.getTime(), { count: 2, samples: 24 })]),
      },
      scope: 'both',
      mtStat: 'online_nodes',
      mcStat: 'mc_online_nodes',
      mode: 'average',
      window: w,
      bucket: 'daily',
    });
    expect(t.rows[0]).toMatchObject({ meshtastic: 5, meshcore: 2 });
    expect(meanOf(t.rows, ['meshtastic', 'meshcore'])).toBe(7);
  });
});

describe('buildByTypeRows', () => {
  it('rolls hourly by_type rows into 6h buckets', () => {
    const w = statsRangeWindow('7d', NOW);
    const t0 = w.start.getTime();
    const t = buildByTypeRows({
      page: page([
        row('packet_volume', t0, { count: 3, by_type: { position: 1, text_message: 2 } }),
        row('packet_volume', t0 + 3_600_000, { count: 1, by_type: { position: 1 } }),
      ]),
      window: w,
      bucket: '6h',
    });
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toMatchObject({ timestamp: t0, position: 2, text_message: 2 });
  });
});
