import type { ObservedNode } from '@/lib/models';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isObservedNodeInternalId(id: string): boolean {
  return UUID_RE.test(id);
}

export type NodeDetailLinkInput = {
  internal_id?: string | number | null;
  meshtastic_node_id?: number | null;
  node_id_str?: string | null;
  protocol?: number | null;
};

/**
 * React Router path for observed node detail (`/nodes/:id`).
 * Prefers stable `internal_id`, then legacy Meshtastic numeric id, then encoded `node_id_str` (MeshCore).
 */
export function nodeDetailPath(input: NodeDetailLinkInput): string {
  const rawInternalId = input.internal_id;
  const internalId = rawInternalId == null || rawInternalId === '' ? '' : String(rawInternalId).trim();
  if (internalId && isObservedNodeInternalId(internalId)) {
    return `/nodes/${internalId}`;
  }
  const numericId = input.meshtastic_node_id;
  if (numericId != null && numericId > 0) {
    return `/nodes/${numericId}`;
  }
  const nodeIdStr = input.node_id_str?.trim();
  if (nodeIdStr) {
    return `/nodes/${encodeURIComponent(nodeIdStr)}`;
  }
  return '/nodes/0';
}

export function observedNodeDetailPath(node: Pick<ObservedNode, 'internal_id'>): string {
  return nodeDetailPath({ internal_id: node.internal_id });
}
