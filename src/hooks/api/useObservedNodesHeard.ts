import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';

import { useMeshtasticApi } from './useApi';
import type { ObservedNode, PaginatedResponse } from '@/lib/models';

export interface UseObservedNodesHeardOptions {
  lastHeardAfter: Date;
  pageSize?: number;
  /** When false, no fetch (e.g. layer toggled off). */
  enabled?: boolean;
}

/**
 * Paginated observed nodes with `last_heard` in range (same clock as coverage window).
 * Fetches every page of observed nodes — use sparingly (e.g. map overlays).
 */
export function useObservedNodesHeard(options: UseObservedNodesHeardOptions) {
  const api = useMeshtasticApi();
  const pageSize = options.pageSize ?? 500;
  const enabled = options.enabled !== false;
  const lastHeardKey = Math.floor(options.lastHeardAfter.getTime() / (5 * 60 * 1000)).toString();

  const query = useInfiniteQuery<
    PaginatedResponse<ObservedNode>,
    Error,
    InfiniteData<PaginatedResponse<ObservedNode>>,
    [string, number, string],
    number
  >({
    queryKey: ['observed-nodes-heard', pageSize, lastHeardKey],
    queryFn: async ({ pageParam = 1 }) =>
      api.getNodes({
        page: pageParam,
        page_size: pageSize,
        last_heard_after: options.lastHeardAfter,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.next) return undefined;
      return allPages.length + 1;
    },
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isError) {
      void query.fetchNextPage();
    }
  }, [enabled, query.hasNextPage, query.isFetchingNextPage, query.isError, query.fetchNextPage]);

  const nodes = useMemo(() => query.data?.pages.flatMap((p) => p.results) ?? [], [query.data?.pages]);

  return {
    nodes,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
}
