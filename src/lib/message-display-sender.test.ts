import { describe, expect, it } from 'vitest';
import { messageSenderDisplay, messageSenderGroupingKey } from './message-display-sender';
import type { TextMessage } from '@/lib/models';

const baseMessage: TextMessage = {
  id: '1',
  packet_id: 1,
  channel: 1,
  sent_at: new Date().toISOString(),
  message_text: 'WMF: hello',
  is_emoji: false,
  reply_to_meshtastic_packet_id: null,
  recipient_meshtastic_node_id: null,
  sender: null,
  heard: [],
};

describe('messageSenderDisplay', () => {
  it('uses single MC candidate instead of Anonymous', () => {
    const display = messageSenderDisplay(
      {
        ...baseMessage,
        protocol: 'meshcore',
        mc_sender_label: 'WMF',
        mc_sender_candidates: [
          {
            internal_id: '00000000-0000-4000-8000-000000000001',
            node_id_str: 'mc:wmf',
            long_name: 'West Midlands',
            short_name: 'WMF',
            position: null,
          },
        ],
      },
      'meshcore'
    );
    expect(display.name).toBe('WMF');
    expect(display.detailPath).toBeTruthy();
    expect(display.ambiguous).toBeUndefined();
  });

  it('shows Anonymous when no MC candidates', () => {
    const display = messageSenderDisplay(
      { ...baseMessage, protocol: 'meshcore', mc_sender_label: 'WMF', mc_sender_candidates: [] },
      'meshcore'
    );
    expect(display.name).toBe('Anonymous');
    expect(display.detailPath).toBeNull();
  });

  it('marks ambiguous when multiple candidates', () => {
    const display = messageSenderDisplay(
      {
        ...baseMessage,
        protocol: 'meshcore',
        mc_sender_label: 'WMF',
        mc_sender_candidates: [
          {
            internal_id: '1',
            node_id_str: 'mc:a',
            long_name: 'WMF',
            short_name: 'A',
            position: null,
          },
          {
            internal_id: '2',
            node_id_str: 'mc:b',
            long_name: 'WMF',
            short_name: 'B',
            position: null,
          },
        ],
      },
      'meshcore'
    );
    expect(display.name).toBe('WMF');
    expect(display.ambiguous).toBe(true);
    expect(display.detailPath).toBeNull();
    expect(display.title).toContain('2 nodes');
  });
});

describe('messageSenderGroupingKey', () => {
  it('groups by candidate node_id_str when one match', () => {
    const key = messageSenderGroupingKey(
      {
        ...baseMessage,
        protocol: 'meshcore',
        mc_sender_candidates: [
          {
            internal_id: '1',
            node_id_str: 'mc:wmf',
            long_name: 'WMF',
            short_name: 'WMF',
            position: null,
          },
        ],
      },
      'meshcore'
    );
    expect(key).toBe('mc:wmf');
  });
});
