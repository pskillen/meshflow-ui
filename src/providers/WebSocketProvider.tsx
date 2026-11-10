import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConfig } from './ConfigProvider';
import { useOptionalAuth } from './AuthProvider';
import { useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { websocketService, WebSocketEventType, ConnectionState } from '@/lib/websocket/websocketService';
import { TextMessage } from '@/lib/models';
import { eventService } from '@/lib/events/eventService';
import { useMeshflowApi } from '@/hooks/api/useApi';
import {
  EMPTY_UNREAD_COUNTS,
  unreadCountsQueryKey,
  useUnreadCountsQuery,
  type UnreadCountsSnapshot,
} from '@/hooks/api/useUnreadCounts';
import {
  channelIdFromMessage,
  messageProtocolOrNull,
  isOnMessagesPage,
  type MessageProtocolSlug,
} from '@/lib/message-protocol';

export type ActiveMessagesView = {
  protocol: MessageProtocolSlug;
  channelId: number;
  /**
   * Whether showing this channel counts as reading it (default true). False for a channel that was auto-selected
   * (constellation switch) rather than chosen by the user: it is displayed but stays unread (meshflow-api#396).
   */
  markRead?: boolean;
};

/** Per-channel cap, matching the API's cap on unread counts. */
export const UNREAD_CHANNEL_CAP = 99;

const PROTOCOLS: MessageProtocolSlug[] = ['meshtastic', 'meshcore'];

interface WebSocketContextType {
  isConnected: boolean;
  connectionState: ConnectionState;
  /** Register the channel currently on screen on a messages page (null when none). */
  setActiveMessagesView: (view: ActiveMessagesView | null) => void;
  /**
   * The messages list reports the newest message it shows for a channel (null for an empty channel). When that channel
   * is the active, read-marking view, the provider advances the read cursor up to it.
   */
  reportShownMessage: (protocol: MessageProtocolSlug, channelId: number, newestMessageId: string | null) => void;
  hasUnreadMessages: boolean;
  unreadCountForProtocol: (protocol: MessageProtocolSlug) => number;
  hasUnreadForProtocol: (protocol: MessageProtocolSlug) => boolean;
  unreadCountForChannel: (protocol: MessageProtocolSlug, channelId: number) => number;
  hasUnreadForChannel: (protocol: MessageProtocolSlug, channelId: number) => boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  connectionState: ConnectionState.DISCONNECTED,
  setActiveMessagesView: () => {},
  reportShownMessage: () => {},
  hasUnreadMessages: false,
  unreadCountForProtocol: () => 0,
  hasUnreadForProtocol: () => false,
  unreadCountForChannel: () => 0,
  hasUnreadForChannel: () => false,
});

export function useWebSocket() {
  return useContext(WebSocketContext);
}

/** A WS frame counted on top of the server snapshot it arrived after. */
interface WsUnreadEntry {
  id: string;
  protocol: MessageProtocolSlug;
  channelId: number;
  fetchId: number;
}

