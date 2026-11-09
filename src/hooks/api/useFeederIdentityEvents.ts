import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMeshflowApi } from './useApi';

export const FEEDER_IDENTITY_EVENTS_KEY = ['feeder-identity-events'] as const;

/**
 * Unacknowledged feeder number-change events. Not a suspense query and never retries, so an older API
 * (404) or any error just yields no data and no notice.
 */
export function useFeederIdentityEvents() {
  const api = useMeshflowApi();
  return useQuery({
    queryKey: FEEDER_IDENTITY_EVENTS_KEY,
    queryFn: () => api.getFeederIdentityEvents(),
    retry: false,
  });
}

function useInvalidateAfterIdentityChange() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: FEEDER_IDENTITY_EVENTS_KEY });
    queryClient.invalidateQueries({ queryKey: ['managed-nodes', 'mine'] });
  };
}

export function useAcknowledgeFeederIdentityEvent() {
  const api = useMeshflowApi();
  const invalidate = useInvalidateAfterIdentityChange();
  return useMutation({
    mutationFn: (eventId: number) => api.acknowledgeFeederIdentityEvent(eventId),
    onSuccess: invalidate,
  });
}

export function useRepointManagedNode() {
  const api = useMeshflowApi();
  const invalidate = useInvalidateAfterIdentityChange();
  return useMutation({
    mutationFn: (internalId: string) => api.repointManagedNode(internalId),
    onSuccess: invalidate,
  });
}
