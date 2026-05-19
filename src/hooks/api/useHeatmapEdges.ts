import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMeshtasticApi } from './useApi';

export interface HeatmapEdge {
  from_node_id: number;
  to_node_id: number;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  weight: number;
  avg_snr?: number;
}

export type HeatmapNodeRole = 'backbone' | 'relay' | 'leaf' | 'offline';

export interface HeatmapNode {
  meshtastic_node_id: number;
  node_id_str: string;
  lat: number;
  lng: number;
  short_name?: string;
  long_name?: string;
  /** Normalised betweenness centrality (0–1), when provided by API */
  centrality?: number;
  /** Distinct neighbours in the heatmap subgraph */
  degree?: number;
  /** ISO 8601 from ObservedNode last_heard */
  last_seen?: string | null;
  /** Server-derived role (~24h offline cutoff) */
  role?: HeatmapNodeRole;
}

export interface HeatmapEdgesData {
  edges: HeatmapEdge[];
  nodes: HeatmapNode[];
  meta: {
    active_nodes_count: number;
    total_trace_routes_count: number;
  };
}

export interface UseHeatmapEdgesParams {
  triggeredAtAfter?: Date;
  constellationId?: number;
  bbox?: [number, number, number, number];
  edgeMetric?: 'packets' | 'snr';
  /** Meshtastic node id of the feeder (matches API `source_node_id`) */
  sourceNodeId?: number;
  /** CSV of strategy tokens sent to API `target_strategy` */
  targetStrategy?: string;
}

export function useHeatmapEdges(params?: UseHeatmapEdgesParams) {
  const api = useMeshtasticApi();
  const triggeredAtAfter = params?.triggeredAtAfter?.toISOString();

  return useQuery({
    queryKey: [
      'heatmap-edges',
      {
        triggeredAtAfter,
        constellationId: params?.constellationId,
        bbox: params?.bbox,
        edgeMetric: params?.edgeMetric,
        sourceNodeId: params?.sourceNodeId,
        targetStrategy: params?.targetStrategy,
      },
    ],
    placeholderData: keepPreviousData,
    queryFn: () =>
      api.getHeatmapEdges({
        triggered_at_after: triggeredAtAfter,
        constellation_id: params?.constellationId,
        bbox: params?.bbox,
        edge_metric: params?.edgeMetric,
        source_node_id: params?.sourceNodeId,
        target_strategy: params?.targetStrategy,
      }),
  });
}
