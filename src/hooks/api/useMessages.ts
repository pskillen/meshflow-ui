import { useQuery, useInfiniteQuery, InfiniteData, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useMeshtasticApi } from './useApi';
import { TextMessage, TextMessageResponse } from '@/lib/models';
import type { ProtocolSlug } from '@/lib/mesh-protocol';

interface UseMessagesOptions {
  channelId?: number;
  constellationId?: number;
  nodeId?: number;
  protocol?: ProtocolSlug;
  pageSize?: number;
  enabled?: boolean;
}

/**
 * Hook to fetch and manage text messages
 * @param options Options for the query (channelId, constellationId, pageSize, enabled)
 * @returns Query result with messages data and loading/error states
 */
export function useMessages(options?: UseMessagesOptions) {
  const api = useMeshtasticApi();
  const pageSize = options?.pageSize || 25;

  const messagesQuery = useInfiniteQuery<
    TextMessageResponse,
    Error,
    InfiniteData<TextMessageResponse>,
    [string, ProtocolSlug | undefined, number | undefined, number | undefined, number | undefined, number],
    number
  >({
    queryKey: ['messages', options?.protocol, options?.channelId, options?.constellationId, options?.nodeId, pageSize],
    queryFn: async ({ pageParam = 1 }) => {
      return api.getTextMessages({
        channelId: options?.channelId,
        constellationId: options?.constellationId,
        nodeId: options?.nodeId,
        protocol: options?.protocol,
        page: pageParam,
        page_size: pageSize,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.next) return undefined;
      return allPages.length + 1;
    },
    enabled: options?.enabled !== false,
  });

  // Combine all pages of messages into a single array
  const allMessages = messagesQuery.data?.pages.flatMap((page) => page.results) || [];

  return {
    messages: allMessages,
    totalMessages: messagesQuery.data?.pages[0]?.count || 0,
    isLoading: messagesQuery.isLoading,
    isLoadingInitialMessages: messagesQuery.isLoading,
    isLoadingMoreMessages: messagesQuery.isFetchingNextPage,
    isLoadingAnyMessages: messagesQuery.isLoading || messagesQuery.isFetchingNextPage,
    hasPartialData: !messagesQuery.isLoading && messagesQuery.isFetchingNextPage,
    messagesError: messagesQuery.error,
    fetchNextPage: messagesQuery.fetchNextPage,
    hasNextPage: messagesQuery.hasNextPage,
  };
}

/**
 * Hook to fetch a single message by ID
 * @param id Message ID
 * @param enabled Whether the query is enabled
 * @returns Query result with message data and loading/error states
 */
export function useMessage(id: string, enabled = true) {
  const api = useMeshtasticApi();

  return useQuery<TextMessage, Error>({
    queryKey: ['messages', id],
    queryFn: () => api.getTextMessage(id),
    enabled: !!id && enabled,
  });
}

/**
 * Suspense-enabled hook to fetch and manage text messages with pagination
 * Use inside a <Suspense> boundary. No isLoading or error states are returned.
 * Note: Suspense hooks do not support the 'enabled' option.
 */
export function useMessagesSuspense(options?: UseMessagesOptions) {
  const api = useMeshtasticApi();
  const pageSize = options?.pageSize || 250;

  const messagesQuery = useSuspenseInfiniteQuery<TextMessageResponse, Error>({
    queryKey: ['messages', options?.protocol, options?.channelId, options?.constellationId, options?.nodeId, pageSize],
    queryFn: async ({ pageParam = 1 }) =>
      api.getTextMessages({
        channelId: options?.channelId,
        constellationId: options?.constellationId,
        nodeId: options?.nodeId,
        protocol: options?.protocol,
        page: pageParam as number,
        page_size: pageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
  });

  if (!messagesQuery.data) {
    return {
      messages: [],
      totalMessages: 0,
      fetchNextPage: messagesQuery.fetchNextPage,
      hasNextPage: false,
    };
  }

  const allMessages = messagesQuery.data.pages.flatMap((page) => page.results);

  return {
    messages: allMessages,
    totalMessages: messagesQuery.data.pages[0]?.count || 0,
    fetchNextPage: messagesQuery.fetchNextPage,
    hasNextPage: messagesQuery.hasNextPage,
  };
}
