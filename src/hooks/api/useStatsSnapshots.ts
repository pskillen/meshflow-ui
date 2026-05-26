import { useQuery, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { useMeshtasticApi } from './useApi';
import { PaginatedResponse, StatsSnapshot } from '@/lib/models';
import type { StatsSnapshotsParams } from '@/lib/types';
import { roundToNearestMinutes } from 'date-fns';

function getStatsSnapshotsKey(params?: StatsSnapshotsParams): string {
  if (!params) return 'default';
  const parts: string[] = [params.statType ?? '', params.constellationId?.toString() ?? ''];
  if (params.recordedAtAfter) {
    const rounded = roundToNearestMinutes(params.recordedAtAfter, { nearestTo: 5 });
    parts.push(rounded.toISOString());
  }
  if (params.recordedAtBefore) {
    const rounded = roundToNearestMinutes(params.recordedAtBefore, { nearestTo: 5 });
    parts.push(rounded.toISOString());
  }
  parts.push(params.page?.toString() ?? '', params.page_size?.toString() ?? '');
  return parts.join('-');
}

/**
 * Hook to fetch stats snapshots
 */
export function useStatsSnapshots(params?: StatsSnapshotsParams) {
  const api = useMeshtasticApi();
  const key = ['stats-snapshots', getStatsSnapshotsKey(params)];

  return useQuery<PaginatedResponse<StatsSnapshot>, Error>({
    refetchInterval: 5 * 1000 * 60, // 5 minutes
    queryKey: key,
    queryFn: () => api.getStatsSnapshots(params),
  });
}

/**
 * Suspense-enabled hook to fetch stats snapshots
 * Use inside a <Suspense> boundary.
 */
export function useStatsSnapshotsSuspense(params?: StatsSnapshotsParams) {
  const api = useMeshtasticApi();
  const key = ['stats-snapshots', getStatsSnapshotsKey(params)];

  const query = useSuspenseQuery<PaginatedResponse<StatsSnapshot>, Error>({
    refetchInterval: 5 * 1000 * 60, // 5 minutes
    queryKey: key,
    queryFn: () => api.getStatsSnapshots(params),
  });

  return {
    snapshots: query.data,
  };
}

/**
 * Fetch multiple stat types in parallel. Use inside a <Suspense> boundary.
 * Returns a map of statType -> snapshots.
 */
export function useStatsSnapshotsForTypesSuspense(
  statTypes: readonly string[],
  params: Omit<NonNullable<Parameters<typeof useStatsSnapshotsSuspense>[0]>, 'statType'>
) {
  const api = useMeshtasticApi();

  const queries = useSuspenseQueries({
    queries: statTypes.map((statType) => {
      const st = statType as NonNullable<StatsSnapshotsParams['statType']>;
      const fullParams: StatsSnapshotsParams = { ...params, statType: st };
      return {
        queryKey: ['stats-snapshots', getStatsSnapshotsKey(fullParams)],
        queryFn: () => api.getStatsSnapshots(fullParams),
        refetchInterval: 5 * 1000 * 60,
      };
    }),
  });

  return Object.fromEntries(statTypes.map((statType, i) => [statType, queries[i].data])) as Record<
    (typeof statTypes)[number],
    Awaited<ReturnType<typeof api.getStatsSnapshots>>
  >;
}
