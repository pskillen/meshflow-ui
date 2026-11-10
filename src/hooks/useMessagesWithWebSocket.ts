import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessagesSuspense } from '@/hooks/api/useMessages';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { eventService } from '@/lib/events/eventService';
import { WebSocketEventType } from '@/lib/websocket/websocketService';
import { TextMessage } from '@/lib/models';
import { channelIdFromMessage, messageProtocol } from '@/lib/message-protocol';
import type { ProtocolSlug } from '@/lib/mesh-protocol';

interface UseMessagesWithWebSocketOptions {
  channelId?: number;
  constellationId?: number;
  nodeId?: number;
  protocol?: ProtocolSlug;
  pageSize?: number;
}

function prependToMessagesQuery(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly (string | number | undefined)[],
  messages: TextMessage[]
) {
  if (messages.length === 0) {
    return;
  }
  queryClient.setQueryData(
    queryKey,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (oldData: any) => {
      if (!oldData?.pages?.length) {
        return oldData;
      }
      const existingIds = new Set<string>();
      for (const page of oldData.pages) {
        for (const row of page.results ?? []) {
          existingIds.add(row.id);
        }
      }
      const toAdd = messages.filter((m) => !existingIds.has(m.id));
      if (toAdd.length === 0) {
        return oldData;
      }
      const newData = { ...oldData };
      newData.pages = [...oldData.pages];
      newData.pages[0] = {
        ...newData.pages[0],
        results: [...toAdd, ...(newData.pages[0].results ?? [])],
        count: (newData.pages[0].count || 0) + toAdd.length,
      };
      return newData;
    }
  );
}

/**
 * Hook to fetch messages and subscribe to real-time updates via WebSocket
 */
export function useMessagesWithWebSocket(options?: UseMessagesWithWebSocketOptions) {
  const queryClient = useQueryClient();
  const { isConnected, reportShownMessage } = useWebSocket();
  const [realtimeMessages, setRealtimeMessages] = useState<TextMessage[]>([]);

  const messagesResult = useMessagesSuspense({
    channelId: options?.channelId,
    constellationId: options?.constellationId,
    protocol: options?.protocol,
    pageSize: options?.pageSize,
  });

  const queryKey = useMemo(
    () =>
      [
        'messages',
        options?.protocol,
        options?.channelId,
        options?.constellationId,
        options?.nodeId,
        options?.pageSize || 250,
      ] as const,
    [options?.protocol, options?.channelId, options?.constellationId, options?.nodeId, options?.pageSize]
  );

  const allMessages = useMemo(() => {
    const seen = new Set<string>();
    const merged: TextMessage[] = [];
    for (const m of realtimeMessages) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }
    for (const m of messagesResult.messages) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }
    return merged;
  }, [realtimeMessages, messagesResult.messages]);

  // Clear realtime rows when the list scope changes (the query itself is keyed by scope).
  useEffect(() => {
    setRealtimeMessages([]);
  }, [options?.channelId, options?.constellationId, options?.protocol]);

  // Tell the provider the newest message on screen so it can advance the channel's read cursor.
  const newestMessageId = allMessages[0]?.id ?? null;
  useEffect(() => {
    if (options?.channelId == null || !options?.protocol) {
      return;
    }
    reportShownMessage(options.protocol, options.channelId, newestMessageId);
  }, [options?.channelId, options?.protocol, newestMessageId, reportShownMessage]);

  useEffect(() => {
    const handleNewMessage = (message: TextMessage) => {
      if (options?.protocol && messageProtocol(message) !== options.protocol) {
        return;
      }

      const messageChannelId = channelIdFromMessage(message);
      const matchesChannel = options?.channelId != null ? messageChannelId === options.channelId : true;

      if (matchesChannel) {
        const isDuplicate = [...messagesResult.messages, ...realtimeMessages].some((m) => m.id === message.id);

        if (!isDuplicate) {
          setRealtimeMessages((prev) => [message, ...prev]);
          prependToMessagesQuery(queryClient, queryKey, [message]);
        }
      }
    };

    if (isConnected) {
      eventService.subscribe(WebSocketEventType.MESSAGE_RECEIVED, handleNewMessage);
    }

    return () => {
      eventService.unsubscribe(WebSocketEventType.MESSAGE_RECEIVED, handleNewMessage);
    };
  }, [
    isConnected,
    options?.channelId,
    options?.protocol,
    messagesResult.messages,
    realtimeMessages,
    queryClient,
    queryKey,
  ]);

  return {
    ...messagesResult,
    messages: allMessages,
  };
}
