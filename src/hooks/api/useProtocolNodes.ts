import React from 'react';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useMeshflowApi } from './useApi';
import type { ProtocolPageConfig } from '@/lib/mesh-protocol';
import type { ObservedNode, PaginatedResponse } from '@/lib/models';

export interface UseProtocolObservedNodesOptions {
  pageSize?: number;
  lastHeardAfter?: Date;
}

/**
 * Observed nodes for a protocol, one page per request. Further pages load only when the caller calls
 * `fetchNextPage` (the node list page's "Load more"); nothing walks the list automatically.
 */
export function useProtocolObservedNodesSuspense(
  config: ProtocolPageConfig,
  options?: UseProtocolObservedNodesOptions
) {
  const api = useMeshflowApi();
  const pageSize = options?.pageSize ?? 500;
  const lastHeardAfterKey = options?.lastHeardAfter
    ? Math.floor(options.lastHeardAfter.getTime() / (5 * 60 * 1000)).toString()
    : null;

  const query = useSuspenseInfiniteQuery({
    queryKey: ['observed-nodes', config.slug, pageSize, lastHeardAfterKey],
    queryFn: async ({ pageParam = 1 }) =>
      api.getObservedNodes({
        page: pageParam,
        page_size: pageSize,
        protocol: config.slug,
        last_heard_after: options?.lastHeardAfter,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
  });

  const nodes = React.useMemo(
    () => query.data.pages.flatMap((p: PaginatedResponse<ObservedNode>) => p.results),
    [query.data.pages]
  );

  const totalNodes = query.data.pages[0]?.count ?? nodes.length;

  return { nodes, totalNodes, ...query };
}
