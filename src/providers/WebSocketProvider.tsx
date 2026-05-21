import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useConfig } from './ConfigProvider';
import { useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { websocketService, WebSocketEventType, ConnectionState } from '@/lib/websocket/websocketService';
import { TextMessage } from '@/lib/models';
import { eventService } from '@/lib/events/eventService';
import { messageProtocol, isOnMessagesPage, type MessageProtocolSlug } from '@/lib/message-protocol';

interface WebSocketContextType {
  isConnected: boolean;
  connectionState: ConnectionState;
  unreadMessages: TextMessage[];
  markAllAsRead: () => void;
  markAsReadForProtocol: (protocol: MessageProtocolSlug) => void;
  hasUnreadMessages: boolean;
  unreadCountForProtocol: (protocol: MessageProtocolSlug) => number;
  hasUnreadForProtocol: (protocol: MessageProtocolSlug) => boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  connectionState: ConnectionState.DISCONNECTED,
  unreadMessages: [],
  markAllAsRead: () => {},
  markAsReadForProtocol: () => {},
  hasUnreadMessages: false,
  unreadCountForProtocol: () => 0,
  hasUnreadForProtocol: () => false,
});

export function useWebSocket() {
  return useContext(WebSocketContext);
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const config = useConfig();
  const location = useLocation();
  const { toast } = useToast();

  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [unreadMessages, setUnreadMessages] = useState<TextMessage[]>([]);

  const markAsReadForProtocol = useCallback((protocol: MessageProtocolSlug) => {
    setUnreadMessages((prev) => prev.filter((m) => messageProtocol(m) !== protocol));
  }, []);

  const markAllAsRead = useCallback(() => {
    setUnreadMessages([]);
  }, []);

  const unreadCountForProtocol = useCallback(
    (protocol: MessageProtocolSlug) => unreadMessages.filter((m) => messageProtocol(m) === protocol).length,
    [unreadMessages]
  );

  const hasUnreadForProtocol = useCallback(
    (protocol: MessageProtocolSlug) => unreadMessages.some((m) => messageProtocol(m) === protocol),
    [unreadMessages]
  );

  useEffect(() => {
    websocketService.initialize(config.apis.meshBot.baseUrl);
    websocketService.connect();

    const connectedHandler = () => {
      setConnectionState(ConnectionState.CONNECTED);
    };

    const disconnectedHandler = () => {
      setConnectionState(ConnectionState.DISCONNECTED);
    };

    const errorHandler = () => {
      setConnectionState(ConnectionState.ERROR);
    };

    const messageHandler = (message: TextMessage) => {
      const proto = messageProtocol(message);
      if (isOnMessagesPage(location.pathname, proto)) {
        return;
      }

      setUnreadMessages((prev) => [...prev, message]);

      const senderLabel =
        message.sender?.long_name || message.sender?.short_name || message.sender?.node_id_str || 'Unknown';
      toast({
        title: `New message from ${senderLabel}`,
        description: message.message_text,
        duration: 5000,
      });
    };

    eventService.subscribe(WebSocketEventType.CONNECTED, connectedHandler);
    eventService.subscribe(WebSocketEventType.DISCONNECTED, disconnectedHandler);
    eventService.subscribe(WebSocketEventType.ERROR, errorHandler);
    eventService.subscribe(WebSocketEventType.MESSAGE_RECEIVED, messageHandler);

    return () => {
      eventService.unsubscribe(WebSocketEventType.CONNECTED, connectedHandler);
      eventService.unsubscribe(WebSocketEventType.DISCONNECTED, disconnectedHandler);
      eventService.unsubscribe(WebSocketEventType.ERROR, errorHandler);
      eventService.unsubscribe(WebSocketEventType.MESSAGE_RECEIVED, messageHandler);
      websocketService.disconnect();
    };
  }, [config.apis.meshBot.baseUrl, toast, location.pathname]);

  useEffect(() => {
    if (isOnMessagesPage(location.pathname, 'meshtastic')) {
      markAsReadForProtocol('meshtastic');
    }
    if (isOnMessagesPage(location.pathname, 'meshcore')) {
      markAsReadForProtocol('meshcore');
    }
  }, [location.pathname, markAsReadForProtocol]);

  const contextValue = useMemo<WebSocketContextType>(
    () => ({
      isConnected: connectionState === ConnectionState.CONNECTED,
      connectionState,
      unreadMessages,
      markAllAsRead,
      markAsReadForProtocol,
      hasUnreadMessages: unreadMessages.length > 0,
      unreadCountForProtocol,
      hasUnreadForProtocol,
    }),
    [
      connectionState,
      unreadMessages,
      markAllAsRead,
      markAsReadForProtocol,
      unreadCountForProtocol,
      hasUnreadForProtocol,
    ]
  );

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
}
