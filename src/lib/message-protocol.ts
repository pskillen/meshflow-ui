import type { TextMessage } from '@/lib/models';

export type MessageProtocolSlug = 'meshtastic' | 'meshcore';

/** Normalize API/WS protocol field (string or legacy numeric MeshProtocol). */
export function messageProtocol(msg: TextMessage): MessageProtocolSlug {
  const p = msg.protocol;
  if (p === 'meshcore' || p === 2 || p === 'mc') {
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