function isActiveChannelView(
  pathname: string,
  view: ActiveMessagesView | null,
  protocol: MessageProtocolSlug,
  channelId: number
): boolean {
  return (
    view != null &&
    view.markRead !== false &&
    view.protocol === protocol &&
    view.channelId === channelId &&
    isOnMessagesPage(pathname, protocol)
  );
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const config = useConfig();
  const auth = useOptionalAuth();
  const location = useLocation();
  const api = useMeshflowApi();
  const queryClient = useQueryClient();
  const apiRef = useRef(api);
  apiRef.current = api;
  const pathnameRef = useRef(location.pathname);
  const activeMessagesViewRef = useRef<ActiveMessagesView | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [activeView, setActiveView] = useState<ActiveMessagesView | null>(null);
  const [shown, setShown] = useState<{ protocol: MessageProtocolSlug; channelId: number; id: string | null } | null>(
    null
  );
  const [wsUnread, setWsUnread] = useState<WsUnreadEntry[]>([]);

  const unreadEnabled = auth ? auth.isAuthenticated : true;
  const unreadEnabledRef = useRef(unreadEnabled);
  unreadEnabledRef.current = unreadEnabled;
  const unreadQuery = useUnreadCountsQuery(unreadEnabled);
  const snapshot: UnreadCountsSnapshot | undefined = unreadQuery.data;
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const refetchUnread = unreadQuery.refetch;
  const refetchUnreadRef = useRef(refetchUnread);
  refetchUnreadRef.current = refetchUnread;

  useEffect(() => {
    pathnameRef.current = location.pathname;
    if (!isOnMessagesPage(location.pathname, 'meshtastic') && !isOnMessagesPage(location.pathname, 'meshcore')) {
      activeMessagesViewRef.current = null;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!unreadEnabled) {
      setWsUnread([]);
    }
  }, [unreadEnabled]);

  // The view only counts while its protocol's messages page is open.
  const effectiveView = activeView && isOnMessagesPage(location.pathname, activeView.protocol) ? activeView : null;

  const setActiveMessagesView = useCallback((view: ActiveMessagesView | null) => {
    activeMessagesViewRef.current = view;
    setActiveView((prev) =>
      prev === view ||
      (prev &&
        view &&
        prev.protocol === view.protocol &&
        prev.channelId === view.channelId &&
        prev.markRead === view.markRead)
        ? prev
        : view
    );
  }, []);

  const reportShownMessage = useCallback((protocol: MessageProtocolSlug, channelId: number, id: string | null) => {
    setShown((prev) =>
      prev && prev.protocol === protocol && prev.channelId === channelId && prev.id === id
        ? prev
        : { protocol, channelId, id }
    );
  }, []);

  // Viewing a channel reads it: zero it locally and advance the server cursor to the newest message shown.
  const viewProtocol = effectiveView?.protocol;
  const viewChannelId = effectiveView?.channelId;
  const viewMarksRead = effectiveView != null && effectiveView.markRead !== false;
  useEffect(() => {
    if (!viewMarksRead || viewProtocol == null || viewChannelId == null) {
      return;
    }
    if (!shown || shown.protocol !== viewProtocol || shown.channelId !== viewChannelId) {
      return;
    }
    setWsUnread((prev) => {
      const next = prev.filter((e) => !(e.protocol === viewProtocol && e.channelId === viewChannelId));
      return next.length === prev.length ? prev : next;
    });
    queryClient.setQueryData<UnreadCountsSnapshot>(unreadCountsQueryKey, (old) => {
      const key = String(viewChannelId);
      if (!old || old.counts[viewProtocol].channels[key] == null) {
        return old;
      }
      const channels = { ...old.counts[viewProtocol].channels };
      const removed = channels[key] ?? 0;
      delete channels[key];
      return {
        ...old,
        counts: {
          ...old.counts,
          [viewProtocol]: { total: Math.max(0, old.counts[viewProtocol].total - removed), channels },
        },
      };
    });
    if (snapshotRef.current?.available === false || !unreadEnabled) {
      return;
    }
    apiRef.current.markChannelRead(viewChannelId, shown.id ?? undefined).catch(() => {
      // Best effort: the next unread-counts refetch reconciles.
    });
  }, [viewMarksRead, viewProtocol, viewChannelId, shown, queryClient, unreadEnabled]);

  const channelCounts = useMemo(() => {
    const result: Record<MessageProtocolSlug, Map<number, number>> = {
      meshtastic: new Map(),
      meshcore: new Map(),
    };
    const counts = snapshot?.counts ?? EMPTY_UNREAD_COUNTS;
    for (const protocol of PROTOCOLS) {
      for (const [channelId, n] of Object.entries(counts[protocol]?.channels ?? {})) {
        if (n > 0) {
          result[protocol].set(Number(channelId), n);
        }
      }
    }
    for (const entry of wsUnread) {
      // Frames counted on top of an older server snapshot are already in a newer one.
      if (snapshot?.available && entry.fetchId !== snapshot.fetchId) {
        continue;
      }
      const map = result[entry.protocol];
      map.set(entry.channelId, (map.get(entry.channelId) ?? 0) + 1);
    }
    for (const protocol of PROTOCOLS) {
      for (const [channelId, n] of Array.from(result[protocol])) {
        const capped = Math.min(n, UNREAD_CHANNEL_CAP);
        if (capped <= 0 || isActiveChannelView(location.pathname, effectiveView, protocol, channelId)) {
          result[protocol].delete(channelId);
        } else {
          result[protocol].set(channelId, capped);
        }
      }
    }
    return result;
  }, [snapshot, wsUnread, effectiveView, location.pathname]);

  const unreadCountForProtocol = useCallback(
    (protocol: MessageProtocolSlug) => {
      let total = 0;
      for (const n of channelCounts[protocol].values()) {
        total += n;
      }
      return total;
    },
    [channelCounts]
  );

  const hasUnreadForProtocol = useCallback(
    (protocol: MessageProtocolSlug) => channelCounts[protocol].size > 0,
    [channelCounts]
  );

  const unreadCountForChannel = useCallback(
    (protocol: MessageProtocolSlug, channelId: number) => channelCounts[protocol].get(channelId) ?? 0,
    [channelCounts]
  );

  const hasUnreadForChannel = useCallback(
    (protocol: MessageProtocolSlug, channelId: number) => (channelCounts[protocol].get(channelId) ?? 0) > 0,
    [channelCounts]
  );

  useEffect(() => {
    websocketService.initialize(config.apis.meshBot.baseUrl);
    websocketService.connect();

    const connectedHandler = () => {
      setConnectionState(ConnectionState.CONNECTED);
      // Frames may have been missed while disconnected: reconcile with the server.
      if (unreadEnabledRef.current) {
        void refetchUnreadRef.current({ cancelRefetch: false });
      }
    };

    const disconnectedHandler = () => {
      setConnectionState(ConnectionState.DISCONNECTED);
    };

    const errorHandler = () => {
      setConnectionState(ConnectionState.ERROR);
    };

    const messageHandler = (message: TextMessage) => {
      const proto = messageProtocolOrNull(message);
      if (proto == null) {
        // Unclassifiable: counts toward neither protocol.
        return;
      }
      const channelId = channelIdFromMessage(message);
      const pathname = pathnameRef.current;
      const onProtoPage = isOnMessagesPage(pathname, proto);
      const isActiveChannel = isActiveChannelView(pathname, activeMessagesViewRef.current, proto, channelId);

      if (!isActiveChannel) {
        const fetchId = snapshotRef.current?.fetchId ?? 0;
        const available = snapshotRef.current?.available === true;
        setWsUnread((prev) => {
          if (prev.some((e) => e.id === message.id)) {
            return prev;
          }
          // Drop frames already covered by a newer server snapshot.
          const kept = available ? prev.filter((e) => e.fetchId === fetchId) : prev;
          return [...kept, { id: message.id, protocol: proto, channelId, fetchId }];
        });
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

  const hasUnreadMessages = hasUnreadForProtocol('meshtastic') || hasUnreadForProtocol('meshcore');

  const contextValue = useMemo<WebSocketContextType>(
    () => ({
      isConnected: connectionState === ConnectionState.CONNECTED,
      connectionState,
      setActiveMessagesView,
      reportShownMessage,
      hasUnreadMessages,
      unreadCountForProtocol,
      hasUnreadForProtocol,
      unreadCountForChannel,
      hasUnreadForChannel,
    }),
    [
      connectionState,
      setActiveMessagesView,
      reportShownMessage,
      hasUnreadMessages,
      unreadCountForProtocol,
      hasUnreadForProtocol,
      unreadCountForChannel,
      hasUnreadForChannel,
    ]
  );

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
}
