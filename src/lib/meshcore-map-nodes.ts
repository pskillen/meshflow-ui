import type { ManagedNode, ObservedNode } from '@/lib/models';
import { managedNodeToObservedNode, mergeManagedPositionIntoObserved } from '@/lib/my-nodes-grouping';

/**
 * Observed nodes plus MC managed feeders with a map position (feeders use `node_id_str` as key).
 */
export function buildMeshCoreMapNodes(observed: ObservedNode[], managed: ManagedNode[]): ObservedNode[] {
  const byNodeIdStr = new Map<string, ObservedNode>();
  for (const o of observed) {
    byNodeIdStr.set(o.node_id_str, o);
  }
  for (const m of managed) {
    if (!managedNodeToObservedNode(m).latest_position) continue;
    const existing = byNodeIdStr.get(m.node_id_str);
    if (existing) {
      byNodeIdStr.set(m.node_id_str, mergeManagedPositionIntoObserved(existing, m));
      continue;
    }
    byNodeIdStr.set(m.node_id_str, { ...managedNodeToObservedNode(m), protocol: 2 });
  }
  return [...byNodeIdStr.values()];
}
