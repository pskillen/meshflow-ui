import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessagesSuspense } from '@/hooks/api/useMessages';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { eventService } from '@/lib/events/eventService';
import { WebSocketEventType } from '@/lib/websocket/websocketService';
import { TextMessage } from '@/lib/models';
import { messageProtocol } from '@/lib/message-protocol';
import type { ProtocolSlug } from '@/lib/mesh-protocol';

interface UseMessagesWithWebSocketOptions {
  channelId?: number;
  constellationId?: number;
  nodeId?: number;
  protocol?: ProtocolSlug;
  pageSize?: number;
}

/**
 * Hook to fetch messages and subscribe to real-time updates via WebSocket
 */
export function useMessagesWithWebSocket(options?: UseMessagesWithWebSocketOptions) {
  const queryClient = useQueryClient();
  const { isConnected } = useWebSocket();
  const [realtimeMessages, setRealtimeMessages] = useState<TextMessage[]>([]);

  const messagesResult = useMessagesSuspense({
    channelId: options?.channelId,
    constellationId: options?.constellationId,
    protocol: options?.protocol,
    pageSize: options?.pageSize,
  });

  const queryKey = [
    'messages',
    options?.protocol,
    options?.channelId,
    options?.constellationId,
    options?.nodeId,
    options?.pageSize || 250,
  ] as const;

  const allMessages = [...messagesResult.messages, ...realtimeMessages];

  useEffect(() => {
    const handleNewMessage = (message: TextMessage) => {
      if (options?.protocol && messageProtocol(message) !== options.protocol) {
        return;
      }

      const matchesChannel = options?.channelId ? message.channel === options.channelId : true;

      if (matchesChannel) {
        const isDuplicate = [...messagesResult.messages, ...realtimeMessages].some((m) => m.id === message.id);

        if (!isDuplicate) {
          setRealtimeMessages((prev) => [message, ...prev]);

          queryClient.setQueryData(
            queryKey,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (oldData: any) => {
              if (!oldData || !oldData.pages || !oldData.pages.length) return oldData;

              const newData = { ...oldData };
              newData.pages[0] = {
                ...newData.pages[0],
                results: [message, ...newData.pages[0].results],
                count: (newData.pages[0].count || 0) + 1,
              };

              return newData;
            }
          );
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
