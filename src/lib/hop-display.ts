import type { PacketObservation } from '@/lib/models';

export interface HopDescription {
  label: string;
  explanation: string;
}

type HopFields = Pick<
  PacketObservation,
  'direct_from_sender' | 'hop_count' | 'replayed' | 'via_mqtt' | 'transport_mechanism'
>;

/** Transports that are not the feeder's radio; matches NON_RF_TRANSPORTS in meshflow-api packets/hops.py. */
const NON_RF_TRANSPORTS = new Set([
  'TRANSPORT_MQTT',
  'TRANSPORT_MULTICAST_UDP',
  'TRANSPORT_UNICAST_UDP',
  'TRANSPORT_API',
]);

/** Label and plain-words explanation for how far a Meshtastic observation travelled. */
export function describeHops(obs: HopFields): HopDescription {
  if (obs.direct_from_sender) {
    return { label: 'Direct', explanation: 'Heard straight from the sender, with no relay in between.' };
  }
  if (obs.replayed) {
    return {
      label: 'Replayed by the feeder',
      explanation: 'The feeder passed this packet on when it connected. It was not heard over the air just now.',
    };
  }
  if (typeof obs.hop_count === 'number') {
    return { label: `Hops: ${obs.hop_count}`, explanation: 'How many relays the packet passed through.' };
  }
  if (obs.via_mqtt === true || (obs.transport_mechanism != null && NON_RF_TRANSPORTS.has(obs.transport_mechanism))) {
    return {
      label: 'Via internet',
      explanation: 'Reached this feeder over MQTT or the network, not by radio, so there is no hop count.',
    };
  }
  return {
    label: 'Hops unknown',
    explanation:
      'This packet did not say how far it travelled. Newer Meshtastic firmware leaves this out on some packets.',
  };
}
