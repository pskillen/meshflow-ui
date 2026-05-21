import type { ObservedNode } from '@/lib/models';

/** Meshtastic-only features that must not run against MeshCore nodes (often `meshtastic_node_id` 0). */
export function supportsMeshtasticTraceroutes(node: Pick<ObservedNode, 'protocol' | 'meshtastic_node_id'>): boolean {
  return (node.protocol ?? 1) !== 2 && node.meshtastic_node_id != null && node.meshtastic_node_id > 0;
}

export function isMeshCoreObservedNode(node: Pick<ObservedNode, 'protocol'>): boolean {
  return node.protocol === 2;
}
