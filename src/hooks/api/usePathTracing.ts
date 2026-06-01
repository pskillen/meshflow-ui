import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeshCorePathSegmentAnnotateBody } from '@/lib/models';
import type { PathTracingQueryParams } from '@/lib/types';
import { useMeshflowApi } from './useApi';

export function pathTracingEdgesKey(params?: PathTracingQueryParams) {
  return ['pathTracing', 'edges', params] as const;
}

export function pathTracingSegmentsKey(params?: PathTracingQueryParams) {
  return ['pathTracing', 'segments', params] as const;
}

export function usePathTracingEdges(params?: PathTracingQueryParams) {
  const api = useMeshflowApi();
  return useQuery({
    queryKey: pathTracingEdgesKey(params),
    queryFn: () => api.getPathTracingEdges(params),
  });
}

export function usePathTracingSegments(params?: PathTracingQueryParams) {
  const api = useMeshflowApi();
  return useQuery({
    queryKey: pathTracingSegmentsKey(params),
    queryFn: () => api.getPathTracingSegments(params),
  });
}

export function useAnnotatePathSegment() {
  const api = useMeshflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ segmentId, body }: { segmentId: string; body: MeshCorePathSegmentAnnotateBody }) =>
      api.annotatePathSegment(segmentId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pathTracing'] });
    },
  });
}
