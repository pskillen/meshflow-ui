import type { MeshProtocol, ObservedNode } from '@/lib/models';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROTOCOL_MESHTASTIC: MeshProtocol = 1;
const PROTOCOL_MESHCORE: MeshProtocol = 2;

export function isObservedNodeInternalId(id: string): boolean {
  return UUID_RE.test(id);
}

export type NodeDetailLinkInput = {
  internal_id?: string | number | null;
  meshtastic_node_id?: number | null;
  node_id_str?: string | null;
  protocol?: MeshProtocol | number | null;
};

function encodeNodeSegment(segment: string): string {
  return `/nodes/${encodeURIComponent(segment)}`;
}

function meshtasticPathFromNodeIdStr(nodeIdStr: string): string {
  const trimmed = nodeIdStr.trim();
  if (trimmed.startsWith('!') || trimmed.toLowerCase().startsWith('mt:')) {
    return encodeNodeSegment(trimmed);
  }
  const hex = trimmed.replace(/^!/, '').toLowerCase();
  if (/^[0-9a-f]{8}$/.test(hex)) {
    return encodeNodeSegment(`!${hex}`);
  }
  return encodeNodeSegment(trimmed);
}

function meshcorePathFromNodeIdStr(nodeIdStr: string): string {
  const trimmed = nodeIdStr.trim();
  if (trimmed.toLowerCase().startsWith('mc:')) {
    return encodeNodeSegment(trimmed);
  }
  const hex = trimmed.replace(/^mc:/i, '').toLowerCase();
  if (hex && /^[0-9a-f]+$/.test(hex)) {
    return encodeNodeSegment(`mc:${hex}`);
  }
  return encodeNodeSegment(trimmed);
}

function barePathFromNodeIdStr(nodeIdStr: string): string {
  const trimmed = nodeIdStr.trim();
  if (trimmed.startsWith('!')) {
    return encodeNodeSegment(trimmed);
  }
  if (trimmed.toLowerCase().startsWith('mc:')) {
    return encodeNodeSegment(trimmed);
  }
  if (trimmed.toLowerCase().startsWith('mt:')) {
    return encodeNodeSegment(trimmed);
  }
  const hex = trimmed.toLowerCase().replace(/^0x/, '');
  if (hex && /^[0-9a-f]+$/.test(hex)) {
    return encodeNodeSegment(hex);
  }
  return encodeNodeSegment(trimmed);
}

/**
 * React Router path for observed node detail (`/nodes/:id`).
 * Prefers protocol-specific `node_id_str` (!… / mc:…); bare hex when protocol unknown.
 */
export function nodeDetailPath(input: NodeDetailLinkInput): string | null {
  const nodeIdStr = input.node_id_str?.trim();
  const protocol = input.protocol;

  if (protocol === PROTOCOL_MESHCORE) {
    if (nodeIdStr) {
      return meshcorePathFromNodeIdStr(nodeIdStr);
    }
    return null;
  }

  if (protocol === PROTOCOL_MESHTASTIC) {
    if (nodeIdStr) {
      return meshtasticPathFromNodeIdStr(nodeIdStr);
    }
    const numericId = input.meshtastic_node_id;
    if (numericId != null && numericId > 0) {
      return encodeNodeSegment(`!${numericId.toString(16).padStart(8, '0')}`);
    }
    return null;
  }

  if (nodeIdStr) {
    return barePathFromNodeIdStr(nodeIdStr);
  }

  const numericId = input.meshtastic_node_id;
  if (numericId != null && numericId > 0) {
    return encodeNodeSegment(`!${numericId.toString(16).padStart(8, '0')}`);
  }

  const rawInternalId = input.internal_id;
  const internalId = rawInternalId == null || rawInternalId === '' ? '' : String(rawInternalId).trim();
  if (internalId && isObservedNodeInternalId(internalId)) {
    return encodeNodeSegment(internalId);
  }

  return null;
}

export function observedNodeDetailPath(
  node: Pick<ObservedNode, 'node_id_str' | 'protocol' | 'meshtastic_node_id' | 'internal_id'>
): string | null {
  return nodeDetailPath({
    node_id_str: node.node_id_str,
    protocol: node.protocol,
    meshtastic_node_id: node.meshtastic_node_id,
    internal_id: node.internal_id,
  });
}

/** Path segment for API lookup from a 300-choice row. */
export function nodeDetailPathFromLookupChoice(choice: {
  node_id_str: string;
  protocol: MeshProtocol | number;
}): string | null {
  return nodeDetailPath({
    node_id_str: choice.node_id_str,
    protocol: choice.protocol as MeshProtocol,
  });
}
