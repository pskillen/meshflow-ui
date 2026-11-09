import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStatsRange, type StatsRange } from '@/hooks/useStatsRange';
import type { StatsRangeKey } from '@/lib/stats-range';

/** Area shared by the traceroute stats page and the four traceroute map pages. */
export const TRACEROUTE_RANGE_AREA = 'traceroutes';
export const MAP_SINCE_PARAM = 'since';

const CLEAR_ON_PRESET = [MAP_SINCE_PARAM] as const;

/** Parse `YYYY-MM-DD` as local midnight; null if malformed or not a real date. */
export function parseSinceParam(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

export interface MapRange {
  range: StatsRange;
  /** Preset to highlight; null while a custom `since` date is active. */
  barValue: StatsRangeKey | null;
  /** Custom start date, when the screen allows custom and the URL has a valid `?since=`. */
  since: Date | null;
  /** Lower bound to send to the API: the custom date, else the preset window start (a fixed N x 24h window). */
  triggeredAtAfter: Date;
  setPreset: (key: StatsRangeKey) => void;
  /** `YYYY-MM-DD`, or null to clear. */
  setSince: (date: string | null) => void;
}

/**
 * Time range for the traceroute map pages: the shared preset range plus, where `allowCustom`, a custom
 * "since" date held in `?since=YYYY-MM-DD`. The map endpoints have no end bound, so custom is open-ended.
 */
export function useMapRange({ allowCustom = false }: { allowCustom?: boolean } = {}): MapRange {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = useStatsRange({ area: TRACEROUTE_RANGE_AREA, clearOnChange: CLEAR_ON_PRESET });
  const sinceRaw = searchParams.get(MAP_SINCE_PARAM);
  const since = useMemo(() => (allowCustom ? parseSinceParam(sinceRaw) : null), [allowCustom, sinceRaw]);

  const setSince = useCallback(
    (date: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (date) next.set(MAP_SINCE_PARAM, date);
          else next.delete(MAP_SINCE_PARAM);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return {
    range,
    barValue: since ? null : range.key,
    since,
    triggeredAtAfter: since ?? range.window.start,
    setPreset: range.setRange,
    setSince,
  };
}
