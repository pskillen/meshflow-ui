import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { ConstellationCoverageData } from '@/lib/api/meshflow-api';

import { useMeshtasticApi } from './useApi';

export interface UseConstellationCoverageParams {
  constellationId?: number;
  triggeredAtAfter?: Date;
  triggeredAtBefore?: Date;
  h3Resolution?: number;
  /** When true, request per-target rows and feeder markers from the API. */
  includeTargets?: boolean;
  /** Comma-separated target_strategy tokens (omit when all strategies). */
  targetStrategy?: string;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function roundToFiveMinutes(d: Date): string {
  return new Date(Math.floor(d.getTime() / FIVE_MINUTES_MS) * FIVE_MINUTES_MS).toISOString();
}

export function useConstellationCoverage(params: UseConstellationCoverageParams) {
  const api = useMeshtasticApi();
  const triggeredAtAfter = params.triggeredAtAfter ? params.triggeredAtAfter.toISOString() : undefined;
  const triggeredAtBefore = params.triggeredAtBefore ? params.triggeredAtBefore.toISOString() : undefined;

  const triggeredAtAfterKey = params.triggeredAtAfter ? roundToFiveMinutes(params.triggeredAtAfter) : undefined;
  const triggeredAtBeforeKey = params.triggeredAtBefore ? roundToFiveMinutes(params.triggeredAtBefore) : undefined;

  return useQuery<ConstellationCoverageData>({
    queryKey: [
      'constellation-coverage',
      {
        constellationId: params.constellationId,
        triggeredAtAfterKey,
        triggeredAtBeforeKey,
        h3Resolution: params.h3Resolution,
        includeTargets: params.includeTargets,
        targetStrategy: params.targetStrategy,
      },
    ],
    enabled: params.constellationId != null,
    placeholderData: keepPreviousData,
    queryFn: () =>
      api.getConstellationCoverage({
        constellation_id: params.constellationId as number,
        triggered_at_after: triggeredAtAfter,
        triggered_at_before: triggeredAtBefore,
        h3_resolution: params.h3Resolution,
        include_targets: params.includeTargets,
        target_strategy: params.targetStrategy,
      }),
  });
}
