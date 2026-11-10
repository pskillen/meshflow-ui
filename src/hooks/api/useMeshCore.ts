import { useSuspenseQuery } from '@tanstack/react-query';
import { useMeshtasticApi } from './useApi';

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
