import { describe, expect, it } from 'vitest';
import { meshtasticHeardToLegs, meshCoreHeardToLegs } from './heard-path-map-adapters';
import type { TextMessage } from '@/lib/models';

describe('heard path adapters', () => {
  it('meshtasticHeardToLegs uses dashed path when path_known is false', () => {
    const message: TextMessage = {
      id: '1',
      packet_id: 1,
      protocol: 'meshtastic',
      sender: { node_id_str: '!1', long_name: 'S', short_name: 'S' },
      sender_position: { latitude: 55.0, longitude: -4.0 },
      recipient_meshtastic_node_id: 0xffffffff,
      channel: 1,
      sent_at: new Date().toISOString(),
      message_text: 'hi',
      is_emoji: false,
      reply_to_meshtastic_packet_id: null,
      heard: [
        {
          observer: {
            meshtastic_node_id: 2,
            node_id_str: '!2',
            long_name: 'F',
            short_name: 'F',
          },
          observer_position: { latitude: 55.1, longitude: -4.1 },
          rx_time: new Date().toISOString(),
          rx_rssi: -80,
          rx_snr: 5,
          direct_from_sender: true,
          hop_count: 0,
          path_known: false,
        },
      ],
    };
    const { sender, legs } = meshtasticHeardToLegs(message);
    expect(sender?.position.latitude).toBe(55.0);
    expect(legs).toHaveLength(1);
    expect(legs[0].pathKnown).toBe(false);
    expect(legs[0].waypoints).toHaveLength(0);
  });

  it('meshCoreHeardToLegs uses single mc_sender_candidate with position as sender', () => {
    const message: TextMessage = {
      id: '3',
      packet_id: 3,
      protocol: 'meshcore',
      sender: null,
      sender_position: { latitude: 55.0, longitude: -4.0 },
      mc_sender_label: 'WMF',
      mc_sender_candidates: [
        {
          internal_id: '00000000-0000-4000-8000-000000000099',
          node_id_str: 'mc:wmf',
          long_name: 'WMF',
          short_name: 'WMF',
          position: { latitude: 55.0, longitude: -4.0 },
        },
      ],
      recipient_meshtastic_node_id: null,
      channel: 1,
      sent_at: new Date().toISOString(),
      message_text: 'WMF: hi',
      is_emoji: false,
      reply_to_meshtastic_packet_id: null,
      heard: [],
    };
    const { sender } = meshCoreHeardToLegs(message);
    expect(sender?.label).toBe('WMF');
    expect(sender?.position.latitude).toBe(55.0);
  });

  it('meshCoreHeardToLegs omits sender when multiple positioned candidates', () => {
    const pos = { latitude: 55.0, longitude: -4.0 };
    const message: TextMessage = {
      id: '4',
      packet_id: 4,
      protocol: 'meshcore',
      sender: null,
      mc_sender_label: 'WMF',
      mc_sender_candidates: [
        {
          internal_id: '1',
          node_id_str: 'mc:a',
          long_name: 'WMF',
          short_name: 'A',
          position: pos,
        },
        {
          internal_id: '2',
          node_id_str: 'mc:b',
          long_name: 'WMF',
          short_name: 'B',
          position: pos,
        },
      ],
      recipient_meshtastic_node_id: null,
      channel: 1,
      sent_at: new Date().toISOString(),
      message_text: 'WMF: hi',
      is_emoji: false,
      reply_to_meshtastic_packet_id: null,
      heard: [
        {
          observer: {
            node_id_str: 'mc:feed',
            internal_id: null,
            long_name: 'Feeder',
            short_name: 'F',
            position: { latitude: 55.2, longitude: -4.2 },
          },
          rx_time: new Date().toISOString(),
          rx_rssi: -90,
          rx_snr: 2,
          path_hashes: ['aa'],
          path_known: false,
        },
      ],
    };
    const { sender, legs } = meshCoreHeardToLegs(message);
    expect(sender).toBeNull();
    expect(legs).toHaveLength(1);
  });

  it('meshCoreHeardToLegs maps resolved_path to waypoints without position', () => {
    const message: TextMessage = {
      id: '2',
      packet_id: 2,
      protocol: 'meshcore',
      sender: { node_id_str: 'mc:abc', long_name: 'X', short_name: 'X' },
      sender_position: { latitude: 55.0, longitude: -4.0 },
      recipient_meshtastic_node_id: null,
      channel: 1,
      sent_at: new Date().toISOString(),
      message_text: 'mc',
      is_emoji: false,
      reply_to_meshtastic_packet_id: null,
      heard: [
        {
          observer: {
            node_id_str: 'mc:feed',
            internal_id: null,
            long_name: 'Feeder',
            short_name: 'F',
            position: { latitude: 55.2, longitude: -4.2 },
          },
          rx_time: new Date().toISOString(),
          rx_rssi: -90,
          rx_snr: 2,
          path_hashes: ['aa', 'bb'],
          resolved_path: [
            {
              hash: 'aa',
              status: 'unknown',
              node_id_str: null,
              internal_id: null,
              long_name: null,
              ambiguous: false,
            },
          ],
          path_known: false,
        },
      ],
    };
    const { legs } = meshCoreHeardToLegs(message);
    expect(legs[0].waypoints[0].node_id_str).toBe('aa');
    expect(legs[0].waypoints[0].position).toBeNull();
    expect(legs[0].pathKnown).toBe(false);
  });
});
