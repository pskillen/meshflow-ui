import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { FeederReachData } from '@/lib/api/meshflow-api';

import { useMeshtasticApi } from './useApi';

export interface UseFeederReachParams {
  feederId?: number;
  triggeredAtAfter?: Date;
  triggeredAtBefore?: Date;
  /** Comma-separated strategy tokens for `target_strategy` (omit when all strategies). */
  targetStrategy?: string;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/** Round a Date down to the nearest 5 minutes for stable cache keys. */
function roundToFiveMinutes(d: Date): string {
  return new Date(Math.floor(d.getTime() / FIVE_MINUTES_MS) * FIVE_MINUTES_MS).toISOString();
}

export function useFeederReach(params: UseFeederReachParams) {
  const api = useMeshtasticApi();
  const triggeredAtAfter = params.triggeredAtAfter ? params.triggeredAtAfter.toISOString() : undefined;
  const triggeredAtBefore = params.triggeredAtBefore ? params.triggeredAtBefore.toISOString() : undefined;

  // Stable cache keys: round timestamps to the nearest 5 minutes so a continuously
  // re-rendering "now" doesn't churn the query.
  const triggeredAtAfterKey = params.triggeredAtAfter ? roundToFiveMinutes(params.triggeredAtAfter) : undefined;
  const triggeredAtBeforeKey = params.triggeredAtBefore ? roundToFiveMinutes(params.triggeredAtBefore) : undefined;

  return useQuery<FeederReachData>({
    queryKey: [
      'feeder-reach',
      {
        feederId: params.feederId,
        triggeredAtAfterKey,
        triggeredAtBeforeKey,
        targetStrategy: params.targetStrategy,
      },
    ],
    enabled: params.feederId != null,
    placeholderData: keepPreviousData,
    queryFn: () =>
      api.getFeederReach({
        feeder_id: params.feederId as number,
        triggered_at_after: triggeredAtAfter,
        triggered_at_before: triggeredAtBefore,
        target_strategy: params.targetStrategy,
      }),
  });
}
