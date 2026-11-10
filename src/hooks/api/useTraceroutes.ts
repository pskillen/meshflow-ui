import { useQuery, useMutation, useQueryClient, useSuspenseQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useMeshtasticApi } from './useApi';

export interface UseTraceroutesParams {
  managed_node?: number;
  source_node?: number;
  target_node?: number;
  status?: string;
  trigger_type?: string;
  /** CSV of strategy tokens (intra_zone, dx_across, dx_same_side, legacy) */
  target_strategy?: string;
  triggered_after?: string;
  triggered_before?: string;
  page?: number;
  page_size?: number;
}

export function useTraceroutes(params?: UseTraceroutesParams) {
  const api = useMeshtasticApi();
  return useQuery({
    queryKey: ['traceroutes', params],
    queryFn: () => api.getTraceroutes(params),
  });
}

export type UseTraceroutesInfiniteParams = Omit<UseTraceroutesParams, 'page'>;

export function useTraceroutesInfinite(params?: UseTraceroutesInfiniteParams) {
  const api = useMeshtasticApi();
  return useInfiniteQuery({
    queryKey: ['traceroutes', 'infinite', params],
    queryFn: ({ pageParam = 1 }) => api.getTraceroutes({ ...params, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
  });
}

export function useTraceroute(id: number | null) {
  const api = useMeshtasticApi();
  return useQuery({
    queryKey: ['traceroutes', 'detail', id],
    queryFn: () => api.getTraceroute(id!),
    enabled: id != null,
  });
}

export function useCanTriggerTraceroute() {
  const api = useMeshtasticApi();
  return useQuery({
    queryKey: ['traceroutes', 'can-trigger'],
    queryFn: () => api.canTriggerTraceroute(),
  });
}

export function useTracerouteTriggerableNodes() {
  const api = useMeshtasticApi();
  return useQuery({
    queryKey: ['traceroutes', 'triggerable-nodes'],
    queryFn: () => api.getTracerouteTriggerableNodes(),
  });
}

export interface UseTracerouteStatsParams {
  triggeredAtAfter?: Date;
  /** Meshtastic node id of source managed node; same as traceroute list ``source_node``. */
  sourceNodeId?: number | null;
  /** `1h` asks for hourly `success_over_time` (24h only; the API rejects it beyond 7 days). */
  bucket?: '1h';
}

export function useTracerouteStats(params?: UseTracerouteStatsParams) {
  const api = useMeshtasticApi();
  const triggeredAtAfter = params?.triggeredAtAfter?.toISOString();
  const sourceNode = params?.sourceNodeId ?? undefined;
  const bucket = params?.bucket;
  return useQuery({
    queryKey: ['traceroutes', 'stats', { triggeredAtAfter, sourceNode, bucket }],
    queryFn: () =>
      api.getTracerouteStats({
        triggered_at_after: triggeredAtAfter,
        source_node: sourceNode,
        bucket,
      }),
  });
}

export function useTracerouteTriggerableNodesSuspense() {
  const api = useMeshtasticApi();
  const { data } = useSuspenseQuery({
    queryKey: ['traceroutes', 'triggerable-nodes'],
    queryFn: () => api.getTracerouteTriggerableNodes(),
  });
  return { triggerableNodes: data ?? [] };
}

export function useTriggerTraceroute() {
  const api = useMeshtasticApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      managedNodeId,
      targetNodeId,
      targetStrategy,
    }: {
      managedNodeId: number;
      targetNodeId?: number;
      targetStrategy?: 'intra_zone' | 'dx_across' | 'dx_same_side';
    }) => api.triggerTraceroute(managedNodeId, targetNodeId, targetStrategy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['traceroutes'] });
      queryClient.invalidateQueries({ queryKey: ['traceroutes', 'triggerable-nodes'] });
    },
  });
}
