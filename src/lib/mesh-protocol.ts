import type { MeshProtocol } from '@/lib/models';
import { nodeDetailPath } from '@/lib/node-detail-routes';

export type ProtocolSlug = 'meshtastic' | 'meshcore';

export type ProtocolPageConfig = {
  slug: ProtocolSlug;
  protocol: MeshProtocol;
  labels: {
    section: string;
    nodesTitle: string;
    mapTitle: string;
    managedNodesTitle: string;
    messagesTitle: string;
  };
  routes: {
    map?: string;
    nodes: string;
    managedNodes: string;
    messages: string;
    nodeDetail: (internalId: string) => string;
  };
  features: {
    constellationsOnMap: boolean;
    roleLegend: 'meshtastic' | 'meshcore';
    autoTracerouteFilters: boolean;
    nodeCardBattery: boolean;
    showRecentBar: boolean;
    showInfrastructureLink: boolean;
  };
};

export const MESHTASTIC_CONFIG: ProtocolPageConfig = {
  slug: 'meshtastic',
  protocol: 1,
  labels: {
    section: 'Meshtastic',
    nodesTitle: 'Meshtastic Nodes',
    mapTitle: 'Nodes and Constellations Map',
    managedNodesTitle: 'Managed Nodes',
    messagesTitle: 'Meshtastic Messages',
  },
  routes: {
    map: '/map',
    nodes: '/nodes',
    managedNodes: '/nodes/managed-nodes',
    messages: '/messages',
    nodeDetail: (id) => nodeDetailPath({ internal_id: id, protocol: 1 }) ?? `/nodes/${id}`,
  },
  features: {
    constellationsOnMap: true,
    roleLegend: 'meshtastic',
    autoTracerouteFilters: true,
    nodeCardBattery: true,
    showRecentBar: true,
    showInfrastructureLink: true,
  },
};

export const MESHCORE_CONFIG: ProtocolPageConfig = {
  slug: 'meshcore',
  protocol: 2,
  labels: {
    section: 'MeshCore',
    nodesTitle: 'MeshCore Nodes',
    mapTitle: 'MeshCore map',
    managedNodesTitle: 'MeshCore managed nodes',
    messagesTitle: 'MeshCore Messages',
  },
  routes: {
    nodes: '/meshcore/nodes',
    managedNodes: '/meshcore/managed-nodes',
    messages: '/meshcore/messages',
    nodeDetail: (id) => nodeDetailPath({ internal_id: id, protocol: 2 }) ?? `/nodes/${id}`,
  },
  features: {
    constellationsOnMap: false,
    roleLegend: 'meshcore',
    autoTracerouteFilters: false,
    nodeCardBattery: false,
    showRecentBar: true,
    showInfrastructureLink: false,
  },
};
