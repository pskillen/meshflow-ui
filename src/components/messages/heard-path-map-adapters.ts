import type { MapPosition, MeshCoreHeardObservation, PacketObservation, ResolvedHop, TextMessage } from '@/lib/models';
import type { TracerouteRouteNode } from '@/lib/models';
import type { HeardPathLeg } from './HeardPathMap';

const UNKNOWN_NODE_ID = 0xffffffff;

export function isMeshCoreHeardObservation(
  obs: PacketObservation | MeshCoreHeardObservation
): obs is MeshCoreHeardObservation {
  return 'path_hashes' in obs;
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
  const senderPos = message.sender_position;
  const sender =
    message.sender && senderPos
      ? {
          label: message.sender.short_name || message.sender.node_id_str,
          position: senderPos,
        }
      : null;

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
  const senderPos = message.sender_position;
  const sender =
    message.sender && senderPos
      ? {
          label: message.sender.short_name || message.sender.node_id_str,
          position: senderPos,
        }
      : null;

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
