export interface NiceAxis {
  /** Round top of the axis; always > the input maximum (except 0..1 for tiny data). */
  max: number;
  /** Whole, distinct, ascending ticks from 0 to `max`. */
  ticks: number[];
}

const STEP_MULTIPLIERS = [1, 2, 5, 10];

/**
 * Round a data maximum up to a "nice" axis top (1, 2, 5 x 10^k steps) with whole-number ticks.
 * Always leaves headroom above the maximum. Never returns fewer than two ticks, so tiny or empty data
 * still gets a 0..1 axis.
 *
 * @param maxValue largest value that must fit on the axis
 * @param targetIntervals roughly how many gaps between ticks to aim for
 */
export function niceAxisMax(maxValue: number, targetIntervals = 5): NiceAxis {
  const safe = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0;
  if (safe < 1) return { max: 1, ticks: [0, 1] };

  const rawStep = safe / targetIntervals;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = Math.max(1, (STEP_MULTIPLIERS.find((m) => m * magnitude >= rawStep) ?? 10) * magnitude);

  // floor + 1: a maximum that is already a step multiple still gets one step of headroom.
  const intervals = Math.floor(safe / step) + 1;
  const ticks = Array.from({ length: intervals + 1 }, (_, i) => i * step);
  return { max: intervals * step, ticks };
}

/**
 * Largest per-row stack total across rows of `{ timestamp, ...series }`, ignoring `timestamp`.
 * Use for stacked charts, where the axis must fit the sum of the series, not the biggest one.
 */
export function maxStackTotal(rows: Record<string, number>[]): number {
  return rows.reduce((max, row) => {
    const total = Object.entries(row)
      .filter(([k]) => k !== 'timestamp')
      .reduce((sum, [, v]) => sum + (Number.isFinite(v) ? v : 0), 0);
    return Math.max(max, total);
  }, 0);
}
