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

/**
 * Axis that hugs the data instead of starting at 0, for readings that sit in a narrow band (battery volts, 3.4 to
 * 4.2). Pads the span by 10%, picks a 1/2/5 step for about `targetIntervals` gaps and snaps both ends to it.
 * A flat series still gets a visible span.
 */
export function fitAxis(min: number, max: number, targetIntervals = 4): { min: number; max: number; ticks: number[] } {
  let lo = Number.isFinite(min) ? min : 0;
  let hi = Number.isFinite(max) ? max : lo + 1;
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi - lo < 1e-9) {
    const pad = Math.max(Math.abs(hi) * 0.05, 0.5);
    lo -= pad;
    hi += pad;
  }
  const pad = (hi - lo) * 0.1;
  lo -= pad;
  hi += pad;
  const rawStep = (hi - lo) / targetIntervals;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = (STEP_MULTIPLIERS.find((m) => m * magnitude >= rawStep) ?? 10) * magnitude;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  const round = (n: number) => Number(n.toFixed(decimals));
  const start = round(Math.floor(lo / step) * step);
  const end = round(Math.ceil(hi / step) * step);
  const ticks: number[] = [];
  for (let t = start; t <= end + step / 2; t += step) ticks.push(round(t));
  return { min: start, max: end, ticks };
}
