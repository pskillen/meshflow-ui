import type { ManagedNode, NodeApiKey, ObservedNode } from '@/lib/models';
import { meshProtocolFromManagedNode, meshProtocolFromObservedNode, normalizeMeshProtocol } from '@/lib/mesh-protocol';

const MC_PUBKEY_RE = /^[0-9a-f]{64}$/i;

/** Normalize and validate a MeshCore feeder pubkey (64 hex). */
export function normalizeMcPubkeyInput(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const trimmed = raw.trim().toLowerCase().replace(/\s/g, '');
  if (!trimmed) {
    return { ok: false, message: 'Feeder pubkey is required (64 hexadecimal characters).' };
  }
  if (!MC_PUBKEY_RE.test(trimmed)) {
    return { ok: false, message: 'Pubkey must be exactly 64 hexadecimal characters (lowercase).' };
  }
  return { ok: true, value: trimmed };
}

export function isMeshCoreEnrollment(protocol: ReturnType<typeof normalizeMeshProtocol>): boolean {
  return protocol === 2;
}

/** Whether an observed node already has a matching managed feeder row. */
export function isObservedNodeManaged(
  observed: Pick<ObservedNode, 'protocol' | 'node_id_str' | 'meshtastic_node_id' | 'mc_pubkey' | 'internal_id'>,
  managedNodes: Pick<ManagedNode, 'protocol' | 'node_id_str' | 'meshtastic_node_id' | 'mc_pubkey' | 'internal_id'>[]
): boolean {
  const observedProtocol = meshProtocolFromObservedNode(observed);
  return managedNodes.some((managed) => {
    const managedProtocol = meshProtocolFromManagedNode(managed);
    if (managedProtocol !== observedProtocol) return false;
    if (observedProtocol === 2) {
      if (observed.mc_pubkey && managed.mc_pubkey) {
        return observed.mc_pubkey.toLowerCase() === managed.mc_pubkey.toLowerCase();
      }
      if (observed.node_id_str && managed.node_id_str) {
        return observed.node_id_str.toLowerCase() === managed.node_id_str.toLowerCase();
      }
      return false;
    }
    return (
      observed.meshtastic_node_id != null &&
      observed.meshtastic_node_id > 0 &&
      managed.meshtastic_node_id === observed.meshtastic_node_id
    );
  });
}

/** API key is linked to this managed node (MeshCore uses linked_managed_nodes; MT uses legacy nodes list). */
export function apiKeyLinksManagedNode(
  key: NodeApiKey,
  node: Pick<ManagedNode, 'internal_id' | 'meshtastic_node_id' | 'protocol'>
): boolean {
  const internalId = node.internal_id;
  if (internalId && key.linked_managed_nodes?.some((l) => l.internal_id === internalId)) {
    return true;
  }
  if (node.protocol !== 2 && node.meshtastic_node_id != null && node.meshtastic_node_id > 0) {
    return key.nodes?.includes(node.meshtastic_node_id) ?? false;
  }
  return false;
}

export function managedNodeStableKey(node: Pick<ManagedNode, 'internal_id' | 'meshtastic_node_id'>): string {
  return node.internal_id ?? String(node.meshtastic_node_id);
}

/** Internal IDs currently linked to an API key (MeshCore + Meshtastic). */
export function apiKeyLinkedInternalIds(
  key: NodeApiKey,
  managedNodes: Pick<ManagedNode, 'internal_id' | 'meshtastic_node_id'>[]
): string[] {
  const ids = new Set<string>();
  for (const link of key.linked_managed_nodes ?? []) {
    if (link.internal_id) ids.add(link.internal_id);
  }
  for (const nid of key.nodes ?? []) {
    const match = managedNodes.find((m) => m.meshtastic_node_id === nid);
    if (match?.internal_id) ids.add(match.internal_id);
  }
  return [...ids];
}
