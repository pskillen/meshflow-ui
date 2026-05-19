import { ObservedNode, ManagedNode } from '@/lib/models';
import L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import type { Feature, Point, Polygon, Position as GeoPosition } from 'geojson';
import { useMapTileUrl } from '@/hooks/useMapTileUrl';
import {
  createNodeIcon,
  createWeatherNodeIcon,
  getRoleColor,
  boundaryPolygonFromPoints,
  precisionBitsToMeters,
  buildNodePopupHtml,
} from './map-utils';
import { computeManagedConstellationGroups, constellationLegendItems } from './map-constellation-colors';
import { meshRoleLegendSwatches } from './map-role-legend';
import { MapMarkerLegend } from './MapMarkerLegend';

const DEFAULT_CENTER: L.LatLngExpression = [55.8642, -4.2518];
const UNCERTAINTY_THRESHOLD_M = 200;

export type MapNode = ObservedNode | ManagedNode;

function getNodeId(node: MapNode): number {
  return node.meshtastic_node_id;
}

function getNodePosition(node: MapNode): { lat: number; lng: number } | null {
  if ('latest_position' in node && node.latest_position?.latitude != null && node.latest_position?.longitude != null) {
    return { lat: node.latest_position.latitude, lng: node.latest_position.longitude };
  }
  if ('position' in node && node.position?.latitude != null && node.position?.longitude != null) {
    return { lat: node.position.latitude, lng: node.position.longitude };
  }
  return null;
}

function getNodePrecisionBits(node: MapNode): number | null | undefined {
  if ('latest_position' in node) return node.latest_position?.meshtastic_precision_bits;
  if ('position' in node)
    return (node.position as { meshtastic_precision_bits?: number | null })?.meshtastic_precision_bits;
  return null;
}

export interface NodesAndConstellationsMapProps {
  managedNodes?: ManagedNode[];
  observedNodes?: ObservedNode[];
  showConstellation?: boolean;
  showUnmanagedNodes?: boolean;
  drawBoundingBox?: boolean;
  constellationNodeRadiusKm?: number;
  constellationBoundaryRadiusKm?: number;
  drawPositionUncertainty?: boolean;
  filterConstellationIds?: number[] | null;
  enableBubbles?: boolean;
  onMapMove?: (center: L.LatLng, zoom: number) => void;
  onNodeSelect?: (node: MapNode | null) => boolean;
  /** When provided, highlights this node (e.g. selection from external source like search) */
  selectedNodeId?: number | null;
  /** Optional custom label for observed node markers (e.g. weather metrics) */
  getMarkerLabel?: (node: ObservedNode) => string;
  /** Optional opacity 0-1 for observed node markers (e.g. age-based fading) */
  getMarkerOpacity?: (node: ObservedNode) => number;
  /** When set with getMarkerLabel, overrides role colour (e.g. weather age blend) */
  getMarkerColor?: (node: ObservedNode) => string;
  /** Optional grayscale 0-1 for observed node markers (e.g. 24h = 100% gray) */
  getMarkerGrayscale?: (node: ObservedNode) => number;
  /** Optional CSS colour for a 3px inset border on weather-style markers (e.g. age indicator) */
  getMarkerBorderColor?: (node: ObservedNode) => string | undefined;
  /** Optional marker colour override for managed nodes */
  getManagedNodeMarkerColor?: (node: ManagedNode) => string;
  /**
   * When unset, legend shows except for custom marker colours (e.g. weather map).
   * Set `false` to hide; set `true` to force on even with `getMarkerColor`.
   */
  showMapLegend?: boolean;
  /** When false, hides role-colour swatches in the legend (constellation section unchanged). Default true. */
  showRoleLegendSwatches?: boolean;
  /** Optional alert ring around standard pins (e.g. Mesh Infra ops); constellation fill colour unchanged. */
  getNodeAlertRing?: (nodeId: number) => 'diamond' | 'rounded-square' | null | undefined;
}

