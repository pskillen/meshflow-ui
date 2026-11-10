import type { StatsSnapshot } from '@/lib/models';

export const UNKNOWN_KEY = 'unknown';
export const UNKNOWN_LABEL = 'Unknown';
/** The split reads the newest snapshot, so the query always reaches back at least this far, whatever the range. */
export const ADOPTION_SPLIT_LOOKBACK_DAYS = 3;

const PALETTE_SIZE = 5;

export interface FirmwareSeries {
  /** Raw `by_type` key, e.g. "2.7" or "unknown". */
  key: string;
  /** Safe id for Recharts dataKey / ChartConfig (raw keys contain dots). */
  id: string;
  label: string;
  color: string;
  /** Drawn dashed so it is distinguishable without relying on hue. */
  dashed: boolean;
}

export interface FirmwarePieSlice {
  id: string;
  /** Unknown: the bar stripes it, as the trend dashes it. */
  dashed: boolean;
  key: string;
  label: string;
  color: string;
  count: number;
  percent: number;
}

export type FirmwareLinePoint = { timestamp: number } & Record<string, number>;

export interface FirmwareAdoption {
  series: FirmwareSeries[];
  pie: FirmwarePieSlice[];
  /** Oldest first. Each point has `timestamp` plus a count per series id. */
  line: FirmwareLinePoint[];
  windowHours: number | null;
  total: number;
}

function numericParts(key: string): number[] | null {
  return /^\d+(\.\d+)*$/.test(key) ? key.split('.').map(Number) : null;
}

function compareParts(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** The split's window as a whole phrase: "nodes heard in the last 7d", "... last 24h", "nodes heard recently". */
export function describeWindow(windowHours: number | null): string {
  if (!windowHours) return 'nodes heard recently';
  const span = windowHours > 24 && windowHours % 24 === 0 ? `${windowHours / 24}d` : `${windowHours}h`;
  return `nodes heard in the last ${span}`;
}

export function buildFirmwareAdoption(rows: StatsSnapshot[]): FirmwareAdoption {
  const withType = rows.filter((r) => r.value?.by_type);
  const keySet = new Set<string>();
  for (const r of withType) Object.keys(r.value.by_type!).forEach((k) => keySet.add(k));

  const keys = [...keySet];
  const numeric = keys
    .filter((k) => k !== UNKNOWN_KEY && numericParts(k))
    .sort((a, b) => compareParts(numericParts(a)!, numericParts(b)!));
  const other = keys.filter((k) => k !== UNKNOWN_KEY && !numericParts(k)).sort();
  const hasUnknown = keySet.has(UNKNOWN_KEY);

  const series: FirmwareSeries[] = [];
  let colorIndex = 0;
  const nextColor = () => `hsl(var(--chart-${(colorIndex++ % PALETTE_SIZE) + 1}))`;
  const push = (key: string, label: string, color: string, dashed = false) =>
    series.push({ key, id: `series${series.length}`, label, color, dashed });

  numeric.forEach((key, i) => {
    let label = key;
    if (i === 0) label = `${key} or earlier`;
    else if (i === numeric.length - 1) label = `${key}+`;
    push(key, label, nextColor());
  });
  other.forEach((key) => push(key, key, nextColor()));
  if (hasUnknown) push(UNKNOWN_KEY, UNKNOWN_LABEL, 'hsl(var(--muted-foreground))', true);

  const newestFirst = [...withType].sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at));
  const newest = newestFirst[0];

  const total = newest ? series.reduce((sum, s) => sum + (newest.value.by_type![s.key] ?? 0), 0) : 0;
  const pie: FirmwarePieSlice[] = newest
    ? series
        .map((s) => ({
          id: s.id,
          key: s.key,
          label: s.label,
          color: s.color,
          dashed: s.dashed,
          count: newest.value.by_type![s.key] ?? 0,
          percent: 0,
        }))
        .filter((s) => s.count > 0)
        .map((s) => ({ ...s, percent: total > 0 ? (s.count / total) * 100 : 0 }))
    : [];

  const line: FirmwareLinePoint[] = [...newestFirst].reverse().map((r) => {
    const point: FirmwareLinePoint = { timestamp: Date.parse(r.recorded_at) };
    for (const s of series) point[s.id] = r.value.by_type![s.key] ?? 0;
    return point;
  });

  return { series, pie, line, windowHours: newest?.value.window_hours ?? null, total };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface FirmwareTrend {
  /** One row per UTC day that has a snapshot (the newest that day), keyed by series id. */
  rows: FirmwareLinePoint[];
  /** The day grid to draw: the range start floored to its UTC day, to the range end. */
  window: { start: Date; end: Date };
}

/**
 * The trend over a range. `node_firmware` is one snapshot a day, so the grid is always daily whatever the range's
 * bucket is; a 24h range holds one or two days. Snapshots before the window's first day are dropped.
 */
export function buildFirmwareTrend(
  adoption: Pick<FirmwareAdoption, 'line'>,
  window: { start: Date; end: Date }
): FirmwareTrend {
  const startDay = Math.floor(window.start.getTime() / DAY_MS) * DAY_MS;
  const byDay = new Map<number, FirmwareLinePoint>();
  for (const point of adoption.line) {
    const day = Math.floor(point.timestamp / DAY_MS) * DAY_MS;
    if (day < startDay || day >= window.end.getTime()) continue;
    byDay.set(day, { ...point, timestamp: day }); // line is oldest first, so the newest of a day wins
  }
  const rows = [...byDay.values()].sort((a, b) => a.timestamp - b.timestamp);
  return { rows, window: { start: new Date(startDay), end: window.end } };
}
