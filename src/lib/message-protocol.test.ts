import { describe, it, expect } from 'vitest';
import { messageProtocol, isOnMessagesPage, messagesRouteForProtocol } from './message-protocol';
import type { TextMessage } from '@/lib/models';

function msg(protocol?: TextMessage['protocol']): TextMessage {
  return {
    id: '1',
    packet_id: 1,
    protocol,
    sender: { node_id_str: '!a', long_name: null, short_name: null },
    recipient_meshtastic_node_id: null,
    channel: 1,
    sent_at: '2025-01-01T00:00:00Z',
    message_text: 'hi',
    is_emoji: false,
    reply_to_meshtastic_packet_id: null,
    heard: [],
  };
}

describe('message-protocol', () => {
  it('normalizes protocol from API string or number', () => {
    expect(messageProtocol(msg('meshcore'))).toBe('meshcore');
    expect(messageProtocol(msg(2))).toBe('meshcore');
    expect(messageProtocol(msg('meshtastic'))).toBe('meshtastic');
    expect(messageProtocol(msg())).toBe('meshtastic');
  });

  it('maps routes and page detection', () => {
    expect(messagesRouteForProtocol('meshcore')).toBe('/meshcore/messages');
    expect(isOnMessagesPage('/messages', 'meshtastic')).toBe(true);
    expect(isOnMessagesPage('/meshcore/messages', 'meshcore')).toBe(true);
    expect(isOnMessagesPage('/meshcore/messages', 'meshtastic')).toBe(false);
  });
});
