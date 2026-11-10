import { describe, expect, it } from 'vitest';
import {
  bucketMetricRows,
  buildBatteryTrend,
  buildChannelAirTrend,
  buildFieldTrend,
  metricQueryEnd,
} from '@/lib/node-metric-series';
import { metricApiBucket, statsRangeWindow } from '@/lib/stats-range';

const NOW = new Date('2026-11-09T14:30:00Z');
const day = (d: number) => new Date(Date.UTC(2026, 10, d));
const bucketRow = (d: number, over: Record<string, number | null>) => ({
  node: 1,
  reported_time: day(d),
  samples: 4,
  voltage: null,
  battery_level: null,
  ...over,
});

describe('metricApiBucket', () => {
  it('maps range buckets to the API values', () => {
    expect(metricApiBucket('hourly')).toBe('1h');
    expect(metricApiBucket('6h')).toBe('6h');
    expect(metricApiBucket('daily')).toBe('1d');
  });
});

describe('metricQueryEnd', () => {
  it('reaches one hour past the exclusive window end so the current hour is included', () => {
    const w = statsRangeWindow('7d', NOW);
    expect(metricQueryEnd(w).getTime() - w.end.getTime()).toBe(3_600_000);
  });
});

describe('bucketMetricRows', () => {
  it('passes API-bucketed rows through, keeping nulls as gaps', () => {
    const rows = bucketMetricRows([bucketRow(5, { voltage: 3.9 }), bucketRow(6, { voltage: null })], ['voltage'], 'daily');
    expect(rows).toEqual([{ timestamp: day(5).getTime(), voltage: 3.9 }, { timestamp: day(6).getTime() }]);
  });

  it('rolls raw rows up when the API ignored bucket, ignoring 101 unless every reading is 101', () => {
    const raw = (h: number, level: number) => ({
      reported_time: new Date(Date.UTC(2026, 10, 5, h)),
      battery_level: level,
    });
    const mixed = bucketMetricRows([raw(1, 80), raw(2, 101), raw(3, 60)], ['battery_level'], 'daily');
    expect(mixed[0]!.battery_level).toBe(70);
    const powered = bucketMetricRows([raw(1, 101), raw(2, 101)], ['battery_level'], 'daily');
    expect(powered[0]!.battery_level).toBe(101);
  });
});

describe('bucketMetricRows, raw rows', () => {
  const raw = (h: number, over: Record<string, number | null>) => ({
    reported_time: new Date(Date.UTC(2026, 10, 5, h, 10)),
    voltage: null,
    battery_level: null,
    ...over,
  });

  it('leaves a 0 voltage or 0 level out of the mean, unless every reading is 0', () => {
    const rows = [
      raw(1, { voltage: 3.9, battery_level: 80 }),
      raw(1, { voltage: 0, battery_level: 0 }),
      raw(2, { voltage: 0, battery_level: 0 }),
    ];
    const [a, b] = bucketMetricRows(rows, ['voltage', 'battery_level'], 'hourly');
    expect(a).toMatchObject({ voltage: 3.9, battery_level: 80 });
    expect(b).toMatchObject({ voltage: 0, battery_level: 0 });
  });

  it('keeps a 0 in other fields (channel use of 0% is a reading)', () => {
    const rows = [
      { ...raw(1, {}), meshtastic_channel_utilization: 0 },
      { ...raw(1, {}), meshtastic_channel_utilization: 10 },
    ];
    expect(bucketMetricRows(rows, ['meshtastic_channel_utilization'], 'hourly')[0]).toMatchObject({
      meshtastic_channel_utilization: 5,
    });
  });
});

describe('buildBatteryTrend', () => {
  const w = statsRangeWindow('30d', NOW);

  it('shows a bucket of 101 as Powered, not a 101% point', () => {
    const t = buildBatteryTrend([bucketRow(5, { battery_level: 101, voltage: 5 })], 'percentage', w, 'daily');
    expect(t.rows.every((r) => r.value == null)).toBe(true);
    expect(t.poweredBuckets).toBe(1);
    expect(t.latest).toEqual({ kind: 'powered' });
    expect(t.hasData).toBe(false);
  });

  it('treats a 0 voltage as missing, and a 0 level without voltage as missing', () => {
    const t = buildBatteryTrend([bucketRow(5, { voltage: 0, battery_level: 0 })], 'voltage', w, 'daily');
    expect(t.hasData).toBe(false);
    expect(t.latest).toEqual({ kind: 'none' });
    const pct = buildBatteryTrend([bucketRow(5, { voltage: 0, battery_level: 0 })], 'percentage', w, 'daily');
    expect(pct.hasData).toBe(false);
  });

  it('keeps a real 0% level that has a voltage', () => {
    const t = buildBatteryTrend([bucketRow(5, { voltage: 3.1, battery_level: 0 })], 'percentage', w, 'daily');
    expect(t.rows[0]!.value).toBe(0);
  });

  it('plots volts and percent from the same rows, one mode at a time', () => {
    const history = [bucketRow(5, { voltage: 3.8, battery_level: 71.4 })];
    expect(buildBatteryTrend(history, 'voltage', w, 'daily').rows[0]!.value).toBe(3.8);
    expect(buildBatteryTrend(history, 'percentage', w, 'daily').rows[0]!.value).toBe(71);
  });

  it('marks the bucket in progress as partial', () => {
    const t = buildBatteryTrend([bucketRow(9, { voltage: 3.8 })], 'voltage', w, 'daily');
    expect(t.rows[0]!.partial).toBe(true);
  });
});

describe('buildChannelAirTrend', () => {
  it('keeps both percent series on one row set', () => {
    const w = statsRangeWindow('7d', NOW);
    const t = buildChannelAirTrend(
      [bucketRow(5, { meshtastic_channel_utilization: 12.5, meshtastic_air_util_tx: 1.2 })],
      w,
      '6h'
    );
    expect(t.rows[0]).toMatchObject({ channel: 12.5, air: 1.2 });
    expect(t.latestChannel).toBe(12.5);
  });
});

describe('buildFieldTrend', () => {
  it('lists only the fields that have a reading', () => {
    const w = statsRangeWindow('30d', NOW);
    const t = buildFieldTrend(
      [bucketRow(5, { temperature: 11, relative_humidity: null })],
      ['temperature', 'relative_humidity'],
      w,
      'daily'
    );
    expect(t.present).toEqual(['temperature']);
    expect(t.latest.temperature).toBe(11);
  });
});
