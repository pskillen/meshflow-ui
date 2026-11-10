import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useMeshtasticApi } from './useApi';
import { GlobalStats, NeighbourStats } from '@/lib/models';
import { StatsQueryParams } from '@/lib/types';
import { getKeyValue, roundDateParams } from './hooks-utils';

/**
 * Hook to fetch packet statistics
 * @param params Optional parameters for the query (date range, interval, node ID)
 * @returns Query result with packet statistics
 */
export function usePacketStats(params?: StatsQueryParams) {
  const api = useMeshtasticApi();
  params = roundDateParams(params);

  const keyValue = getKeyValue(params);
  const key = ['stats', keyValue, params?.interval ?? 1, params?.intervalType ?? 'hour'];

  return useQuery<GlobalStats>({
    refetchInterval: 5 * 1000 * 60, // 5 minutes
    queryKey: key,
    queryFn: async () => {
      const { startDate, endDate, nodeId, interval = 1, intervalType = 'hour' } = params || {};

      if (nodeId) {
        return await api.getNodeStats(nodeId, { startDate, endDate, interval, intervalType });
      } else {
        return await api.getGlobalStats({ startDate, endDate, interval, intervalType });
      }
    },
  });
}

/**
 * Suspense-enabled hook to fetch packet statistics
 * Use inside a <Suspense> boundary. No isLoading or error states are returned.
 * Note: Suspense hooks do not support the 'enabled' option.
 */
export function usePacketStatsSuspense(params?: StatsQueryParams) {
  const api = useMeshtasticApi();
  params = roundDateParams(params);
  const keyValue = getKeyValue(params);
  const key = ['stats', keyValue, params?.interval ?? 1, params?.intervalType ?? 'hour'];

  const query = useSuspenseQuery<GlobalStats, Error>({
    refetchInterval: 5 * 1000 * 60, // 5 minutes
    queryKey: key,
    queryFn: async () => {
      const { startDate, endDate, nodeId, interval = 1, intervalType = 'hour' } = params || {};

      if (nodeId) {
        return await api.getNodeStats(nodeId, { startDate, endDate, interval, intervalType });
      } else {
        return await api.getGlobalStats({ startDate, endDate, interval, intervalType });
      }
    },
  });

  return {
    stats: query.data,
  };
}

/**
 * Suspense-enabled hook to fetch received packet statistics
 * Use inside a <Suspense> boundary. No isLoading or error states are returned.
 * Note: Suspense hooks do not support the 'enabled' option.
 */
export function useReceivedPacketStatsSuspense(params?: StatsQueryParams) {
  const api = useMeshtasticApi();
  params = roundDateParams(params);
  const keyValue = getKeyValue(params);
  const key = ['received-stats', keyValue, params?.interval ?? 1, params?.intervalType ?? 'hour'];

  const query = useSuspenseQuery<GlobalStats, Error>({
    refetchInterval: 5 * 1000 * 60, // 5 minutes
    queryKey: key,
    queryFn: async () => {
      const { startDate, endDate, nodeId, interval = 1, intervalType = 'hour' } = params || {};

      if (nodeId) {
        return await api.getNodeReceivedStats(nodeId, { startDate, endDate, interval, intervalType });
      } else {
        // Received stats only make sense for a specific node
        return {
          start_date: startDate?.toISOString() || '',
          end_date: endDate?.toISOString() || '',
          intervals: [],
          summary: {
            total_packets: 0,
            time_range: {
              start: startDate?.toISOString() || '',
              end: endDate?.toISOString() || '',
            },
          },
        };
      }
    },
  });

  return {
    stats: query.data,
  };
}

type NeighbourStatsParams = StatsQueryParams & { nodeId: number; enabled?: boolean };

/**
 * Hook to fetch neighbour stats for a managed node (lazy-loadable via enabled).
 */
export function useNeighbourStats(params?: NeighbourStatsParams) {
  const api = useMeshtasticApi();
  const enabled = params?.enabled ?? true;
  const queryParams: (StatsQueryParams & { nodeId: number }) | undefined = params
    ? { ...params, nodeId: params.nodeId }
    : undefined;
  const roundedParams = roundDateParams(queryParams);
  const nodeId = roundedParams?.nodeId ?? params?.nodeId ?? 0;
  const keyValue = getKeyValue(roundedParams);
  const key = ['neighbour-stats', nodeId, keyValue];

  return useQuery<NeighbourStats, Error>({
    refetchInterval: 5 * 1000 * 60, // 5 minutes
    queryKey: key,
    queryFn: async () => {
      const startDate = roundedParams?.startDate ?? params?.startDate;
      const endDate = roundedParams?.endDate ?? params?.endDate;
      if (!nodeId) {
        return {
          start_date: null,
          end_date: null,
          by_source: [],
          total_packets: 0,
        };
      }
      return api.getNodeNeighbourStats(nodeId, { startDate, endDate });
    },
    enabled: enabled && !!nodeId,
  });
}

/**
 * Suspense-enabled hook to fetch neighbour stats for a managed node
 * Use inside a <Suspense> boundary. No isLoading or error states are returned.
 */
export function useNeighbourStatsSuspense(params?: StatsQueryParams & { nodeId: number }) {
  const api = useMeshtasticApi();
  params = roundDateParams(params);
  const keyValue = getKeyValue(params);
  const key = ['neighbour-stats', params?.nodeId ?? 0, keyValue];

  const query = useSuspenseQuery<NeighbourStats, Error>({
    refetchInterval: 5 * 1000 * 60, // 5 minutes
    queryKey: key,
    queryFn: async () => {
      const { startDate, endDate, nodeId } = params || {};
      if (!nodeId) {
        return {
          start_date: null,
          end_date: null,
          by_source: [],
          total_packets: 0,
        };
      }
      return api.getNodeNeighbourStats(nodeId, { startDate, endDate });
    },
  });

  return {
    stats: query.data,
  };
}
