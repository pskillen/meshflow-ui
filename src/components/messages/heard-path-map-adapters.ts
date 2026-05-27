import type {
  MapPosition,
  McSenderCandidate,
  MeshCoreHeardObservation,
  PacketObservation,
  ResolvedHop,
  TextMessage,
} from '@/lib/models';
import type { TracerouteRouteNode } from '@/lib/models';
import type { HeardPathLeg } from './HeardPathMap';

const UNKNOWN_NODE_ID = 0xffffffff;

export function isMeshCoreHeardObservation(
  obs: PacketObservation | MeshCoreHeardObservation
): obs is MeshCoreHeardObservation {
  return 'path_hashes' in obs;
}

function senderFromMcCandidates(candidates: McSenderCandidate[] | undefined): {
  label: string;
  position: MapPosition;
} | null {
  if (!candidates?.length) return null;
  const positioned = candidates.filter((c) => c.position != null) as Array<
    McSenderCandidate & { position: MapPosition }
  >;
  if (positioned.length !== 1) return null;
  const node = positioned[0];
  return {
    label: node.short_name || node.long_name || node.node_id_str,
    position: node.position,
  };
}

function mapSender(message: TextMessage): { label: string; position: MapPosition } | null {
  if (message.sender && message.sender_position) {
    return {
      label: message.sender.short_name || message.sender.node_id_str,
      position: message.sender_position,
    };
  }
  if (message.sender_position) {
    return {
      label: message.sender?.short_name || message.mc_sender_label || message.sender?.node_id_str || 'Sender',
      position: message.sender_position,
    };
  }
  return senderFromMcCandidates(message.mc_sender_candidates);
}

function hopToWaypoint(hop: ResolvedHop): TracerouteRouteNode {
  return {
    meshtastic_node_id: UNKNOWN_NODE_ID,
    node_id_str: hop.hash,
    short_name: hop.hash,
    position: null,
  };
}

export function meshtasticHeardToLegs(message: TextMessage): {
  sender: { label: string; position: MapPosition } | null;
  legs: HeardPathLeg[];
} {
  const sender = mapSender(message);

  const legs: HeardPathLeg[] = [];
  for (const obs of message.heard) {
    if (isMeshCoreHeardObservation(obs)) continue;
    const position = obs.observer_position;
    if (!position) continue;
    legs.push({
      receiver: {
        label: obs.observer.short_name || obs.observer.node_id_str,
        position,
      },
      waypoints: [],
      pathKnown: obs.path_known ?? false,
    });
  }
  return { sender, legs };
}

export function meshCoreHeardToLegs(message: TextMessage): {
  sender: { label: string; position: MapPosition } | null;
  legs: HeardPathLeg[];
} {
  const sender = mapSender(message);

  const legs: HeardPathLeg[] = [];
  for (const obs of message.heard) {
    if (!isMeshCoreHeardObservation(obs)) continue;
    const position = obs.observer.position;
    if (!position) continue;
    const waypoints = (obs.resolved_path ?? []).map(hopToWaypoint);
    legs.push({
      receiver: {
        label: obs.observer.short_name || obs.observer.node_id_str,
        position,
      },
      waypoints,
      pathKnown: obs.path_known ?? false,
    });
  }
  return { sender, legs };
}

export function messageToHeardPathLegs(message: TextMessage): {
  sender: { label: string; position: MapPosition } | null;
  legs: HeardPathLeg[];
} {
  const proto = message.protocol?.toString().toLowerCase();
  if (proto === 'meshcore' || proto === '2') {
    return meshCoreHeardToLegs(message);
  }
  return meshtasticHeardToLegs(message);
}
