import { subDays, subHours } from 'date-fns';

export type NodeTimeRangeOption = '2h' | '24h' | '7d' | '30d' | 'all';

export const NODE_TIME_RANGE_OPTIONS: { value: NodeTimeRangeOption; label: string }[] = [
  { value: '2h', label: '2 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
];

export function getLastHeardAfterForRange(timeRange: NodeTimeRangeOption): Date | undefined {
  if (timeRange === 'all') return undefined;
  const now = new Date();
  switch (timeRange) {
    case '2h':
      return subHours(now, 2);
    case '24h':
      return subHours(now, 24);
    case '7d':
      return subDays(now, 7);
    case '30d':
      return subDays(now, 30);
    default:
      return subDays(now, 7);
  }
}
