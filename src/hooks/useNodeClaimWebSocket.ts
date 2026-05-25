import { useEffect, useRef, useState } from 'react';
import { useConfig } from '@/providers/ConfigProvider';
import { authService } from '@/lib/auth/authService';

export type NodeClaimAcceptedEvent = {
  event: 'node_claim_accepted';
  node_internal_id: string;
  node_id_str: string;
  protocol: number;
  accepted_at: string;
};

function matchesClaimTarget(
  payload: NodeClaimAcceptedEvent,
  nodeInternalId: string,
  nodeIdStr: string | undefined
): boolean {
  if (payload.node_internal_id && nodeInternalId && payload.node_internal_id === nodeInternalId) {
    return true;
  }
  if (payload.node_id_str && nodeIdStr) {
    return payload.node_id_str.toLowerCase() === nodeIdStr.toLowerCase();
  }
  return false;
}

/**
 * Subscribe to claim acceptance for the open node (ws/claims). Used on the claim page
 * while the user sends the claim key from their radio.
 */
export function useNodeClaimWebSocket({
  nodeInternalId,
  nodeIdStr,
  enabled,
  onAccepted,
}: {
  nodeInternalId: string;
  nodeIdStr: string | undefined;
  enabled: boolean;
  onAccepted: (event: NodeClaimAcceptedEvent) => void;
}): { wsConnected: boolean } {
  const config = useConfig();
  const onAcceptedRef = useRef(onAccepted);
  onAcceptedRef.current = onAccepted;
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled || !nodeInternalId) {
      setWsConnected(false);
      return;
    }

    const token = authService.getAccessToken();
    const baseUrl = config.apis.meshBot.baseUrl;
    if (!token || !baseUrl) {
      setWsConnected(false);
      return;
    }

    const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/ws/claims/?token=${token}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => setWsConnected(true);
    socket.onclose = () => setWsConnected(false);
    socket.onerror = () => setWsConnected(false);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as NodeClaimAcceptedEvent;
        if (data.event !== 'node_claim_accepted') return;
        if (!matchesClaimTarget(data, nodeInternalId, nodeIdStr)) return;
        onAcceptedRef.current(data);
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
      setWsConnected(false);
    };
  }, [enabled, nodeInternalId, nodeIdStr, config.apis.meshBot.baseUrl]);

  return { wsConnected };
}
