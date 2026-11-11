import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMeshflowApi } from './useApi';

/** Links for one node. Under `['nodes', internalId]`, so any node invalidation reaches it. */
export const nodeIdentityLinksKey = (internalId: string) => ['nodes', internalId, 'identity-links'] as const;

/**
 * Identity links for a node. Not a suspense query and never retries: an older API (404) or any error just yields
 * no data. Pass `enabled: false` for viewers who must not make the request (guests, non-owners).
 */
export function useNodeIdentityLinks(internalId: string, enabled = true) {
  const api = useMeshflowApi();
  return useQuery({
    queryKey: nodeIdentityLinksKey(internalId),
    queryFn: () => api.getNodeIdentityLinks(internalId),
    enabled: enabled && !!internalId,
    retry: false,
  });
}

/** After any link write both nodes' pages, the lists and "my nodes" may change ("Replaced" tags, banners). */
function useInvalidateAfterLinkChange() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['nodes'] });
    queryClient.invalidateQueries({ queryKey: ['observed-nodes', 'mine'] });
    queryClient.invalidateQueries({ queryKey: ['managed-nodes'] });
  };
}

export function useConfirmNodeIdentityLink() {
  const api = useMeshflowApi();
  const invalidate = useInvalidateAfterLinkChange();
  return useMutation({
    mutationFn: (linkId: number) => api.confirmNodeIdentityLink(linkId),
    onSuccess: invalidate,
  });
}

export function useRejectNodeIdentityLink() {
  const api = useMeshflowApi();
  const invalidate = useInvalidateAfterLinkChange();
  return useMutation({
    mutationFn: (linkId: number) => api.rejectNodeIdentityLink(linkId),
    onSuccess: invalidate,
  });
}

/** Declare that `internalId` was replaced by `newNode` (a uuid or `!hex`). */
export function useDeclareNodeReplacement(internalId: string) {
  const api = useMeshflowApi();
  const invalidate = useInvalidateAfterLinkChange();
  return useMutation({
    mutationFn: (newNode: string) => api.declareNodeReplacement(internalId, newNode),
    onSuccess: invalidate,
  });
}

/** One-tap claim of the newer node (`newInternalId`) by the owner of the older one. */
export function useClaimFromPrevious(newInternalId: string) {
  const api = useMeshflowApi();
  const invalidate = useInvalidateAfterLinkChange();
  return useMutation({
    mutationFn: () => api.claimFromPrevious(newInternalId),
    onSuccess: invalidate,
  });
}
