import { describeBattery, POWERED_BATTERY_LEVEL, type BatteryDisplay } from '@/lib/battery';
import type { StatsBucket, StatsRangeWindow } from '@/lib/stats-range';
import { markPartialBuckets, TREND_BUCKET_MS, type TrendInputRow, type TrendRow } from '@/lib/stats-trend';

/** A history row of any of the three metric endpoints, bucketed (has `samples`) or raw (has not). */
export type MetricHistoryRow = { reported_time: Date | string | null; samples?: number } & Record<string, unknown>;

/**
 * Query end for a metric history request. The window's `end` is exclusive and sits on the current UTC hour, so a
 * request ending there would cut off the hour in progress; one hour more takes the newest reports.
 */
export function metricQueryEnd(window: Pick<StatsRangeWindow, 'end'>): Date {
  return new Date(window.end.getTime() + 3_600_000);
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Ingestion stores a missing voltage or battery level as 0, so a 0 here is not a reading. */
const ZERO_MEANS_MISSING = new Set(['voltage', 'battery_level']);

/**
 * One value per bucket start for each field. Rows the API already bucketed (they carry `samples`) pass through.
 * Raw rows (an API without `bucket`) are rolled up as the API does: mean of the non-null readings, except that
 * `battery_level` ignores 101 ("Powered") unless every reading was 101, and voltage and level ignore 0 (a missing
 * reading) unless every reading was 0, so one empty report does not drag the mean down. A bucketed response is
 * used as it comes: api#514 excludes those zeros itself.
 */
export function bucketMetricRows(
  rows: readonly MetricHistoryRow[],
  fields: readonly string[],
  bucket: StatsBucket
): TrendInputRow[] {
  const step = TREND_BUCKET_MS[bucket];
  const groups = new Map<number, MetricHistoryRow[]>();
  for (const row of rows) {
    if (row.reported_time == null) continue;
    const ms = new Date(row.reported_time).getTime();
    if (!Number.isFinite(ms)) continue;
    const ts = row.samples != null ? ms : Math.floor(ms / step) * step;
    groups.set(ts, [...(groups.get(ts) ?? []), row]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([timestamp, group]) => {
      const out: TrendInputRow = { timestamp };
      for (const f of fields) {
        if (group.length === 1 && group[0]!.samples != null) {
          const v = num(group[0]![f]);
          if (v != null) out[f] = v;
          continue;
        }
        let values = group.map((r) => num(r[f])).filter((v): v is number => v != null);
        if (ZERO_MEANS_MISSING.has(f)) {
          const nonZero = values.filter((v) => v !== 0);
          values = nonZero.length ? nonZero : values;
        }
        if (f === 'battery_level') {
          const real = values.filter((v) => v < POWERED_BATTERY_LEVEL);
          values = real.length ? real : values;
        }
        if (values.length) out[f] = values.reduce((a, b) => a + b, 0) / values.length;
      }
      return out;
    });
}

/** Mark the bucket in progress (from the window's `lastBucketStart`); no thin-first-bucket rule, see below. */
function markRows(rows: TrendInputRow[], window: StatsRangeWindow, bucket: StatsBucket): TrendRow[] {
  // `samples` here counts reports, not hourly samples, so it must not feed the "thin first bucket" test.
  return markPartialBuckets(rows, window, bucket);
}

export type BatteryMode = 'voltage' | 'percentage';

export interface BatteryTrend {
  /** One series, `value`: volts or percent, by mode. */
  rows: TrendRow[];
  /** Buckets whose battery reading is "Powered" (101). They are not plotted in percentage mode. */
  poweredBuckets: number;
  /** The newest bucket with any battery reading, as `describeBattery` reads it. */
  latest: BatteryDisplay;
  /** Newest plotted volts. */
  latestVoltage: number | null;
  /** True when there is something to plot in this mode. */
  hasData: boolean;
}

/**
 * Battery rows for one chart mode. The device stores a missing battery, voltage or utilisation as 0, so a 0 voltage
 * is dropped, and a 0 level is dropped when the voltage is missing too (a flat battery still reports volts). A level
 * of 101 means "Powered": it is counted, not plotted as 101%.
 */
export function buildBatteryTrend(
  history: readonly MetricHistoryRow[],
  mode: BatteryMode,
  window: StatsRangeWindow,
  bucket: StatsBucket
): BatteryTrend {
  const base = bucketMetricRows(history, ['voltage', 'battery_level'], bucket);
  let poweredBuckets = 0;
  let latest: BatteryDisplay = { kind: 'none' };
  let latestVoltage: number | null = null;
  const rows: TrendInputRow[] = base.map((r) => {
    const volts = typeof r.voltage === 'number' && r.voltage > 0 ? r.voltage : null;
    let level = typeof r.battery_level === 'number' ? r.battery_level : null;
    if (level === 0 && volts == null) level = null;
    const display = describeBattery(level);
    if (display.kind === 'powered') poweredBuckets += 1;
    if (display.kind !== 'none') latest = display;
    if (volts != null) latestVoltage = volts;
    const out: TrendInputRow = { timestamp: r.timestamp };
    if (mode === 'voltage') {
      if (volts != null) out.value = volts;
    } else if (display.kind === 'level') {
      out.value = display.pct;
    }
    return out;
  });
  return {
    rows: markRows(rows, window, bucket),
    poweredBuckets,
    latest,
    latestVoltage,
    hasData: rows.some((r) => typeof r.value === 'number'),
  };
}

export interface ChannelAirTrend {
  /** Series `channel` and `air`, both percent. */
  rows: TrendRow[];
  latestChannel: number | null;
  hasData: boolean;
}

/** Channel utilisation and air-time TX, both percent, so they share one axis. */
export function buildChannelAirTrend(
  history: readonly MetricHistoryRow[],
  window: StatsRangeWindow,
  bucket: StatsBucket
): ChannelAirTrend {
  const base = bucketMetricRows(history, ['meshtastic_channel_utilization', 'meshtastic_air_util_tx'], bucket);
  let latestChannel: number | null = null;
  const rows = base.map((r) => {
    const out: TrendInputRow = { timestamp: r.timestamp };
    if (typeof r.meshtastic_channel_utilization === 'number') {
      out.channel = r.meshtastic_channel_utilization;
      latestChannel = r.meshtastic_channel_utilization;
    }
    if (typeof r.meshtastic_air_util_tx === 'number') out.air = r.meshtastic_air_util_tx;
    return out;
  });
  return {
    rows: markRows(rows, window, bucket),
    latestChannel,
    hasData: rows.some((r) => r.channel != null || r.air != null),
  };
}

export interface FieldTrend {
  rows: TrendRow[];
  /** The fields that have any reading in the window. */
  present: string[];
  /** Newest value per field. */
  latest: Record<string, number>;
}

/** Rows for `fields` (kept under the same keys) and which of them have any reading at all. */
export function buildFieldTrend(
  history: readonly MetricHistoryRow[],
  fields: readonly string[],
  window: StatsRangeWindow,
  bucket: StatsBucket
): FieldTrend {
  const base = bucketMetricRows(history, fields, bucket);
  const latest: Record<string, number> = {};
  for (const r of base) for (const f of fields) if (typeof r[f] === 'number') latest[f] = r[f] as number;
  return { rows: markRows(base, window, bucket), present: fields.filter((f) => f in latest), latest };
}
