import { useQuery } from '@tanstack/react-query';
import { useMeshflowApi } from './useApi';
import { NotFoundError } from '@/lib/types';
import type { UnreadCountsResponse, UnreadProtocolCounts } from '@/lib/models';

export const unreadCountsQueryKey = ['unread-counts'] as const;

/**
 * Server unread counts plus bookkeeping the provider needs.
 * `available` is false when the API has no unread-counts endpoint (404, API older than meshflow-api#527); the UI then
 * counts WS frames only. `fetchId` changes on every real fetch (not on local patches), so WS frames counted on top of
 * an older snapshot can be discarded once a fresh one arrives.
 */
export interface UnreadCountsSnapshot {
  available: boolean;
  counts: UnreadCountsResponse;
  fetchId: number;
}

export const EMPTY_UNREAD_COUNTS: UnreadCountsResponse = {
  meshtastic: { total: 0, channels: {} },
  meshcore: { total: 0, channels: {} },
};

function normalizeProtocolCounts(value: Partial<UnreadProtocolCounts> | undefined): UnreadProtocolCounts {
  return { total: value?.total ?? 0, channels: value?.channels ?? {} };
}

let fetchCounter = 0;

export function useUnreadCountsQuery(enabled: boolean) {
  const api = useMeshflowApi();
  return useQuery<UnreadCountsSnapshot>({
    queryKey: unreadCountsQueryKey,
    queryFn: async () => {
      const fetchId = ++fetchCounter;
      try {
        const counts = await api.getUnreadCounts();
        return {
          available: true,
          fetchId,
          counts: {
            meshtastic: normalizeProtocolCounts(counts?.meshtastic),
            meshcore: normalizeProtocolCounts(counts?.meshcore),
          },
        };
      } catch (error) {
        if (error instanceof NotFoundError) {
          return { available: false, fetchId, counts: EMPTY_UNREAD_COUNTS };
        }
        throw error;
      }
    },
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: 'always',
  });
}
