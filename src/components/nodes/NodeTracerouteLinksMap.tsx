import { useMemo, useState, useCallback } from 'react';
import { Popup } from 'react-map-gl/mapbox';
import { ArcLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { PickingInfo } from '@deck.gl/core';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { NodeTracerouteLinkEdge, NodeTracerouteLinkNode } from '@/hooks/api/useNodeTracerouteLinks';

import { DeckMapboxMap } from '@/components/map/DeckMapboxMap';
import { viewStateFromLngLatBBox } from '@/lib/deck-fit-bounds';

const DEFAULT_CENTER = { longitude: -4.2518, latitude: 55.8642, zoom: 8 };
const FOCUS_NODE_COLOR: [number, number, number, number] = [34, 197, 94, 255]; // green - focus
const PEER_NODE_COLOR: [number, number, number, number] = [134, 239, 172, 200]; // light green
const LOW_SNR_COLOR: [number, number, number, number] = [239, 68, 68, 200]; // red - bad
const HIGH_SNR_COLOR: [number, number, number, number] = [34, 197, 94, 200]; // green - good

/** Interpolate color by SNR. Higher SNR = greener, lower = redder. */
function interpolateColorBySnr(snr: number, minSnr: number, maxSnr: number): [number, number, number, number] {
  if (maxSnr <= minSnr) return LOW_SNR_COLOR;
  const t = (snr - minSnr) / (maxSnr - minSnr);
  const r = Math.round(LOW_SNR_COLOR[0] + (HIGH_SNR_COLOR[0] - LOW_SNR_COLOR[0]) * t);
  const g = Math.round(LOW_SNR_COLOR[1] + (HIGH_SNR_COLOR[1] - LOW_SNR_COLOR[1]) * t);
  const b = Math.round(LOW_SNR_COLOR[2] + (HIGH_SNR_COLOR[2] - LOW_SNR_COLOR[2]) * t);
  return [r, g, b, 200];
}

export interface NodeTracerouteLinksMapProps {
  edges: NodeTracerouteLinkEdge[];
  nodes: NodeTracerouteLinkNode[];
  focusNodeId: number;
  showLabels?: boolean;
}

function getNodeLabel(node: NodeTracerouteLinkNode): string {
  return node.short_name || node.long_name || node.node_id_str || `!${node.meshtastic_node_id.toString(16)}`;
}

export function NodeTracerouteLinksMap({ edges, nodes, focusNodeId, showLabels = true }: NodeTracerouteLinksMapProps) {
  const [selectedNode, setSelectedNode] = useState<NodeTracerouteLinkNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<NodeTracerouteLinkEdge | null>(null);

  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (info.object && (info.layer?.id === 'links-nodes' || info.layer?.id === 'links-node-labels')) {
        const node = info.object as NodeTracerouteLinkNode;
        setSelectedNode(node);
        setSelectedEdge(edges.find((e) => e.to_node_id === node.meshtastic_node_id) ?? null);
      } else {
        setSelectedNode(null);
        setSelectedEdge(null);
      }
    },
    [edges]
  );

  const edgesWithSnr = useMemo(() => {
    return edges.map((e) => {
      const avgSnr =
        e.avg_snr_in != null && e.avg_snr_out != null
          ? (e.avg_snr_in + e.avg_snr_out) / 2
          : (e.avg_snr_in ?? e.avg_snr_out ?? -999);
      return { ...e, _avgSnr: avgSnr };
    });
  }, [edges]);

  const arcLayer = useMemo(() => {
    if (edgesWithSnr.length === 0) return null;
    const snrValues = edgesWithSnr.map((e) => e._avgSnr).filter((s) => s > -999);
    const minSnr = snrValues.length ? Math.min(...snrValues) : -20;
    const maxSnr = snrValues.length ? Math.max(...snrValues) : 10;
    return new ArcLayer({
      id: 'links-arcs',
      data: edgesWithSnr,
      getSourcePosition: (d) => [d.from_lng, d.from_lat],
      getTargetPosition: (d) => [d.to_lng, d.to_lat],
      getSourceColor: (d) => interpolateColorBySnr(d._avgSnr, minSnr, maxSnr),
      getTargetColor: (d) => interpolateColorBySnr(d._avgSnr, minSnr, maxSnr),
      getWidth: 2,
      widthMinPixels: 2,
      widthMaxPixels: 8,
      getHeight: 0,
    });
  }, [edgesWithSnr]);

  const scatterLayer = useMemo(() => {
    if (nodes.length === 0) return null;
    return new ScatterplotLayer({
      id: 'links-nodes',
      data: nodes,
      getPosition: (d) => [d.lng, d.lat],
      getFillColor: (d) => (d.meshtastic_node_id === focusNodeId ? FOCUS_NODE_COLOR : PEER_NODE_COLOR),
      getRadius: (d) => (d.meshtastic_node_id === focusNodeId ? 150 : 100),
      radiusMinPixels: 4,
      radiusMaxPixels: 12,
      pickable: true,
    });
  }, [nodes, focusNodeId]);

  const textLayer = useMemo(() => {
    if (nodes.length === 0) return null;
    return new TextLayer({
      id: 'links-node-labels',
      data: showLabels ? nodes : [],
      getPosition: (d) => [d.lng, d.lat],
      getText: getNodeLabel,
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
  }, [nodes, showLabels]);

  const layers = useMemo(
    () => [arcLayer, scatterLayer, textLayer].filter(Boolean) as (ArcLayer | ScatterplotLayer | TextLayer)[],
    [arcLayer, scatterLayer, textLayer]
  );

  const initialViewState = useMemo(() => {
    const lats = nodes.map((n) => n.lat).filter((v) => typeof v === 'number');
    const lngs = nodes.map((n) => n.lng).filter((v) => typeof v === 'number');
    if (lats.length > 0 && lngs.length > 0) {
      const paddingDeg = 0.02;
      const bbox: [number, number, number, number] = [
        Math.min(...lngs) - paddingDeg,
        Math.min(...lats) - paddingDeg,
        Math.max(...lngs) + paddingDeg,
        Math.max(...lats) + paddingDeg,
      ];
      return viewStateFromLngLatBBox(bbox, { padding: 40, maxZoom: 14 });
    }
    const focusNode = nodes.find((n) => n.meshtastic_node_id === focusNodeId);
    if (focusNode && focusNode.lat != null && focusNode.lng != null) {
      return { longitude: focusNode.lng, latitude: focusNode.lat, zoom: 10 };
    }
    return DEFAULT_CENTER;
  }, [nodes, focusNodeId]);

  return (
    <DeckMapboxMap layers={layers} initialViewState={initialViewState} onClick={handleClick}>
      {selectedNode && (
        <Popup
          longitude={selectedNode.lng}
          latitude={selectedNode.lat}
          anchor="bottom"
          closeButton={false}
          closeOnClick={false}
          onClose={() => {
            setSelectedNode(null);
            setSelectedEdge(null);
          }}
          maxWidth="320px"
          className="meshflow-map-popup"
        >
          <div className="relative min-w-[140px] rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
              }}
              className="absolute right-1 top-1 rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="pr-5">
              <div className="font-semibold">
                {selectedNode.long_name && selectedNode.short_name
                  ? `${selectedNode.long_name} (${selectedNode.short_name})`
                  : getNodeLabel(selectedNode)}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {selectedNode.node_id_str || `!${selectedNode.meshtastic_node_id.toString(16)}`}
              </div>
              {selectedEdge && (
                <div className="mt-1 space-y-0.5 text-xs">
                  {selectedEdge.avg_snr_in != null && (
                    <div>
                      <span className="text-slate-400">SNR in:</span> {selectedEdge.avg_snr_in.toFixed(1)} dB
                    </div>
                  )}
                  {selectedEdge.avg_snr_out != null && (
                    <div>
                      <span className="text-slate-400">SNR out:</span> {selectedEdge.avg_snr_out.toFixed(1)} dB
                    </div>
                  )}
                </div>
              )}
              <Link
                to={`/nodes/${selectedNode.meshtastic_node_id}`}
                className="mt-1 inline-block text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                Open details
              </Link>
            </div>
          </div>
        </Popup>
      )}
    </DeckMapboxMap>
  );
}