export function NodesAndConstellationsMap({
  managedNodes = [],
  observedNodes = [],
  showConstellation = true,
  showUnmanagedNodes = true,
  drawBoundingBox = true,
  constellationNodeRadiusKm = 2,
  constellationBoundaryRadiusKm = 2.5,
  drawPositionUncertainty = false,
  filterConstellationIds = null,
  enableBubbles = true,
  onMapMove,
  onNodeSelect,
  selectedNodeId: selectedNodeIdProp,
  getMarkerLabel,
  getMarkerOpacity,
  getMarkerColor,
  getMarkerGrayscale,
  getMarkerBorderColor,
  getManagedNodeMarkerColor,
  showMapLegend,
  showRoleLegendSwatches = true,
  getNodeAlertRing,
}: NodesAndConstellationsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polygonsRef = useRef<L.Polygon[]>([]);
  const markersRef = useRef<L.Marker[]>([]);
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<number | null>(null);
  const selectedNodeId = selectedNodeIdProp ?? internalSelectedNodeId;
  const lastViewRef = useRef<{ center: L.LatLng; zoom: number } | null>(null);
  const onMapMoveRef = useRef(onMapMove);
  const onNodeSelectRef = useRef(onNodeSelect);
  const { url: tileUrl, attribution } = useMapTileUrl();
  onMapMoveRef.current = onMapMove;
  onNodeSelectRef.current = onNodeSelect;

  const roleLegendData = useMemo(() => meshRoleLegendSwatches(), []);

  const constellationGroups = useMemo(
    () => computeManagedConstellationGroups(managedNodes, filterConstellationIds),
    [managedNodes, filterConstellationIds]
  );

  const legendConstellationItems = useMemo(() => constellationLegendItems(constellationGroups), [constellationGroups]);

  const showLegendResolved =
    showMapLegend === false
      ? false
      : showMapLegend === true
        ? true
        : getMarkerColor == null && getManagedNodeMarkerColor == null;

  const handleMarkerClick = useCallback(
    (node: MapNode) => {
      const handler = onNodeSelectRef.current;
      const nodeId = getNodeId(node);
      if (selectedNodeId === nodeId) {
        setInternalSelectedNodeId(null);
        handler?.(null);
        return;
      }
      const shouldHighlight = handler?.(node) ?? false;
      setInternalSelectedNodeId(shouldHighlight ? nodeId : null);
    },
    [selectedNodeId]
  );

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView(DEFAULT_CENTER, 13);

      const tileLayer = L.tileLayer(tileUrl, {
        attribution,
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      map.on('moveend', () => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        lastViewRef.current = { center, zoom };
        onMapMoveRef.current?.(center, zoom);
      });

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
        .marker-pin-highlighted {
          box-shadow: 0 0 0 4px rgba(226, 153, 6, 0.9);
        }
        .marker-text {
          position: absolute;
          width: 40px;
          left: 50%;
          transform: translateX(-50%);
          top: 5px;
          text-align: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }
        .weather-marker-container {
          display: flex;
          justify-content: center;
          align-items: flex-end;
        }
        .weather-marker-pill {
          padding: 8px 14px;
          border-radius: 12px;
          min-width: 60px;
          max-width: 160px;
          text-align: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .weather-marker-text {
          color: white;
          font-size: 12px;
          font-weight: 600;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
          line-height: 1.2;
        }
        .leaflet-container { z-index: 1; }
        .leaflet-pane, .leaflet-tile, .leaflet-marker-icon, .leaflet-marker-shadow,
        .leaflet-tile-container, .leaflet-pane > svg, .leaflet-pane > canvas,
        .leaflet-zoom-box, .leaflet-image-layer, .leaflet-layer { z-index: 1; }
        .leaflet-overlay-pane { z-index: 2; }
        .leaflet-marker-pane { z-index: 3; }
        .leaflet-tooltip-pane { z-index: 4; }
        .leaflet-popup-pane { z-index: 5; }
        .leaflet-control { z-index: 6; }
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

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    polygonsRef.current.forEach((p) => p.remove());
    polygonsRef.current = [];
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const managedNodeIds = new Set(managedNodes.map((n) => n.meshtastic_node_id));
    const filteredManaged =
      filterConstellationIds != null && filterConstellationIds.length > 0
        ? managedNodes.filter((n) => n.constellation && filterConstellationIds.includes(n.constellation.id))
        : managedNodes;

    const constellations = computeManagedConstellationGroups(managedNodes, filterConstellationIds);

    const bounds = L.latLngBounds([]);
    const hasStoredView = lastViewRef.current != null;

    const drawPolygonCoords = (
      coords: GeoPosition[],
      opts: {
        color: string;
        fillColor?: string;
        fillOpacity?: number;
        weight?: number;
        opacity?: number;
        dashArray?: string;
      }
    ) => {
      const latlngs = coords
        .filter(
          (c): c is [number, number] =>
            Array.isArray(c) && c.length === 2 && typeof c[0] === 'number' && typeof c[1] === 'number'
        )
        .map(([lng, lat]) => [lat, lng]);
      if (latlngs.length > 2) {
        const poly = L.polygon(latlngs as [number, number][], opts).addTo(map);
        polygonsRef.current.push(poly);
      }
    };

    // 1. Constellation bounding polygon
    if (showConstellation && drawBoundingBox) {
      Object.values(constellations).forEach((c) => {
        const points: Feature<Point>[] = c.nodes
          .filter((n) => n.position?.latitude != null && n.position?.longitude != null)
          .map((n) => turf.point([n.position!.longitude!, n.position!.latitude!]) as Feature<Point>);
        if (points.length >= 2) {
          const boundary = boundaryPolygonFromPoints(points, constellationBoundaryRadiusKm);
          if (boundary?.geometry) {
            const draw = (coords: GeoPosition[]) =>
              drawPolygonCoords(coords, {
                color: c.color,
                fillOpacity: 0.12,
                weight: 3,
                opacity: 0.8,
                dashArray: '8 6',
              });
            if (boundary.geometry.type === 'Polygon') {
              (boundary.geometry.coordinates as GeoPosition[][]).forEach(draw);
            } else if (boundary.geometry.type === 'MultiPolygon') {
              (boundary.geometry.coordinates as unknown as GeoPosition[][][]).forEach((arr) => arr.forEach(draw));
            }
          }
        }
      });
    }

    // 2. Monitoring node radius circles
    if (showConstellation) {
      Object.values(constellations).forEach((c) => {
        const positionedCount = c.nodes.filter(
          (n) => n.position?.latitude != null && n.position?.longitude != null
        ).length;
        const isSingle = positionedCount === 1;
        const circleStyle = isSingle
          ? { fillOpacity: 0.2, weight: 4, opacity: 0.9, dashArray: '6 4' }
          : { fillOpacity: 0.08, weight: 2, opacity: 0.5, dashArray: '2 6' };

        c.nodes.forEach((node) => {
          if (node.position?.latitude != null && node.position?.longitude != null) {
            const point = turf.point([node.position.longitude, node.position.latitude]) as Feature<Point>;
            const buf = turf.buffer(point, constellationNodeRadiusKm, { units: 'kilometers' }) as Feature<Polygon>;
            if (buf?.geometry) {
              const draw = (coords: GeoPosition[]) =>
                drawPolygonCoords(coords, { color: c.color, fillColor: c.color, ...circleStyle });
              if (buf.geometry.type === 'Polygon') {
                (buf.geometry.coordinates as GeoPosition[][]).forEach(draw);
              } else if (buf.geometry.type === 'MultiPolygon') {
                (buf.geometry.coordinates as unknown as GeoPosition[][][]).forEach((arr) => arr.forEach(draw));
              }
            }
          }
        });
      });
    }

    // 3. Uncertainty circles (for nodes with meshtastic_precision_bits >= 200m)
    // When showUnmanagedNodes=false, only draw for managed nodes
    if (drawPositionUncertainty) {
      const nodesWithUncertainty: MapNode[] = showUnmanagedNodes
        ? [
            ...observedNodes.filter((n) => getNodePosition(n) != null),
            ...filteredManaged.filter((n) => getNodePosition(n) != null),
          ]
        : filteredManaged.filter((n) => getNodePosition(n) != null);
      const seen = new Set<number>();
      nodesWithUncertainty.forEach((node) => {
        const id = getNodeId(node);
        if (seen.has(id)) return;
        seen.add(id);
        const pos = getNodePosition(node);
        if (!pos) return;
        const meters = precisionBitsToMeters(getNodePrecisionBits(node));
        if (meters == null || meters < UNCERTAINTY_THRESHOLD_M) return;
        const km = meters / 1000;
        const point = turf.point([pos.lng, pos.lat]) as Feature<Point>;
        const buf = turf.buffer(point, km, { units: 'kilometers' }) as Feature<Polygon>;
        if (buf?.geometry) {
          const draw = (coords: GeoPosition[]) =>
            drawPolygonCoords(coords, {
              color: '#94a3b8',
              fillColor: '#94a3b8',
              fillOpacity: 0.1,
              weight: 2,
              opacity: 0.6,
              dashArray: '4 4',
            });
          if (buf.geometry.type === 'Polygon') {
            (buf.geometry.coordinates as GeoPosition[][]).forEach(draw);
          } else if (buf.geometry.type === 'MultiPolygon') {
            (buf.geometry.coordinates as unknown as GeoPosition[][][]).forEach((arr) => arr.forEach(draw));
          }
        }
      });
    }

    // 4. Observed node markers
    // When showConstellation: draw only observed-only nodes (exclude managed) if showUnmanagedNodes
    // When !showConstellation: draw all observed nodes (including managed) with role colors
    const observedLayer = showConstellation
      ? showUnmanagedNodes
        ? observedNodes.filter((o) => !managedNodeIds.has(o.meshtastic_node_id))
        : []
      : observedNodes;

    const managedNodeConstellationMap = new Map<number, string>();
    filteredManaged.forEach((n) => {
      if (n.constellation?.name) managedNodeConstellationMap.set(n.meshtastic_node_id, n.constellation.name);
    });

    const hasSelection = selectedNodeId != null;
    observedLayer.forEach((node) => {
      const pos = getNodePosition(node);
      if (!pos) return;
      const position: L.LatLngExpression = [pos.lat, pos.lng];
      const isSelected = selectedNodeId === node.meshtastic_node_id;
      const label = getMarkerLabel
        ? getMarkerLabel(node as ObservedNode)
        : node.short_name || node.node_id_str?.toString().slice(-4) || '?';
      const opacity = getMarkerOpacity?.(node as ObservedNode);
      const grayscale = getMarkerGrayscale?.(node as ObservedNode);
      const color = getMarkerColor
        ? getMarkerColor(node as ObservedNode)
        : getRoleColor('meshtastic_role' in node ? node.meshtastic_role : undefined);
      const dimmed = hasSelection && !isSelected;
      const icon = getMarkerLabel
        ? createWeatherNodeIcon(
            label,
            color,
            isSelected,
            dimmed,
            opacity,
            grayscale,
            getMarkerBorderColor?.(node as ObservedNode)
          )
        : createNodeIcon(
            label,
            color,
            isSelected,
            dimmed,
            opacity,
            grayscale,
            getNodeAlertRing?.(node.meshtastic_node_id) ?? undefined
          );
      const marker = L.marker(position, { icon });
      marker.on('click', () => handleMarkerClick(node));
      if (enableBubbles) {
        const constellationName = managedNodeConstellationMap.get(node.meshtastic_node_id) ?? null;
        marker.bindPopup(buildNodePopupHtml({ ...node, constellationName }));
      }
      marker.addTo(map);
      markersRef.current.push(marker);
      bounds.extend(position);
    });

    // 5. Managed node markers
    if (showConstellation) {
      Object.values(constellations).forEach((c) => {
        c.nodes.forEach((node) => {
          if (node.position?.latitude == null || node.position?.longitude == null) return;
          const position: L.LatLngExpression = [node.position.latitude, node.position.longitude];
          const isSelected = selectedNodeId === node.meshtastic_node_id;
          const marker = L.marker(position, {
            icon: createNodeIcon(
              node.short_name || node.node_id_str?.slice(4, 8) || '?',
              getManagedNodeMarkerColor ? getManagedNodeMarkerColor(node) : c.color,
              isSelected,
              hasSelection && !isSelected,
              undefined,
              undefined,
              getNodeAlertRing?.(node.meshtastic_node_id) ?? undefined
            ),
          });
          marker.on('click', () => handleMarkerClick(node));
          if (enableBubbles) {
            marker.bindPopup(buildNodePopupHtml({ ...node, constellationName: c.name }));
          }
          marker.addTo(map);
          markersRef.current.push(marker);
          bounds.extend(position);
        });
      });
    }

    if (hasStoredView) {
      map.setView(lastViewRef.current!.center, lastViewRef.current!.zoom);
    } else if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (observedLayer.length === 0 && Object.keys(constellations).length === 0) {
      map.setView(DEFAULT_CENTER, 13);
    }
  }, [
    managedNodes,
    observedNodes,
    showConstellation,
    showUnmanagedNodes,
    drawBoundingBox,
    constellationNodeRadiusKm,
    constellationBoundaryRadiusKm,
    drawPositionUncertainty,
    filterConstellationIds,
    enableBubbles,
    selectedNodeId,
    handleMarkerClick,
    getMarkerLabel,
    getMarkerOpacity,
    getMarkerColor,
    getMarkerGrayscale,
    getMarkerBorderColor,
    getManagedNodeMarkerColor,
    getNodeAlertRing,
  ]);

  return (
    <div className="relative h-full w-full min-h-[400px]">
      {showLegendResolved ? (
        <MapMarkerLegend
          constellationItems={showConstellation ? legendConstellationItems : []}
          showRoleSwatches={showRoleLegendSwatches && getMarkerColor == null}
          roleSwatches={roleLegendData}
          roleSectionTitle={showConstellation ? 'Other mesh nodes (by role)' : 'Node role'}
        />
      ) : null}
      <div
        ref={mapRef}
        style={{ height: '100%', minHeight: '400px', position: 'relative', zIndex: 1 }}
        className="map-container"
      />
    </div>
  );
}
