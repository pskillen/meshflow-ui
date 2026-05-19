import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMeshflowApi } from './useApi';
import type { RfProfileUpdateBody } from '@/lib/models';

export function useRfProfile(internalId: string | null, options?: { enabled?: boolean }) {
  const api = useMeshflowApi();
  return useQuery({
    queryKey: ['rf-profile', internalId],
    queryFn: () => api.getRfProfile(internalId!),
    enabled: internalId != null && (options?.enabled ?? true),
  });
}

export function useRfPropagation(internalId: string | null, options?: { enabled?: boolean }) {
  const api = useMeshflowApi();
  return useQuery({
    queryKey: ['rf-propagation', internalId],
    queryFn: () => api.getRfPropagation(internalId!),
    enabled: internalId != null && (options?.enabled ?? true),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d || d.status === 'none') return false;
      if (d.status === 'pending' || d.status === 'running') return 5000;
      return false;
    },
  });
}

export function useUpdateRfProfile(internalId: string) {
  const api = useMeshflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RfProfileUpdateBody) => api.updateRfProfile(internalId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nodes', internalId] });
      void queryClient.invalidateQueries({ queryKey: ['rf-profile', internalId] });
    },
  });
}

export function useRecomputeRfPropagation(internalId: string) {
  const api = useMeshflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.recomputeRfPropagation(internalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rf-propagation', internalId] });
      void queryClient.invalidateQueries({ queryKey: ['nodes', internalId] });
    },
  });
}

export function useDismissRfPropagation(internalId: string) {
  const api = useMeshflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.dismissRfPropagation(internalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rf-propagation', internalId] });
      void queryClient.invalidateQueries({ queryKey: ['nodes', internalId] });
    },
  });
}
