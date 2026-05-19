import { useQuery, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useMeshflowApi } from './useApi';
import { NodeClaim } from '@/lib/models';
import { authService } from '@/lib/auth/authService';

/**
 * Hook to fetch claim status for a node
 * @param internalId ID of the node
 * @param enabled Whether the query is enabled
 * @returns Query result with claim status and loading/error states
 */
export function useNodeClaimStatus(internalId: string, enabled = true) {
  const api = useMeshflowApi();

  return useQuery<NodeClaim | undefined, Error>({
    queryKey: ['nodes', internalId, 'claim'],
    queryFn: () => api.getClaimStatus(internalId),
    enabled: !!internalId && enabled,
  });
}

/**
 * Hook to claim a node
 * @returns Mutation for claiming a node
 */
export function useClaimNode() {
  const api = useMeshflowApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (internalId: string) => api.claimNode(internalId),
    onSuccess: (_, internalId) => {
      // Invalidate the claim status query for the specific node
      queryClient.invalidateQueries({ queryKey: ['nodes', internalId, 'claim'] });
      // Invalidate the node detail (claim is now embedded in node response)
      queryClient.invalidateQueries({ queryKey: ['nodes', internalId] });
      // Also invalidate the user's claimed nodes list
      queryClient.invalidateQueries({ queryKey: ['observed-nodes', 'mine'] });
    },
  });
}

/**
 * Hook to create a managed node from a claimed node
 * @returns Mutation for creating a managed node
 */
export function useCreateManagedNode() {
  const api = useMeshflowApi();
  const queryClient = useQueryClient();

  const currentUser = authService.getCurrentUser();

  return useMutation({
    mutationFn: (data: {
      meshtastic_node_id: number;
      constellationId: number;
      name: string;
      options?: {
        defaultLocationLatitude?: number;
        defaultLocationLongitude?: number;
        channels?: {
          meshtastic_channel_0?: number | null;
          meshtastic_channel_1?: number | null;
          meshtastic_channel_2?: number | null;
          meshtastic_channel_3?: number | null;
          meshtastic_channel_4?: number | null;
          meshtastic_channel_5?: number | null;
          meshtastic_channel_6?: number | null;
          meshtastic_channel_7?: number | null;
        };
      };
    }) => {
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      return api.createManagedNode(
        data.meshtastic_node_id,
        data.constellationId,
        data.name,
        currentUser.id,
        data.options
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-nodes'] });
      queryClient.invalidateQueries({ queryKey: ['managed-nodes', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['observed-nodes', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['observed-nodes'] });
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

/**
 * Soft-delete a managed node (owner or staff); invalidates related queries.
 */
export function useDeleteManagedNode() {
  const api = useMeshflowApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (meshtasticNodeId: number) => api.deleteManagedNode(meshtasticNodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-nodes'] });
      queryClient.invalidateQueries({ queryKey: ['managed-nodes', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['observed-nodes'] });
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      queryClient.invalidateQueries({ queryKey: ['observed-nodes', 'mine'] });
    },
  });
}

/**
 * Suspense-enabled hook to fetch claim status for a node
 * Use inside a <Suspense> boundary. No isLoading or error states are returned.
 * Note: Suspense hooks do not support the 'enabled' option.
 */
export function useNodeClaimStatusSuspense(internalId: string) {
  const api = useMeshflowApi();
  // Note: Suspense hooks do not support 'enabled'.
  const query = useSuspenseQuery<NodeClaim | undefined, Error>({
    queryKey: ['nodes', internalId, 'claim'],
    queryFn: () => api.getClaimStatus(internalId),
  });
  return {
    claimStatus: query.data,
  };
}

/**
 * Suspense-friendly mutation for claiming a node
 * Note: Mutations do not suspend, but this is designed for Suspense trees.
 */
export function useClaimNodeSuspense() {
  // This is the same as the classic mutation, but documented for Suspense usage
  return useClaimNode();
}

/**
 * Hook to fetch all claims for the current user
 * @returns Query result with all claims and loading/error states
 */
export function useUserClaims() {
  const api = useMeshflowApi();

  return useQuery<NodeClaim[], Error>({
    queryKey: ['node-claims', 'mine'],
    queryFn: () => api.getMyClaims(),
  });
}

/**
 * Withdraw the current user's outstanding (unaccepted) claim for a node.
 */
export function useCancelNodeClaim() {
  const api = useMeshflowApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (internalId: string) => api.cancelNodeClaim(internalId),
    onSuccess: (_, internalId) => {
      queryClient.invalidateQueries({ queryKey: ['node-claims', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['nodes', internalId, 'claim'] });
      queryClient.invalidateQueries({ queryKey: ['nodes', internalId] });
      queryClient.invalidateQueries({ queryKey: ['observed-nodes', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['managed-nodes'] });
      queryClient.invalidateQueries({ queryKey: ['managed-nodes', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

/**
 * Suspense-enabled hook to fetch all claims for the current user
 * Use inside a <Suspense> boundary. No isLoading or error states are returned.
 */
export function useUserClaimsSuspense() {
  const api = useMeshflowApi();

  const query = useSuspenseQuery<NodeClaim[], Error>({
    queryKey: ['node-claims', 'mine'],
    queryFn: () => api.getMyClaims(),
  });

  return {
    claims: query.data,
  };
}
