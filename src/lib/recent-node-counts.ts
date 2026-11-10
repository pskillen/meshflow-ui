import type { RecentNodeCounts } from '@/hooks/api/useNodes';

/** Fixed "Right now" windows, keyed as the API returns them (hours). "all" is deliberately not shown. */
export const COUNT_COLUMNS = [
  { key: '2', label: 'Online now', short: '2h', window: 'heard in last 2h', hero: true },
  { key: '24', label: 'Active today', short: '24h', window: 'heard in last 24h', hero: false },
  { key: '168', label: 'Active this week', short: '7d', window: 'heard in last 7d', hero: false },
  { key: '720', label: 'Active this month', short: '30d', window: 'heard in last 30d', hero: false },
  { key: '2160', label: 'Known recently', short: '90d', window: 'heard in last 90d', hero: false },
] as const;

export type CountColumnKey = (typeof COUNT_COLUMNS)[number]['key'];

/** Count for a window; `undefined` when the API did not report that window. */
export function countFor(counts: RecentNodeCounts | undefined, key: string): number | undefined {
  return counts?.[key];
}

/** Sum of two protocols' counts for one window, over the parts that are present; `undefined` when neither is. */
export function sumCounts(
  a: RecentNodeCounts | undefined,
  b: RecentNodeCounts | undefined,
  key: string
): number | undefined {
  const parts = [countFor(a, key), countFor(b, key)].filter((v): v is number => v != null);
  return parts.length === 0 ? undefined : parts.reduce((x, y) => x + y, 0);
}
