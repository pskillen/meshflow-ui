import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import React from 'react';
import { useMeshtasticApi } from './useApi';
import { ObservedNode, PaginatedResponse } from '@/lib/models';

export interface UseMeshCoreNodesOptions {
  pageSize?: number;
  lastHeardAfter?: Date;
}

export function useMeshCoreNodesSuspense(options?: UseMeshCoreNodesOptions) {
  const api = useMeshtasticApi();
  const pageSize = options?.pageSize ?? 500;
  const lastHeardAfterKey = options?.lastHeardAfter
    ? Math.floor(options.lastHeardAfter.getTime() / (5 * 60 * 1000)).toString()
    : null;

  const query = useSuspenseInfiniteQuery({
    queryKey: ['meshcore-nodes', pageSize, lastHeardAfterKey],
    queryFn: async ({ pageParam = 1 }) =>
      api.getMeshCoreNodes({
        page: pageParam,
        page_size: pageSize,
        last_heard_after: options?.lastHeardAfter,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
  });

  React.useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage]);

  const nodes = React.useMemo(
    () => query.data.pages.flatMap((p: PaginatedResponse<ObservedNode>) => p.results),
    [query.data.pages]
  );

  return { nodes, ...query };
}

export function useMeshCoreManagedNodesSuspense(options?: { pageSize?: number }) {
  const api = useMeshtasticApi();
  const pageSize = options?.pageSize ?? 200;

  const query = useSuspenseQuery({
    queryKey: ['meshcore-managed-nodes', pageSize],
    queryFn: () => api.getMeshCoreManagedNodes({ page_size: pageSize, includeStatus: true }),
  });

  const feeders = query.data.results;

  return { feeders, ...query };
}
