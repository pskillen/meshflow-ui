import { ObservedNode } from '@/lib/models';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { useMapTileUrl } from '@/hooks/useMapTileUrl';
import { createNodeIcon, getRoleColor, buildNodePopupHtml } from './map-utils';
import { MapMarkerLegend } from './MapMarkerLegend';
import { meshRoleLegendSwatches } from './map-role-legend';
import type { RoleLegendSwatch } from './map-role-legend';

interface NodesMapProps {
  nodes: ObservedNode[];
  /** Default true: role-colour key for marker pins. */
  showMapLegend?: boolean;
  /** When set, marker pins use these colours by `meshtastic_node_id` instead of Meshtastic role. */
  markerColorsByNodeId?: ReadonlyMap<number, string> | Record<number, string>;
  /** Legend rows when using `markerColorsByNodeId` (e.g. watch monitoring status). */
  mapLegendStatusSwatches?: RoleLegendSwatch[];
  mapLegendStatusTitle?: string;
}

// Default center only used if no nodes are present
const DEFAULT_CENTER: L.LatLngExpression = [55.8642, -4.2518];

function colorMapFromProp(
  markerColorsByNodeId: ReadonlyMap<number, string> | Record<number, string> | undefined
): ReadonlyMap<number, string> | null {
  if (!markerColorsByNodeId) return null;
  return markerColorsByNodeId instanceof Map
    ? markerColorsByNodeId
    : new Map(Object.entries(markerColorsByNodeId).map(([k, v]) => [Number(k), v]));
}

export function NodesMap({
  nodes,
  showMapLegend = true,
  markerColorsByNodeId,
  mapLegendStatusSwatches,
  mapLegendStatusTitle,
}: NodesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const { url: tileUrl, attribution } = useMapTileUrl();
  const roleSwatches = useMemo(() => meshRoleLegendSwatches(), []);
  const colorByNodeId = useMemo(() => colorMapFromProp(markerColorsByNodeId), [markerColorsByNodeId]);
  const useStatusLegend = Boolean(colorByNodeId?.size && mapLegendStatusSwatches?.length);

  // Initialize the map
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView(DEFAULT_CENTER, 13);

      const tileLayer = L.tileLayer(tileUrl, {
        attribution,
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      // Add CSS for custom markers and map container
      const style = document.createElement('style');
      style.textContent = `
        .custom-node-marker {
          background: transparent;
          border: none;
        }
        .marker-container {
          position: relative;
          text-align: center;
        }
        .marker-pin {
          width: 35px;
          height: 35px;
          border-radius: 50% 50% 50% 0;
          position: absolute;
          transform: rotate(-45deg);
          left: 50%;
          top: 50%;
          margin: -2.5px 0 0 -17.5px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .marker-text {
          position: absolute;
          width: 40px;
          left: 60%;
          transform: translateX(-50%);
          top: 5px;
          text-align: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }
        /* Fix map container z-index issues */
        .leaflet-container {
          z-index: 1;
        }
        .leaflet-pane,
        .leaflet-tile,
        .leaflet-marker-icon,
        .leaflet-marker-shadow,
        .leaflet-tile-container,
        .leaflet-pane > svg,
        .leaflet-pane > canvas,
        .leaflet-zoom-box,
        .leaflet-image-layer,
        .leaflet-layer {
          z-index: 1;
        }
        .leaflet-overlay-pane {
          z-index: 2;
        }
        .leaflet-marker-pane {
          z-index: 3;
        }
        .leaflet-tooltip-pane {
          z-index: 4;
        }
        .leaflet-popup-pane {
          z-index: 5;
        }
        .leaflet-control {
          z-index: 6;
        }
      `;
      document.head.appendChild(style);

      mapInstanceRef.current = map;

      return () => {
        map.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        style.remove();
      };
    }
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const oldLayer = tileLayerRef.current;
    if (map && oldLayer) {
      map.removeLayer(oldLayer);
      const newLayer = L.tileLayer(tileUrl, {
        attribution,
      }).addTo(map);
      tileLayerRef.current = newLayer;
    }
  }, [tileUrl, attribution]);

  // Handle nodes updates
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (nodes.length === 0) {
      map.setView(DEFAULT_CENTER, 13);
      return;
    }

    const bounds = L.latLngBounds([]);

    const nodesWithPosition = nodes.filter((n) => n.latest_position?.latitude && n.latest_position?.longitude);

    nodesWithPosition.forEach((node) => {
      const position: L.LatLngExpression = [node.latest_position!.latitude!, node.latest_position!.longitude!];

      const pinColor = colorByNodeId?.get(node.meshtastic_node_id) ?? getRoleColor(node.meshtastic_role);

      const marker = L.marker(position, {
        icon: createNodeIcon(node.short_name || node.node_id_str.toString(), pinColor, false),
      })
        .bindPopup(buildNodePopupHtml(node))
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    if (nodesWithPosition.length === 1) {
      const only = nodesWithPosition[0];
      map.setView([only.latest_position!.latitude!, only.latest_position!.longitude!], 12);
    } else if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 15,
      });
    }
  }, [nodes, colorByNodeId]);

  return (
    <div className="relative h-full w-full min-h-[400px]">
      {showMapLegend ? (
        <MapMarkerLegend
          constellationItems={[]}
          showRoleSwatches={!useStatusLegend}
          roleSwatches={roleSwatches}
          roleSectionTitle="Node role"
          statusSwatches={useStatusLegend ? mapLegendStatusSwatches : undefined}
          statusSectionTitle={mapLegendStatusTitle}
        />
      ) : null}
      <div
        ref={mapRef}
        style={{
          height: '100%',
          minHeight: '400px',
          position: 'relative',
          zIndex: 1,
        }}
        className="map-container"
      />
    </div>
  );
}
