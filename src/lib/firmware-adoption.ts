import type { StatsSnapshot } from '@/lib/models';

export const UNKNOWN_KEY = 'unknown';
export const UNKNOWN_LABEL = 'Unknown';
export const ADOPTION_HISTORY_DAYS = 90;

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
