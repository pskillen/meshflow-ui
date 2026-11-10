import { useQuery } from '@tanstack/react-query';

import { useMeshtasticApi } from './useApi';
import type { ObservedNode, PaginatedResponse } from '@/lib/models';

/** The API's maximum page size; the heard layer fetches this one page and no more. */
export const OBSERVED_NODES_HEARD_PAGE_SIZE = 1000;

export interface UseObservedNodesHeardOptions {
  lastHeardAfter: Date;
  /** When false, no fetch (e.g. layer toggled off). */
  enabled?: boolean;
}

const NO_NODES: ObservedNode[] = [];

/**
 * One page (up to 1000) of observed nodes with `last_heard` in range (same clock as coverage window).
 * Never walks further pages: when `total` exceeds the returned nodes, `truncated` is true.
 */
export function useObservedNodesHeard(options: UseObservedNodesHeardOptions) {
  const api = useMeshtasticApi();
  const enabled = options.enabled !== false;
  const lastHeardKey = Math.floor(options.lastHeardAfter.getTime() / (5 * 60 * 1000)).toString();

  const query = useQuery<PaginatedResponse<ObservedNode>, Error>({
    queryKey: ['observed-nodes-heard', OBSERVED_NODES_HEARD_PAGE_SIZE, lastHeardKey],
    queryFn: () =>
      api.getNodes({
        page: 1,
        page_size: OBSERVED_NODES_HEARD_PAGE_SIZE,
        last_heard_after: options.lastHeardAfter,
      }),
    enabled,
  });

  const nodes = query.data?.results ?? NO_NODES;
  const total = query.data?.count ?? 0;

  return {
    nodes,
    total,
    truncated: total > nodes.length,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
}
