import type { TextMessage } from '@/lib/models';

export type MessageProtocolSlug = 'meshtastic' | 'meshcore';

/** Channel id from API (numeric PK); tolerates legacy nested `{ id }` shapes. */
export function channelIdFromMessage(message: TextMessage): number {
  const ch = message.channel as number | { id: number };
  if (typeof ch === 'object' && ch != null && 'id' in ch) {
    return Number(ch.id);
  }
  return Number(ch);
}

/** Normalize API/WS protocol field (string or legacy numeric MeshProtocol). */
export function messageProtocol(msg: TextMessage): MessageProtocolSlug {
  const p = msg.protocol;
  if (p != null && p !== '') {
    if (p === 2 || p === '2') {
      return 'meshcore';
    }
    if (p === 1 || p === '1') {
      return 'meshtastic';
    }
    const s = String(p).toLowerCase();
    if (s === 'meshcore' || s === 'mc') {
      return 'meshcore';
    }
    if (s === 'meshtastic' || s === 'mt') {
      return 'meshtastic';
    }
  }

  // Fallbacks when older API WS payloads omit protocol (see meshflow-ui#279).
  if (msg.original_mc_packet_id) {
    return 'meshcore';
  }
  if (msg.mc_sender_label != null) {
    return 'meshcore';
  }
  if (msg.mc_sender_candidates && msg.mc_sender_candidates.length > 0) {
    return 'meshcore';
  }

  return 'meshtastic';
}

export function messagesRouteForProtocol(protocol: MessageProtocolSlug): string {
  return protocol === 'meshcore' ? '/meshcore/messages' : '/messages';
}

export function isOnMessagesPage(pathname: string, protocol: MessageProtocolSlug): boolean {
  return pathname === messagesRouteForProtocol(protocol);
}
