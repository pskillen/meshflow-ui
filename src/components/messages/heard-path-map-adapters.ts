import type {
  MapPosition,
  McSenderCandidate,
  MeshCoreHeardObservation,
  PacketObservation,
  ResolvedHop,
  TextMessage,
} from '@/lib/models';
import type { TracerouteRouteNode } from '@/lib/models';
import { HEARD_PATH_LEG_COLORS } from './heard-path-constants';
import type { HeardPathLeg } from './HeardPathMap';

const UNKNOWN_NODE_ID = 0xffffffff;

export function isMeshCoreHeardObservation(
  obs: PacketObservation | MeshCoreHeardObservation
): obs is MeshCoreHeardObservation {
  return 'path_hashes' in obs;
}

export type MeshCoreHeardLeg = {
  observation: MeshCoreHeardObservation;
  receiverLabel: string;
  receiverPosition: MapPosition | null;
  hops: ResolvedHop[];
  pathKnown: boolean;
  lineColor: string;
};

export function resolvedHopsFromObservation(obs: MeshCoreHeardObservation): ResolvedHop[] {
  if (obs.resolved_path?.length) {
    return obs.resolved_path;
  }
  return (obs.path_hashes ?? []).map((hash) => ({
    hash,
    status: 'unknown' as const,
    node_id_str: null,
    internal_id: null,
    long_name: null,
    ambiguous: false,
  }));
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

export function mapHeardPathSender(message: TextMessage): { label: string; position: MapPosition } | null {
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

export function heardPathSenderDisplayLabel(
  message: TextMessage,
  sender: { label: string; position: MapPosition } | null
): string {
  if (sender?.label) return sender.label;
  return message.mc_sender_label?.trim() || message.sender?.short_name || message.sender?.node_id_str || 'Sender';
}

function hopToWaypoint(hop: ResolvedHop): TracerouteRouteNode | null {
  if (hop.status === 'ambiguous') {
    return null;
  }
  const label = hop.short_name || hop.long_name || hop.node_id_str || hop.hash;
  return {
    meshtastic_node_id: UNKNOWN_NODE_ID,
    node_id_str: hop.node_id_str || hop.hash,
    short_name: label,
    position: hop.position ?? null,
  };
}

export function meshCoreHeardLegs(message: TextMessage): {
  sender: { label: string; position: MapPosition } | null;
  senderDisplayLabel: string;
  legs: MeshCoreHeardLeg[];
} {
  const sender = mapHeardPathSender(message);
  const senderDisplayLabel = heardPathSenderDisplayLabel(message, sender);
  const legs: MeshCoreHeardLeg[] = [];
  let colorIndex = 0;

  for (const obs of message.heard ?? []) {
    if (!isMeshCoreHeardObservation(obs)) continue;
    legs.push({
      observation: obs,
      receiverLabel: obs.observer.short_name || obs.observer.node_id_str,
      receiverPosition: obs.observer.position,
      hops: resolvedHopsFromObservation(obs),
      pathKnown: obs.path_known ?? false,
      lineColor: HEARD_PATH_LEG_COLORS[colorIndex % HEARD_PATH_LEG_COLORS.length],
    });
    colorIndex += 1;
  }

  return { sender, senderDisplayLabel, legs };
}

export function meshtasticHeardToLegs(message: TextMessage): {
  sender: { label: string; position: MapPosition } | null;
  legs: HeardPathLeg[];
} {
  const sender = mapHeardPathSender(message);

  const legs: HeardPathLeg[] = [];
  for (const obs of message.heard ?? []) {
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

/** Geo map legs for MC: feeders with position; hop polylines when path_known and hop positions exist. */
export function meshCoreHeardToLegs(message: TextMessage): {
  sender: { label: string; position: MapPosition } | null;
  legs: HeardPathLeg[];
} {
  const { sender, legs } = meshCoreHeardLegs(message);
  const mapLegs: HeardPathLeg[] = [];
  for (const leg of legs) {
    if (!leg.receiverPosition) continue;
    const waypoints = leg.hops.map(hopToWaypoint).filter((node): node is TracerouteRouteNode => node != null);
    mapLegs.push({
      receiver: { label: leg.receiverLabel, position: leg.receiverPosition },
      waypoints,
      pathKnown: leg.pathKnown,
      lineColor: leg.lineColor,
    });
  }
  return { sender, legs: mapLegs };
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

export function messageHasAmbiguousPathHops(message: TextMessage): boolean {
  for (const obs of message.heard ?? []) {
    if (!isMeshCoreHeardObservation(obs)) continue;
    const hops = resolvedHopsFromObservation(obs);
    if (hops.some((hop) => hop.status === 'ambiguous' || (hop.candidates?.length ?? 0) > 1)) {
      return true;
    }
  }
  return false;
}

export function isMeshCoreHeardMessage(message: TextMessage): boolean {
  const proto = message.protocol?.toString().toLowerCase();
  if (proto === 'meshcore' || proto === '2') return true;
  return (message.heard ?? []).some(isMeshCoreHeardObservation);
}
