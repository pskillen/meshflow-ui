import { useQuery } from '@tanstack/react-query';
import { useMeshtasticApi } from './useApi';

export interface NodeTracerouteLinkEdge {
  from_node_id: number;
  to_node_id: number;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  avg_snr_in: number | null;
  avg_snr_out: number | null;
  count: number;
}

export interface NodeTracerouteLinkNode {
  meshtastic_node_id: number;
  node_id_str?: string;
  lat: number;
  lng: number;
  short_name?: string;
  long_name?: string;
}

export interface NodeTracerouteLinkSnrHistory {
  peer_node_id: number;
  peer_short_name: string;
  inbound: Array<{ triggered_at: string; snr: number }>;
  outbound: Array<{ triggered_at: string; snr: number }>;
}

export interface NodeTracerouteLinksData {
  edges: NodeTracerouteLinkEdge[];
  nodes: NodeTracerouteLinkNode[];
  snr_history: NodeTracerouteLinkSnrHistory[];
}

export interface UseNodeTracerouteLinksParams {
  triggeredAtAfter?: Date;
}

export function useNodeTracerouteLinks(nodeId: number, params?: UseNodeTracerouteLinksParams) {
  const api = useMeshtasticApi();
  const triggeredAtAfter = params?.triggeredAtAfter?.toISOString();

  return useQuery({
    queryKey: ['node-traceroute-links', nodeId, { triggeredAtAfter }],
    queryFn: () =>
      api.getNodeTracerouteLinks(nodeId, {
        triggered_at_after: triggeredAtAfter,
      }),
    enabled: nodeId > 0,
  });
}
