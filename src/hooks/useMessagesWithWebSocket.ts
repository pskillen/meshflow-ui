import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessagesSuspense } from '@/hooks/api/useMessages';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { eventService } from '@/lib/events/eventService';
import { WebSocketEventType } from '@/lib/websocket/websocketService';
import { TextMessage } from '@/lib/models';

interface UseMessagesWithWebSocketOptions {
  channelId?: number;
  constellationId?: number;
  nodeId?: number;
  pageSize?: number;
}

/**
 * Hook to fetch messages and subscribe to real-time updates via WebSocket
 * @param options Options for the query (channelId, constellationId, nodeId, pageSize)
 * @returns Query result with messages data and loading/error states
 */
export function useMessagesWithWebSocket(options?: UseMessagesWithWebSocketOptions) {
  const queryClient = useQueryClient();
  const { isConnected } = useWebSocket();
  const [realtimeMessages, setRealtimeMessages] = useState<TextMessage[]>([]);

  // Use the existing hook for fetching messages
  const messagesResult = useMessagesSuspense({
    channelId: options?.channelId,
    constellationId: options?.constellationId,
    pageSize: options?.pageSize,
  });

  // Combine fetched messages with real-time messages
  const allMessages = [...messagesResult.messages, ...realtimeMessages];

  // Listen for WebSocket message events
  useEffect(() => {
    const handleNewMessage = (message: TextMessage) => {
      // Check if the message belongs to the current channel/constellation/node
      const matchesChannel = options?.channelId ? message.channel === options.channelId : true;
      const matchesNode = options?.nodeId
        ? parseInt(message.sender.node_id_str.replace('!', ''), 16) === options.nodeId ||
          message.recipient_meshtastic_node_id === options.nodeId
        : true;

      if (matchesChannel && matchesNode) {
        // Check if the message is already in the list
        const isDuplicate = [...messagesResult.messages, ...realtimeMessages].some((m) => m.id === message.id);

        if (!isDuplicate) {
          // Add the message to the real-time messages list
          setRealtimeMessages((prev) => [message, ...prev]);

          // Update the query cache
          queryClient.setQueryData(
            ['messages', options?.channelId, options?.constellationId, options?.nodeId, options?.pageSize || 250],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (oldData: any) => {
              if (!oldData || !oldData.pages || !oldData.pages.length) return oldData;

              // Add the message to the first page of results
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

    // Register event handler
    if (isConnected) {
      eventService.subscribe(WebSocketEventType.MESSAGE_RECEIVED, handleNewMessage);
    }

    // Clean up event handler
    return () => {
      eventService.unsubscribe(WebSocketEventType.MESSAGE_RECEIVED, handleNewMessage);
    };
  }, [
    isConnected,
    options?.channelId,
    options?.constellationId,
    options?.nodeId,
    messagesResult.messages,
    realtimeMessages,
    queryClient,
  ]);

  return {
    ...messagesResult,
    messages: allMessages,
  };
}
