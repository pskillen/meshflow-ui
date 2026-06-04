import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useConfig } from './ConfigProvider';
import { useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { websocketService, WebSocketEventType, ConnectionState } from '@/lib/websocket/websocketService';
import { TextMessage } from '@/lib/models';
import { eventService } from '@/lib/events/eventService';
import { messageProtocol, isOnMessagesPage, type MessageProtocolSlug } from '@/lib/message-protocol';

export type ActiveMessagesView = {
  protocol: MessageProtocolSlug;
  channelId: number;
};

interface WebSocketContextType {
  isConnected: boolean;
  connectionState: ConnectionState;
  unreadMessages: TextMessage[];
  markAllAsRead: () => void;
  markAsReadForProtocol: (protocol: MessageProtocolSlug) => void;
  markAsReadForChannel: (protocol: MessageProtocolSlug, channelId: number) => void;
  setActiveMessagesView: (view: ActiveMessagesView | null) => void;
  hasUnreadMessages: boolean;
  unreadCountForProtocol: (protocol: MessageProtocolSlug) => number;
  hasUnreadForProtocol: (protocol: MessageProtocolSlug) => boolean;
  unreadCountForChannel: (protocol: MessageProtocolSlug, channelId: number) => number;
  hasUnreadForChannel: (protocol: MessageProtocolSlug, channelId: number) => boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  connectionState: ConnectionState.DISCONNECTED,
  unreadMessages: [],
  markAllAsRead: () => {},
  markAsReadForProtocol: () => {},
  markAsReadForChannel: () => {},
  setActiveMessagesView: () => {},
  hasUnreadMessages: false,
  unreadCountForProtocol: () => 0,
  hasUnreadForProtocol: () => false,
  unreadCountForChannel: () => 0,
  hasUnreadForChannel: () => false,
});

export function useWebSocket() {
  return useContext(WebSocketContext);
}

function messageMatchesChannel(message: TextMessage, channelId: number): boolean {
  return Number(message.channel) === channelId;
}

function isActiveChannelView(pathname: string, view: ActiveMessagesView | null, message: TextMessage): boolean {
  const proto = messageProtocol(message);
  if (!isOnMessagesPage(pathname, proto) || view == null || view.protocol !== proto) {
    return false;
  }
  return messageMatchesChannel(message, view.channelId);
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const config = useConfig();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  const activeMessagesViewRef = useRef<ActiveMessagesView | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [unreadMessages, setUnreadMessages] = useState<TextMessage[]>([]);

  useEffect(() => {
    pathnameRef.current = location.pathname;
    if (!isOnMessagesPage(location.pathname, 'meshtastic') && !isOnMessagesPage(location.pathname, 'meshcore')) {
      activeMessagesViewRef.current = null;
    }
  }, [location.pathname]);

  const setActiveMessagesView = useCallback((view: ActiveMessagesView | null) => {
    activeMessagesViewRef.current = view;
  }, []);

  const markAsReadForProtocol = useCallback((protocol: MessageProtocolSlug) => {
    setUnreadMessages((prev) => prev.filter((m) => messageProtocol(m) !== protocol));
  }, []);

  const markAsReadForChannel = useCallback((protocol: MessageProtocolSlug, channelId: number) => {
    setUnreadMessages((prev) =>
      prev.filter((m) => messageProtocol(m) !== protocol || !messageMatchesChannel(m, channelId))
    );
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

  const unreadCountForChannel = useCallback(
    (protocol: MessageProtocolSlug, channelId: number) =>
      unreadMessages.filter((m) => messageProtocol(m) === protocol && messageMatchesChannel(m, channelId)).length,
    [unreadMessages]
  );

  const hasUnreadForChannel = useCallback(
    (protocol: MessageProtocolSlug, channelId: number) =>
      unreadMessages.some((m) => messageProtocol(m) === protocol && messageMatchesChannel(m, channelId)),
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
      const pathname = pathnameRef.current;
      const onProtoPage = isOnMessagesPage(pathname, proto);
      const isActiveChannel = isActiveChannelView(pathname, activeMessagesViewRef.current, message);

      if (!isActiveChannel) {
        setUnreadMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      }

      if (!onProtoPage) {
        const senderLabel =
          message.sender?.long_name || message.sender?.short_name || message.sender?.node_id_str || 'Unknown';
        toast({
          title: `New message from ${senderLabel}`,
          description: message.message_text,
          duration: 5000,
        });
      }
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
  }, [config.apis.meshBot.baseUrl]);

  const contextValue = useMemo<WebSocketContextType>(
    () => ({
      isConnected: connectionState === ConnectionState.CONNECTED,
      connectionState,
      unreadMessages,
      markAllAsRead,
      markAsReadForProtocol,
      markAsReadForChannel,
      setActiveMessagesView,
      hasUnreadMessages: unreadMessages.length > 0,
      unreadCountForProtocol,
      hasUnreadForProtocol,
      unreadCountForChannel,
      hasUnreadForChannel,
    }),
    [
      connectionState,
      unreadMessages,
      markAllAsRead,
      markAsReadForProtocol,
      markAsReadForChannel,
      setActiveMessagesView,
      unreadCountForProtocol,
      hasUnreadForProtocol,
      unreadCountForChannel,
      hasUnreadForChannel,
    ]
  );

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
}
