import { describe, it, expect } from 'vitest';
import { messageProtocol, isOnMessagesPage, messagesRouteForProtocol, channelIdFromMessage } from './message-protocol';
import type { TextMessage } from '@/lib/models';

function msg(overrides: Partial<TextMessage> = {}): TextMessage {
  return {
    id: '1',
    packet_id: 1,
    sender: { node_id_str: '!a', long_name: null, short_name: null },
    recipient_meshtastic_node_id: null,
    channel: 1,
    sent_at: '2025-01-01T00:00:00Z',
    message_text: 'hi',
    is_emoji: false,
    reply_to_meshtastic_packet_id: null,
    heard: [],
    ...overrides,
  };
}

describe('message-protocol', () => {
  it('normalizes protocol from API string or number', () => {
    expect(messageProtocol(msg({ protocol: 'meshcore' }))).toBe('meshcore');
    expect(messageProtocol(msg({ protocol: 2 }))).toBe('meshcore');
    expect(messageProtocol(msg({ protocol: 'meshtastic' }))).toBe('meshtastic');
    expect(messageProtocol(msg({ protocol: 1 }))).toBe('meshtastic');
  });

  it('infers meshcore without protocol field', () => {
    expect(messageProtocol(msg({ original_mc_packet_id: 'abc' }))).toBe('meshcore');
    expect(messageProtocol(msg({ mc_sender_label: 'Alice' }))).toBe('meshcore');
    expect(
      messageProtocol(
        msg({
          mc_sender_candidates: [
            {
              internal_id: '1',
              node_id_str: 'mc:x',
              long_name: 'X',
              short_name: 'X',
              position: null,
            },
          ],
        })
      )
    ).toBe('meshcore');
    expect(messageProtocol(msg())).toBe('meshtastic');
  });

  it('reads channel id from nested channel object', () => {
    expect(channelIdFromMessage(msg({ channel: { id: 42 } as unknown as number }))).toBe(42);
  });

  it('maps routes and page detection', () => {
    expect(messagesRouteForProtocol('meshcore')).toBe('/meshcore/messages');
    expect(isOnMessagesPage('/messages', 'meshtastic')).toBe(true);
    expect(isOnMessagesPage('/meshcore/messages', 'meshcore')).toBe(true);
    expect(isOnMessagesPage('/meshcore/messages', 'meshtastic')).toBe(false);
  });
});
