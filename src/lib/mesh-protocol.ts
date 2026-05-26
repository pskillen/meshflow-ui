import type { ManagedNode, MeshProtocol, ObservedNode } from '@/lib/models';
import { nodeDetailPath } from '@/lib/node-detail-routes';

export type ProtocolSlug = 'meshtastic' | 'meshcore';

type ProtocolLike = MeshProtocol | ProtocolSlug | string | number | null | undefined;

/** Normalize API/UI protocol values to 1 (Meshtastic) or 2 (MeshCore). */
export function normalizeMeshProtocol(value: ProtocolLike): MeshProtocol {
  if (value === 2 || value === 'meshcore' || value === '2') return 2;
  if (value === 1 || value === 'meshtastic' || value === '1') return 1;
  return 1;
}

export function meshProtocolFromObservedNode(node: Pick<ObservedNode, 'protocol' | 'node_id_str'>): MeshProtocol {
  if (node.node_id_str?.toLowerCase().startsWith('mc:')) return 2;
  return normalizeMeshProtocol(node.protocol);
}

export function meshProtocolFromManagedNode(node: Pick<ManagedNode, 'protocol' | 'node_id_str'>): MeshProtocol {
  if (node.node_id_str?.toLowerCase().startsWith('mc:')) return 2;
  return normalizeMeshProtocol(node.protocol);
}

/** Feeders eligible to receive a claim proof for the given observed node protocol. */
export function filterManagedNodesForClaim(nodes: ManagedNode[], claimProtocol: MeshProtocol): ManagedNode[] {
  return nodes.filter((n) => meshProtocolFromManagedNode(n) === claimProtocol);
}

export type ProtocolPageConfig = {
  slug: ProtocolSlug;
  protocol: MeshProtocol;
  labels: {
    section: string;
    nodesTitle: string;
    managedNodesTitle: string;
    messagesTitle: string;
  };
  routes: {
    nodes: string;
    managedNodes: string;
    infrastructure: string;
    messages: string;
    nodeDetail: (internalId: string) => string;
  };
  features: {
    constellationsOnMap: boolean;
    roleLegend: 'meshtastic' | 'meshcore';
    autoTracerouteFilters: boolean;
    nodeCardBattery: boolean;
  };
};

export const MESHTASTIC_CONFIG: ProtocolPageConfig = {
  slug: 'meshtastic',
  protocol: 1,
  labels: {
    section: 'Meshtastic',
    nodesTitle: 'Meshtastic Nodes',
    managedNodesTitle: 'Managed Nodes',
    messagesTitle: 'Meshtastic Messages',
  },
  routes: {
    nodes: '/nodes',
    managedNodes: '/nodes/managed-nodes',
    infrastructure: '/nodes/infrastructure',
    messages: '/messages',
    nodeDetail: (id) => nodeDetailPath({ internal_id: id, protocol: 1 }) ?? `/nodes/${id}`,
  },
  features: {
    constellationsOnMap: true,
    roleLegend: 'meshtastic',
    autoTracerouteFilters: true,
    nodeCardBattery: true,
  },
};

export const MESHCORE_CONFIG: ProtocolPageConfig = {
  slug: 'meshcore',
  protocol: 2,
  labels: {
    section: 'MeshCore',
    nodesTitle: 'MeshCore Nodes',
    managedNodesTitle: 'MeshCore managed nodes',
    messagesTitle: 'MeshCore Messages',
  },
  routes: {
    nodes: '/meshcore/nodes',
    managedNodes: '/meshcore/managed-nodes',
    infrastructure: '/meshcore/infrastructure',
    messages: '/meshcore/messages',
    nodeDetail: (id) => nodeDetailPath({ internal_id: id, protocol: 2 }) ?? `/nodes/${id}`,
  },
  features: {
    constellationsOnMap: false,
    roleLegend: 'meshcore',
    autoTracerouteFilters: false,
    nodeCardBattery: false,
  },
};
