import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  STATS_PRESET_KEYS,
  STATS_RANGES,
  defaultStatsRange,
  parseStatsRange,
  statsRangeWindow,
  windowStabilityTick,
  type StatsBucket,
  type StatsRangeDef,
  type StatsRangeKey,
  type StatsRangeWindow,
} from '@/lib/stats-range';

export const STATS_RANGE_PARAM = 'range';
const STORAGE_PREFIX = 'meshflow.statsRange.';

export interface UseStatsRangeOptions {
  /**
   * Name of the area this screen belongs to (for example 'dashboards'). Screens in the same area share the last
   * chosen range when the URL has none. Leave undefined for no memory (node pages: a different node must not
   * inherit the last node's range).
   */
  area?: string;
  /** Ranges this screen allows. Defaults to the four presets. Add '2h' on node lists only. */
  options?: readonly StatsRangeKey[];
  /**
   * Hold the range in component state instead of the URL, for content rendered inside a slide-over on another page
   * (NodeDetailSheet). Never reads or writes the host page's URL or the area memory.
   */
  local?: boolean;
  /** Injected clock, for tests. */
  now?: () => Date;
}

export interface StatsRange {
  key: StatsRangeKey;
  def: StatsRangeDef;
  label: string;
  /** Wording for titles: "last 7 days". */
  longLabel: string;
  bucket: StatsBucket;
  bucketLabel: string;
  /** Stable across renders: only changes with the key, and once an hour (every 5 minutes for 2h). */
  window: StatsRangeWindow;
  /** The allowed options, in order, as passed to the bar. */
  options: readonly StatsRangeKey[];
  setRange: (key: StatsRangeKey) => void;
}

function readStored(area: string | undefined): string | null {
  if (!area) return null;
  try {
    return window.sessionStorage.getItem(STORAGE_PREFIX + area);
  } catch {
    return null;
  }
}

function writeStored(area: string | undefined, key: StatsRangeKey) {
  if (!area) return;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + area, key);
  } catch {
    // storage blocked or full: the range simply isn't remembered
  }
}

/**
 * The one source of the time range for a stats screen.
 *
 * Resolution order: URL `?range=` (if valid for `options`) > the last range remembered for `area` this session >
 * 7d (or the first allowed option if 7d is not allowed). An invalid URL value is skipped, not fatal, and the URL is
 * then rewritten to the range in effect.
 * Writes use `replace` and keep every other query param.
 */
export function useStatsRange({
  area,
  options = STATS_PRESET_KEYS,
  local = false,
  now,
}: UseStatsRangeOptions = {}): StatsRange {
  const [searchParams, setSearchParams] = useSearchParams();
  const fallback = defaultStatsRange(options);
  const [localKey, setLocalKey] = useState<StatsRangeKey | null>(null);

  const urlKey = local ? null : parseStatsRange(searchParams.get(STATS_RANGE_PARAM), options);
  const storedKey = local || urlKey ? null : parseStatsRange(readStored(area), options);
  const key: StatsRangeKey = local
    ? ((localKey && options.includes(localKey) ? localKey : null) ?? fallback)
    : (urlKey ?? storedKey ?? fallback);

  // A `?range=` the screen cannot use (garbage, 'all', 2h where not allowed) is rewritten to the range actually in
  // effect, so the address bar never says something the page is not showing.
  const urlHasRange = searchParams.has(STATS_RANGE_PARAM);
  useEffect(() => {
    if (local || !urlHasRange || urlKey) return;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set(STATS_RANGE_PARAM, key);
        return params;
      },
      { replace: true }
    );
  }, [local, urlHasRange, urlKey, key, setSearchParams]);

  // A range arriving by URL (a shared link, a reload) becomes the area's memory too.
  useEffect(() => {
    if (urlKey) writeStored(area, urlKey);
  }, [area, urlKey]);

  const clock = now ?? (() => new Date());
  const currentNow = clock();
  const tick = windowStabilityTick(key, currentNow);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `tick` stands in for the clock: the window may only move when it does
  const window_ = useMemo(() => statsRangeWindow(key, currentNow), [key, tick]);

  const setRange = useCallback(
    (next: StatsRangeKey) => {
      if (!options.includes(next)) return;
      if (local) {
        setLocalKey(next);
        return;
      }
      writeStored(area, next);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set(STATS_RANGE_PARAM, next);
          return params;
        },
        { replace: true }
      );
    },
    [area, local, options, setSearchParams]
  );

  const def = STATS_RANGES[key];
  // Memoised so consumers can put the result (or `range.window`) in dependency arrays without it changing every render.
  return useMemo(
    () => ({
      key,
      def,
      label: def.label,
      longLabel: def.longLabel,
      bucket: def.bucket,
      bucketLabel: def.bucketLabel,
      window: window_,
      options,
      setRange,
    }),
    [key, def, window_, options, setRange]
  );
}
