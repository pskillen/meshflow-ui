import { useMemo, useCallback, useState } from 'react';
import { Popup } from 'react-map-gl/mapbox';
import type { Layer, PickingInfo } from '@deck.gl/core';
import { PathStyleExtension } from '@deck.gl/extensions';
import { ArcLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { HeatmapEdge, HeatmapNode } from '@/hooks/api/useHeatmapEdges';

import { DeckMapboxMap } from '@/components/map/DeckMapboxMap';
import {
  HEATMAP_NODE_COLOR_FALLBACK,
  computeHeatmapArcEncoding,
  computeHeatmapNodeExtents,
  degreeFillColor,
  edgeArcColor,
  edgeArcWidth,
  getHeatmapNodeLabel,
  nodeLineColor,
  nodeLineWidth,
  nodeRadiusMeters,
  staleThresholdMs,
} from '@/components/traceroutes/heatmapEncoding';
import { TracerouteHeatmapNodePanel } from '@/components/traceroutes/TracerouteHeatmapNodePanel';

const DEFAULT_CENTER = { longitude: -4.2518, latitude: 55.8642, zoom: 8 };
/** Hide name labels when zoomed out past this level (deck.gl zoom). */
const HEATMAP_LABEL_MIN_ZOOM = 9.5;

/** Default hours without mesh observation before nodes fade (client-side styling). */
const DEFAULT_STALE_THRESHOLD_HOURS = 6;

/** Grey dashed strokes for edges that touch a leaf node (matches topology view). */
const LEAF_EDGE_GREY: [number, number, number, number] = [142, 142, 148, 200];

const leafEdgeDashExtension = new PathStyleExtension({ dash: true });

export interface TracerouteHeatmapMapProps {
  edges: HeatmapEdge[];
  nodes: HeatmapNode[];
  intensity?: number;
  edgeMetric?: 'packets' | 'snr';
  /** Hours without last_seen before treating as stale for styling (default 6). */
  staleThresholdHours?: number;
  selectedNode: HeatmapNode | null;
  onSelectedNodeChange: (node: HeatmapNode | null) => void;
  /** Optional link in popup (e.g. switch to topology with same filters). */
  topologyLink?: { to: string; label: string };
}

export function TracerouteHeatmapMap({
  edges,
  nodes,
  intensity = 0.7,
  edgeMetric = 'packets',
  staleThresholdHours = DEFAULT_STALE_THRESHOLD_HOURS,
  selectedNode,
  onSelectedNodeChange,
  topologyLink,
}: TracerouteHeatmapMapProps) {
  const [zoom, setZoom] = useState<number>(typeof DEFAULT_CENTER.zoom === 'number' ? DEFAULT_CENTER.zoom : 8);
  const staleMs = staleThresholdMs(staleThresholdHours);

  const nodeMetrics = useMemo(() => computeHeatmapNodeExtents(nodes), [nodes]);

  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (info.object && (info.layer?.id === 'heatmap-nodes' || info.layer?.id === 'heatmap-node-labels')) {
        onSelectedNodeChange(info.object as HeatmapNode);
      } else {
        onSelectedNodeChange(null);
      }
    },
    [onSelectedNodeChange]
  );

  const handleViewStateChange = useCallback((params: { viewState: { zoom?: number } }) => {
    const z = params.viewState?.zoom;
    if (typeof z === 'number' && !Number.isNaN(z)) setZoom(z);
  }, []);

  const arcEncoding = useMemo(
    () => computeHeatmapArcEncoding(edges, edgeMetric, intensity),
    [edges, edgeMetric, intensity]
  );

  const roleById = useMemo(() => {
    const m = new Map<number, HeatmapNode['role']>();
    for (const n of nodes) m.set(n.meshtastic_node_id, n.role);
    return m;
  }, [nodes]);

  const { coreEdges, leafEdges } = useMemo(() => {
    const core: HeatmapEdge[] = [];
    const leaf: HeatmapEdge[] = [];
    for (const e of edges) {
      const ra = roleById.get(e.from_node_id);
      const rb = roleById.get(e.to_node_id);
      const touchesLeaf = ra === 'leaf' || rb === 'leaf';
      if (touchesLeaf) leaf.push(e);
      else core.push(e);
    }
    return { coreEdges: core, leafEdges: leaf };
  }, [edges, roleById]);

  const leafPathLayer = useMemo(() => {
    if (!arcEncoding || leafEdges.length === 0) return null;
    const enc = arcEncoding;
    return new PathLayer({
      id: `heatmap-leaf-edges-${edgeMetric}`,
      data: leafEdges,
      extensions: [leafEdgeDashExtension],
      getPath: (d: HeatmapEdge) => [
        [d.from_lng, d.from_lat],
        [d.to_lng, d.to_lat],
      ],
      getColor: LEAF_EDGE_GREY,
      getWidth: (d: HeatmapEdge) => edgeArcWidth(d, enc),
      widthMinPixels: 1,
      widthMaxPixels: 18,
      getDashArray: [5, 5],
      capRounded: true,
      jointRounded: true,
      updateTriggers: {
        getWidth: [enc.minVal, enc.maxVal, enc.baseWidth],
      },
    });
  }, [leafEdges, arcEncoding, edgeMetric]);

  const arcLayer = useMemo(() => {
    if (!arcEncoding || coreEdges.length === 0) return null;
    const enc = arcEncoding;
    return new ArcLayer({
      id: `heatmap-arcs-${edgeMetric}`,
      data: coreEdges,
      getSourcePosition: (d) => [d.from_lng, d.from_lat],
      getTargetPosition: (d) => [d.to_lng, d.to_lat],
      getSourceColor: (d) => edgeArcColor(d, enc),
      getTargetColor: (d) => edgeArcColor(d, enc),
      getWidth: (d) => edgeArcWidth(d, enc),
      widthMinPixels: 1,
      widthMaxPixels: 20,
      getHeight: 0,
    });
  }, [coreEdges, arcEncoding, edgeMetric]);

  const scatterLayer = useMemo(() => {
    if (nodes.length === 0) return null;
    const nowMs = Date.now();
    const { cExt, dExt, hasSignal } = nodeMetrics;

    return new ScatterplotLayer({
      id: 'heatmap-nodes',
      data: nodes,
      getPosition: (d) => [d.lng, d.lat],
      getFillColor: (d) =>
        hasSignal ? degreeFillColor(d, dExt.min, dExt.max, nowMs, staleMs) : HEATMAP_NODE_COLOR_FALLBACK,
      getRadius: (d) => (hasSignal ? nodeRadiusMeters(d.centrality, cExt.min, cExt.max) : 380),
      radiusMinPixels: 4,
      radiusMaxPixels: 22,
      stroked: true,
      lineWidthUnits: 'pixels',
      getLineWidth: (d) => (hasSignal ? nodeLineWidth(d, dExt.min, dExt.max) : 1),
      lineWidthMinPixels: 0.5,
      lineWidthMaxPixels: 8,
      getLineColor: (d) =>
        hasSignal ? nodeLineColor(degreeFillColor(d, dExt.min, dExt.max, nowMs, staleMs)) : [30, 60, 40, 180],
      pickable: true,
      updateTriggers: {
        getFillColor: [nowMs, staleMs, hasSignal, dExt.min, dExt.max, cExt.min, cExt.max],
        getRadius: [hasSignal, cExt.min, cExt.max],
        getLineWidth: [hasSignal, dExt.min, dExt.max],
        getLineColor: [nowMs, staleMs, hasSignal, dExt.min, dExt.max],
      },
    });
  }, [nodes, nodeMetrics, staleMs]);

  const textLayer = useMemo(() => {
    if (nodes.length === 0 || zoom < HEATMAP_LABEL_MIN_ZOOM) return null;
    return new TextLayer({
      id: 'heatmap-node-labels',
      data: nodes,
      getPosition: (d) => [d.lng, d.lat],
      getText: getHeatmapNodeLabel,
      getSize: 11,
      sizeMinPixels: 9,
      sizeMaxPixels: 12,
      getColor: [220, 220, 220, 230],
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      background: true,
      getBackgroundColor: [25, 25, 35, 200],
      backgroundPadding: [6, 3],
      backgroundBorderRadius: 2,
      pickable: true,
    });
  }, [nodes, zoom]);

  const layers = useMemo(
    () => [leafPathLayer, arcLayer, scatterLayer, textLayer].filter(Boolean) as Layer[],
    [leafPathLayer, arcLayer, scatterLayer, textLayer]
  );

  return (
    <DeckMapboxMap
      layers={layers}
      initialViewState={DEFAULT_CENTER}
      onClick={handleClick}
      onViewStateChange={handleViewStateChange}
      data-testid="heatmap-map-container"
    >
      {selectedNode && (
        <Popup
          longitude={selectedNode.lng}
          latitude={selectedNode.lat}
          anchor="bottom"
          closeButton={false}
          closeOnClick={false}
          onClose={() => onSelectedNodeChange(null)}
          maxWidth="320px"
          className="meshflow-map-popup"
        >
          <TracerouteHeatmapNodePanel
            node={selectedNode}
            onClose={() => onSelectedNodeChange(null)}
            secondaryLink={topologyLink}
          />
        </Popup>
      )}
    </DeckMapboxMap>
  );
}
