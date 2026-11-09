import { startOfDay, subDays, subHours } from 'date-fns';

export interface DateWindow {
  startDate: Date;
  endDate: Date;
}

/**
 * Turn a preset key into a date window ending at `now`.
 * - `1d` means "today" (local midnight to now).
 * - `Nd` (N > 1) is exactly N x 24 hours, so a clock-change day neither adds nor drops an hour
 *   and the aggregation bucket chosen for the span does not flip.
 * - `Nh` is N hours.
 * - Anything else falls back to 7 days.
 *
 * Every consumer (initial state and re-select) must use this so load and re-select agree.
 */
export function windowForTimeRangeKey(key: string, now: Date = new Date()): DateWindow {
  if (key.endsWith('d')) {
    const days = parseInt(key, 10);
    if (Number.isFinite(days)) {
      if (days === 1) return { startDate: startOfDay(now), endDate: now };
      return { startDate: subHours(now, days * 24), endDate: now };
    }
  } else if (key.endsWith('h')) {
    const hours = parseInt(key, 10);
    if (Number.isFinite(hours)) return { startDate: subHours(now, hours), endDate: now };
  }
  return { startDate: subDays(now, 7), endDate: now };
}
