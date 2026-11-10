import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
  UseQueryOptions,
  useInfiniteQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
  useSuspenseQueries,
} from '@tanstack/react-query';
import { useMeshflowApi } from './useApi';
import {
  DeviceMetrics,
  EnvironmentMetrics,
  ObservedNode,
  Position,
  PowerMetrics,
  ManagedNode,
  OwnedManagedNode,
} from '@/lib/models';
import { DateRangeParams } from '@/lib/types';
import { PaginatedResponse } from '@/lib/models';
import { getKeyValue, roundDateParams } from './hooks-utils';

export interface UseNodesOptions {
  pageSize?: number;
  enabled?: boolean;
  lastHeardAfter?: Date;
}

export interface UseManagedNodesOptions {
  pageSize?: number;
  enabled?: boolean;
}

/**
 * Managed nodes (feeders) only, first page, for pickers and lookups outside Suspense boundaries.
 * Does not fetch observed nodes and does not walk further pages.
 */
export function useManagedNodes(options?: UseManagedNodesOptions) {
  const api = useMeshflowApi();
  const pageSize = options?.pageSize ?? 500;
  const query = useQuery<PaginatedResponse<ManagedNode>, Error>({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: ['managed-nodes', 'first-page', pageSize],
    queryFn: () => api.getManagedNodes({ page: 1, page_size: pageSize }),
    enabled: options?.enabled !== false,
  });
  return {
    managedNodes: query.data?.results ?? [],
    totalManagedNodes: query.data?.count ?? 0,
    isLoadingManagedNodes: query.isLoading,
    managedNodesError: query.error,
  };
}

/**
 * Hook to fetch a single node by ID
 */
export function useNode(
  internalId: string,
  options?: Omit<UseQueryOptions<ObservedNode>, 'queryKey' | 'queryFn'>
): UseQueryResult<ObservedNode> {
  const api = useMeshflowApi();
  return useQuery({
    queryKey: ['nodes', internalId],
    queryFn: () => api.getObservedNode(internalId),
    enabled: !!internalId,
    ...options,
  });
}

/**
 * Hook to fetch a single managed node by ID
 */
