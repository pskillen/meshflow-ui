import { describe, expect, it } from 'vitest';
import {
  meshCoreHeardLegs,
  meshCoreHeardToLegs,
  meshtasticHeardToLegs,
  resolvedHopsFromObservation,
} from './heard-path-map-adapters';
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

  it('meshCoreHeardLegs includes feeder without observer position', () => {
    const message: TextMessage = {
      id: '5',
      packet_id: 5,
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
            position: null,
          },
          rx_time: new Date().toISOString(),
          rx_rssi: -90,
          rx_snr: 2,
          path_hashes: ['aa'],
          path_known: false,
        },
      ],
    };
    const { legs } = meshCoreHeardLegs(message);
    expect(legs).toHaveLength(1);
    expect(legs[0].receiverPosition).toBeNull();
    expect(legs[0].hops).toHaveLength(1);
    expect(legs[0].hops[0].hash).toBe('aa');
  });

  it('meshCoreHeardLegs returns distinct paths per feeder', () => {
    const message: TextMessage = {
      id: '6',
      packet_id: 6,
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
            node_id_str: 'mc:f1',
            internal_id: null,
            long_name: 'F1',
            short_name: 'F1',
            position: { latitude: 55.1, longitude: -4.1 },
          },
          rx_time: new Date().toISOString(),
          rx_rssi: -90,
          rx_snr: 2,
          path_hashes: ['aa'],
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
        {
          observer: {
            node_id_str: 'mc:f2',
            internal_id: null,
            long_name: 'F2',
            short_name: 'F2',
            position: { latitude: 55.2, longitude: -4.2 },
          },
          rx_time: new Date().toISOString(),
          rx_rssi: -88,
          rx_snr: 3,
          path_hashes: ['aa', 'cc'],
          resolved_path: [
            {
              hash: 'aa',
              status: 'unknown',
              node_id_str: null,
              internal_id: null,
              long_name: null,
              ambiguous: false,
            },
            {
              hash: 'cc',
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
    const { legs } = meshCoreHeardLegs(message);
    expect(legs).toHaveLength(2);
    expect(legs[0].hops).toHaveLength(1);
    expect(legs[1].hops).toHaveLength(2);
    expect(legs[0].lineColor).not.toBe(legs[1].lineColor);
  });

  it('meshCoreHeardToLegs draws positioned hop polylines when path_known', () => {
    const message: TextMessage = {
      id: '7',
      packet_id: 7,
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
              status: 'resolved',
              node_id_str: 'mc:hop1',
              internal_id: '1',
              long_name: 'Hop1',
              ambiguous: false,
              position: { latitude: 55.05, longitude: -4.05 },
            },
            {
              hash: 'bb',
              status: 'resolved',
              node_id_str: 'mc:hop2',
              internal_id: '2',
              long_name: 'Hop2',
              ambiguous: false,
              position: { latitude: 55.1, longitude: -4.1 },
            },
          ],
          path_known: true,
        },
      ],
    };
    const { legs } = meshCoreHeardToLegs(message);
    expect(legs[0].pathKnown).toBe(true);
    expect(legs[0].waypoints).toHaveLength(2);
    expect(legs[0].waypoints[0].position).toEqual({ latitude: 55.05, longitude: -4.05 });
    expect(legs[0].waypoints[0].short_name).toBe('Hop1');
  });

  it('meshCoreHeardToLegs omits ambiguous hops from map waypoints', () => {
    const message: TextMessage = {
      id: '8',
      packet_id: 8,
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
              status: 'resolved',
              node_id_str: 'mc:hop',
              internal_id: '1',
              long_name: 'Hop',
              short_name: 'H',
              ambiguous: false,
              position: { latitude: 55.1, longitude: -4.1 },
            },
            {
              hash: 'bb',
              status: 'ambiguous',
              node_id_str: null,
              internal_id: null,
              long_name: null,
              short_name: null,
              ambiguous: true,
              candidates: [
                {
                  internal_id: '2',
                  node_id_str: 'mc:x',
                  long_name: 'X1',
                  short_name: 'X1',
                  position: null,
                },
              ],
            },
          ],
          path_known: false,
        },
      ],
    };
    const { legs } = meshCoreHeardToLegs(message);
    expect(legs[0].waypoints).toHaveLength(1);
    expect(legs[0].waypoints[0].node_id_str).toBe('mc:hop');
  });

  it('resolvedHopsFromObservation falls back to path_hashes', () => {
    const hops = resolvedHopsFromObservation({
      observer: {
        node_id_str: 'mc:f',
        internal_id: null,
        long_name: null,
        short_name: 'F',
        position: null,
      },
      rx_time: new Date().toISOString(),
      rx_rssi: null,
      rx_snr: null,
      path_hashes: ['de', 'ad'],
      path_known: false,
    });
    expect(hops).toHaveLength(2);
    expect(hops[0].status).toBe('unknown');
    expect(hops[1].hash).toBe('ad');
  });
});
