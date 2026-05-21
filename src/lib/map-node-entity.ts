import type { MeshProtocol, ObservedNode } from '@/lib/models';
import { getMeshCoreAdvTypeColor } from '@/lib/meshcore';
import { getRoleColor } from '@/components/nodes/map-utils';

export type MapNodeEntity = {
  routeId: string;
  markerId: number;
  displayId: string;
  protocol: MeshProtocol;
  label: string;
  position?: { lat: number; lng: number };
  precisionBits?: number | null;
};

export function observedNodeToMapEntity(node: ObservedNode): MapNodeEntity {
  const lat = node.latest_position?.latitude;
  const lon = node.latest_position?.longitude;
  return {
    routeId: node.internal_id,
    markerId: node.meshtastic_node_id,
    displayId: node.node_id_str,
    protocol: node.protocol ?? 1,
    label: node.long_name || node.short_name || node.node_id_str,
    position: lat != null && lon != null ? { lat, lng: lon } : undefined,
    precisionBits: node.latest_position?.meshtastic_precision_bits,
  };
}

export function getObservedNodePinColor(node: ObservedNode): string {
  if (node.protocol === 2) {
    return getMeshCoreAdvTypeColor(node.meshcore_adv_type);
  }
  return getRoleColor(node.meshtastic_role);
}