export function useManagedNode(
  id: number,
  options?: Omit<UseQueryOptions<ManagedNode>, 'queryKey' | 'queryFn'>
): UseQueryResult<ManagedNode> {
  const api = useMeshflowApi();
  return useQuery({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: ['managed-nodes', id],
    queryFn: () => api.getManagedNode(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to fetch device metrics for a node
 */
export function useNodeMetrics(internalId: string, params?: DateRangeParams): UseQueryResult<DeviceMetrics[]> {
  const api = useMeshflowApi();
  params = roundDateParams(params);
  const keyValue = getKeyValue(params);
  const key = ['nodes', internalId, 'metrics', keyValue];

  return useQuery({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: key,
    queryFn: () => api.getNodeDeviceMetrics(internalId, params),
    enabled: !!internalId,
  });
}

/**
 * Hook to fetch positions for a node
 */
export function useNodePositions(internalId: string, params?: DateRangeParams): UseQueryResult<Position[]> {
  const api = useMeshflowApi();
  params = roundDateParams(params);
  const keyValue = getKeyValue(params);
  const key = ['nodes', internalId, 'positions', keyValue];

  return useQuery({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: key,
    queryFn: () => api.getNodePositions(internalId, params),
    enabled: !!internalId,
  });
}

/**
 * Hook to search for nodes
 */
export function useNodeSearch() {
  const api = useMeshflowApi();
  const queryClient = useQueryClient();

  const searchMutation = useMutation({
    mutationFn: (query: string) => api.searchNodes(query),
    onSuccess: (data) => {
      queryClient.setQueryData(['nodes', 'search'], data);
    },
  });

  return {
    searchNodes: searchMutation.mutate,
    results: searchMutation.data,
    isSearching: searchMutation.isPending,
    error: searchMutation.error,
  };
}

export type RecentNodeCounts = Record<string, number>;

/**
 * Suspense-enabled hook to fetch recent node counts by time window.
 * Returns: { "2": n, "24": n, "168": n, "720": n, "2160": n, "all": n }
 */
export function useRecentNodeCountsSuspense(protocol?: 'meshtastic' | 'meshcore') {
  const api = useMeshflowApi();
  const query = useSuspenseQuery<RecentNodeCounts, Error>(recentNodeCountsQuery(api, protocol));
  return query.data;
}

/**
 * Suspense-enabled counts for both protocols, fetched in parallel (one round trip, not two).
 * Uses the same query keys as {@link useRecentNodeCountsSuspense}, so the cache is shared.
 */
export function useRecentNodeCountsBothSuspense(): { meshtastic: RecentNodeCounts; meshcore: RecentNodeCounts } {
  const api = useMeshflowApi();
  const [meshtastic, meshcore] = useSuspenseQueries({
    queries: [recentNodeCountsQuery(api, 'meshtastic'), recentNodeCountsQuery(api, 'meshcore')],
  });
  return { meshtastic: meshtastic.data, meshcore: meshcore.data };
}

function recentNodeCountsQuery(api: ReturnType<typeof useMeshflowApi>, protocol?: 'meshtastic' | 'meshcore') {
  return {
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: ['nodes', 'recent-counts', protocol ?? 'all'],
    queryFn: () => api.getRecentNodeCounts(protocol),
  };
}

/** Round timestamp to 5-minute window for stable query keys across Suspense remounts */
function roundToFiveMinutes(date: Date): string {
  const fiveMinMs = 5 * 60 * 1000;
  return Math.floor(date.getTime() / fiveMinMs).toString();
}

/**
 * Suspense-enabled hook to fetch and manage observed nodes data
 * Use inside a <Suspense> boundary. No isLoading or error states are returned.
 * Note: Suspense hooks do not support the 'enabled' option.
 */
export function useNodesSuspense(options?: UseNodesOptions) {
  const api = useMeshflowApi();
  const pageSize = options?.pageSize || 500;
  const lastHeardAfterKey = options?.lastHeardAfter ? roundToFiveMinutes(options.lastHeardAfter) : null;

  const nodesQuery = useSuspenseInfiniteQuery<PaginatedResponse<ObservedNode>, Error>({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: ['nodes', pageSize, lastHeardAfterKey],
    queryFn: async ({ pageParam = 1 }) =>
      api.getNodes({
        page: pageParam as number,
        page_size: pageSize,
        last_heard_after: options?.lastHeardAfter,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
  });

  if (!nodesQuery.data) {
    return {
      nodes: [],
      totalNodes: 0,
      fetchNextPage: nodesQuery.fetchNextPage,
      hasNextPage: false,
    };
  }

  const allNodes = nodesQuery.data.pages.flatMap((page) => page.results);

  return {
    nodes: allNodes,
    totalNodes: nodesQuery.data.pages[0]?.count || 0,
    fetchNextPage: nodesQuery.fetchNextPage,
    hasNextPage: nodesQuery.hasNextPage,
  };
}

export interface UseInfrastructureNodesOptions {
  pageSize?: number;
  lastHeardAfter?: Date;
  includeClientBase?: boolean;
  protocol?: 'meshtastic' | 'meshcore';
}

export interface UseManagedNodesSuspenseOptions {
  pageSize?: number;
  includeStatus?: boolean;
  includeGeoClassification?: boolean;
}

/**
 * Suspense-enabled hook to fetch infrastructure nodes (router, repeater, etc.)
 */
export function useInfrastructureNodesSuspense(options?: UseInfrastructureNodesOptions) {
  const api = useMeshflowApi();
  const pageSize = options?.pageSize || 500;
  const lastHeardAfterKey = options?.lastHeardAfter ? roundToFiveMinutes(options.lastHeardAfter) : null;
  const protocol = options?.protocol ?? 'meshtastic';

  const nodesQuery = useSuspenseInfiniteQuery<PaginatedResponse<ObservedNode>, Error>({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: ['nodes', 'infrastructure', protocol, pageSize, lastHeardAfterKey, options?.includeClientBase ?? false],
    queryFn: async ({ pageParam = 1 }) =>
      api.getInfrastructureNodes({
        page: pageParam as number,
        pageSize,
        lastHeardAfter: options?.lastHeardAfter,
        includeClientBase: options?.includeClientBase,
        protocol,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
  });

  if (!nodesQuery.data) {
    return {
      nodes: [],
      totalNodes: 0,
      fetchNextPage: nodesQuery.fetchNextPage,
      hasNextPage: false,
    };
  }

  const allNodes = nodesQuery.data.pages.flatMap((page) => page.results);

  return {
    nodes: allNodes,
    totalNodes: nodesQuery.data.pages[0]?.count || 0,
    fetchNextPage: nodesQuery.fetchNextPage,
    hasNextPage: nodesQuery.hasNextPage,
  };
}

/** API page size when walking every page of infrastructure results. */
const INFRASTRUCTURE_FULL_FETCH_PAGE_SIZE = 1000;

/**
 * Fetches every infrastructure node for the given filters (all pages), for maps and summary tables.
 * Use {@link useInfrastructureNodesSuspense} with a small page size for the card grid and "Load more".
 */
export function useAllInfrastructureNodesSuspense(options?: UseInfrastructureNodesOptions) {
  const api = useMeshflowApi();
  const lastHeardAfterKey = options?.lastHeardAfter ? roundToFiveMinutes(options.lastHeardAfter) : null;
  const includeClientBase = options?.includeClientBase ?? false;
  const protocol = options?.protocol ?? 'meshtastic';

  const query = useSuspenseQuery({
    queryKey: ['nodes', 'infrastructure', 'all-pages', protocol, lastHeardAfterKey, includeClientBase],
    queryFn: async () => {
      const all: ObservedNode[] = [];
      let page = 1;
      while (true) {
        const res = await api.getInfrastructureNodes({
          page,
          pageSize: INFRASTRUCTURE_FULL_FETCH_PAGE_SIZE,
          lastHeardAfter: options?.lastHeardAfter,
          includeClientBase: options?.includeClientBase,
          protocol,
        });
        all.push(...res.results);
        if (!res.next || res.results.length === 0) {
          return { nodes: all, totalNodes: res.count };
        }
        page += 1;
      }
    },
    refetchInterval: 1000 * 60,
  });

  return { nodes: query.data.nodes, totalNodes: query.data.totalNodes };
}

export interface UseWeatherNodesOptions {
  pageSize?: number;
  environmentReportedAfter?: Date;
  weatherUse?: string[];
  environmentExposure?: string[];
}

/**
 * Suspense-enabled hook to fetch weather nodes (nodes with environment metrics within cutoff).
 */
export function useWeatherNodesSuspense(options?: UseWeatherNodesOptions) {
  const api = useMeshflowApi();
  const pageSize = options?.pageSize || 100;
  const environmentReportedAfterKey = options?.environmentReportedAfter
    ? roundToFiveMinutes(options.environmentReportedAfter)
    : null;
  const weatherUseKey = [...(options?.weatherUse ?? [])].sort().join(',') || 'all';
  const environmentExposureKey = [...(options?.environmentExposure ?? [])].sort().join(',') || 'all';

  const nodesQuery = useSuspenseInfiniteQuery<PaginatedResponse<ObservedNode>, Error>({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: ['nodes', 'weather', pageSize, environmentReportedAfterKey, weatherUseKey, environmentExposureKey],
    queryFn: async ({ pageParam = 1 }) =>
      api.getWeatherNodes({
        page: pageParam as number,
        pageSize,
        environmentReportedAfter: options?.environmentReportedAfter,
        weatherUse: options?.weatherUse,
        environmentExposure: options?.environmentExposure,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
  });

  if (!nodesQuery.data) {
    return {
      nodes: [],
      totalNodes: 0,
      fetchNextPage: nodesQuery.fetchNextPage,
      hasNextPage: false,
    };
  }

  const allNodes = nodesQuery.data.pages.flatMap((page) => page.results);

  return {
    nodes: allNodes,
    totalNodes: nodesQuery.data.pages[0]?.count || 0,
    fetchNextPage: nodesQuery.fetchNextPage,
    hasNextPage: nodesQuery.hasNextPage,
  };
}

/**
 * Suspense-enabled hook to fetch managed nodes with pagination
 */
export function useManagedNodesSuspense(options?: UseManagedNodesSuspenseOptions) {
  const api = useMeshflowApi();
  const pageSize = options?.pageSize ?? 500;
  const includeStatus = options?.includeStatus ?? false;
  const includeGeoClassification = options?.includeGeoClassification ?? false;
  const includeKey =
    [includeStatus ? 'status' : '', includeGeoClassification ? 'geo' : ''].filter(Boolean).join('+') || 'base';
  const managedNodesQuery = useSuspenseInfiniteQuery<PaginatedResponse<ManagedNode>, Error>({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: ['managed-nodes', pageSize, includeKey],
    queryFn: async ({ pageParam = 1 }) =>
      api.getManagedNodes({
        page: pageParam as number,
        page_size: pageSize,
        includeStatus,
        includeGeoClassification,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
  });
  if (!managedNodesQuery.data) {
    return {
      managedNodes: [],
      totalManagedNodes: 0,
      fetchNextPage: managedNodesQuery.fetchNextPage,
      hasNextPage: false,
    };
  }
  const allManagedNodes = managedNodesQuery.data.pages.flatMap((page) => page.results);
  return {
    managedNodes: allManagedNodes,
    totalManagedNodes: managedNodesQuery.data.pages[0]?.count || 0,
    fetchNextPage: managedNodesQuery.fetchNextPage,
    hasNextPage: managedNodesQuery.hasNextPage,
  };
}

/**
 * Hook to fetch user's managed nodes with pagination
 */
export function useMyManagedNodes(pageSize = 500) {
  const api = useMeshflowApi();
  const myManagedNodesQuery = useInfiniteQuery<PaginatedResponse<OwnedManagedNode>, Error>({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: ['managed-nodes', 'mine', pageSize],
    queryFn: async ({ pageParam = 1 }) => api.getMyManagedNodes({ page: pageParam as number, page_size: pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
  });

  const allMyManagedNodes = myManagedNodesQuery.data?.pages.flatMap((page) => page.results) || [];
  const totalMyManagedNodes = myManagedNodesQuery.data?.pages[0]?.count || 0;

  return {
    myManagedNodes: allMyManagedNodes,
    totalMyManagedNodes,
    fetchNextPage: myManagedNodesQuery.fetchNextPage,
    hasNextPage: myManagedNodesQuery.hasNextPage,
    isLoading: myManagedNodesQuery.isLoading,
    error: myManagedNodesQuery.error,
  };
}

/**
 * Suspense-enabled hook to fetch user's managed nodes with pagination
 */
export function useMyManagedNodesSuspense(pageSize = 500) {
  const api = useMeshflowApi();
  const myManagedNodesQuery = useSuspenseInfiniteQuery<PaginatedResponse<OwnedManagedNode>, Error>({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: ['managed-nodes', 'mine', pageSize],
    queryFn: async ({ pageParam = 1 }) => api.getMyManagedNodes({ page: pageParam as number, page_size: pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
  });
  if (!myManagedNodesQuery.data) {
    return {
      myManagedNodes: [],
      totalMyManagedNodes: 0,
      fetchNextPage: myManagedNodesQuery.fetchNextPage,
      hasNextPage: false,
    };
  }
  const allMyManagedNodes = myManagedNodesQuery.data.pages.flatMap((page) => page.results);
  return {
    myManagedNodes: allMyManagedNodes,
    totalMyManagedNodes: myManagedNodesQuery.data.pages[0]?.count || 0,
    fetchNextPage: myManagedNodesQuery.fetchNextPage,
    hasNextPage: myManagedNodesQuery.hasNextPage,
  };
}

/**
 * Suspense-enabled hook to fetch user's claimed nodes with pagination
 */
export function useMyClaimedNodesSuspense(pageSize = 500) {
  const api = useMeshflowApi();
  const myClaimedNodesQuery = useSuspenseInfiniteQuery<PaginatedResponse<ObservedNode>, Error>({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: ['observed-nodes', 'mine', pageSize],
    queryFn: async ({ pageParam = 1 }) => api.getMyClaimedNodes({ page: pageParam as number, page_size: pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
  });
  if (!myClaimedNodesQuery.data) {
    return {
      myClaimedNodes: [],
      totalMyClaimedNodes: 0,
      fetchNextPage: myClaimedNodesQuery.fetchNextPage,
      hasNextPage: false,
    };
  }
  const allMyClaimedNodes = myClaimedNodesQuery.data.pages.flatMap((page) => page.results);
  return {
    myClaimedNodes: allMyClaimedNodes,
    totalMyClaimedNodes: myClaimedNodesQuery.data.pages[0]?.count || 0,
    fetchNextPage: myClaimedNodesQuery.fetchNextPage,
    hasNextPage: myClaimedNodesQuery.hasNextPage,
  };
}

/**
 * Suspense-enabled hook to fetch device metrics for a node
 * Use inside a <Suspense> boundary. No isLoading or error states are returned.
 */
export function useNodeMetricsSuspense(internalId: string, params?: DateRangeParams) {
  const api = useMeshflowApi();
  params = roundDateParams(params);
  const keyValue = getKeyValue(params);
  const key = ['nodes', internalId, 'metrics', keyValue];

  const query = useSuspenseQuery<DeviceMetrics[], Error>({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: key,
    queryFn: () => api.getNodeDeviceMetrics(internalId, params),
  });
  return { metrics: query.data };
}

/**
 * Suspense-enabled hook to fetch environment metrics for a node
 * Use inside a <Suspense> boundary. No isLoading or error states are returned.
 */
export function useNodeEnvironmentMetricsSuspense(internalId: string, params?: DateRangeParams) {
  const api = useMeshflowApi();
  params = roundDateParams(params);
  const keyValue = getKeyValue(params);
  const key = ['nodes', internalId, 'environment-metrics', keyValue];

  const query = useSuspenseQuery<EnvironmentMetrics[], Error>({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: key,
    queryFn: () => api.getNodeEnvironmentMetrics(internalId, params),
  });
  return { metrics: query.data };
}

/**
 * Suspense-enabled hook to fetch power metrics for a node
 * Use inside a <Suspense> boundary. No isLoading or error states are returned.
 */
export function useNodePowerMetricsSuspense(internalId: string, params?: DateRangeParams) {
  const api = useMeshflowApi();
  params = roundDateParams(params);
  const keyValue = getKeyValue(params);
  const key = ['nodes', internalId, 'power-metrics', keyValue];

  const query = useSuspenseQuery<PowerMetrics[], Error>({
    refetchInterval: 1000 * 60, // 1 minute
    queryKey: key,
    queryFn: () => api.getNodePowerMetrics(internalId, params),
  });
  return { metrics: query.data };
}

/**
 * Suspense-enabled hook to fetch a single node by ID
 * Use inside a <Suspense> boundary. No isLoading or error states are returned.
 */
export function useNodeSuspense(internalId: string) {
  const api = useMeshflowApi();
  const query = useSuspenseQuery<ObservedNode, Error>({
    queryKey: ['nodes', internalId],
    queryFn: () => api.getObservedNode(internalId),
  });
  return query.data;
}
