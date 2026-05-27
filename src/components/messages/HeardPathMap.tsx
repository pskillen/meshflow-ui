import { buildSegments, midpoint, type LatLng } from '@/lib/map-path-segments';
import { MAP_NODE_MARKER_CSS } from '@/lib/map-marker-styles';
import type { TracerouteRouteNode } from '@/lib/models';
import { useMapTileUrl } from '@/hooks/useMapTileUrl';
import { createNodeIcon } from '@/components/nodes/map-utils';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: LatLng = [55.8642, -4.2518];
const SENDER_COLOR = '#16a34a';
const LEG_COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c'];

export type MapPosition = { latitude: number; longitude: number };

export type HeardPathLeg = {
  receiver: { label: string; position: MapPosition };
  waypoints: TracerouteRouteNode[];
  pathKnown: boolean;
  lineColor?: string;
};

export type HeardPathMapProps = {
  sender: { label: string; position: MapPosition } | null;
  legs: HeardPathLeg[];
};

function toLatLng(pos: MapPosition): LatLng {
  return [pos.latitude, pos.longitude];
}

function hasPositionedWaypoints(waypoints: TracerouteRouteNode[]): boolean {
  return waypoints.some((node) => node.position != null);
}

export function HeardPathMap({ sender, legs }: HeardPathMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const { url: tileUrl, attribution } = useMapTileUrl();

  const senderPos = sender ? toLatLng(sender.position) : null;

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView(DEFAULT_CENTER, 13);
      const tileLayer = L.tileLayer(tileUrl, { attribution }).addTo(map);
      tileLayerRef.current = tileLayer;
      mapInstanceRef.current = map;

      const style = document.createElement('style');
      style.id = 'heard-path-map-styles';
      style.textContent = MAP_NODE_MARKER_CSS;
      document.head.appendChild(style);

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
      const newLayer = L.tileLayer(tileUrl, { attribution }).addTo(map);
      tileLayerRef.current = newLayer;
    }
  }, [tileUrl, attribution]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !senderPos) return;

    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];

    const bounds = L.latLngBounds([]);
    const senderMarker = L.marker(senderPos, {
      icon: createNodeIcon(sender?.label ?? 'S', SENDER_COLOR, false),
    }).addTo(map);
    layersRef.current.push(senderMarker);
    bounds.extend(senderPos);

    legs.forEach((leg, index) => {
      const receiverPos = toLatLng(leg.receiver.position);
      const color = leg.lineColor ?? LEG_COLORS[index % LEG_COLORS.length];
      const receiverMarker = L.marker(receiverPos, {
        icon: createNodeIcon(leg.receiver.label, color, false),
      }).addTo(map);
      layersRef.current.push(receiverMarker);
      bounds.extend(receiverPos);

      const segments =
        leg.pathKnown && hasPositionedWaypoints(leg.waypoints)
          ? buildSegments(senderPos, leg.waypoints, receiverPos)
          : [
              {
                latlngs: [senderPos, receiverPos] as LatLng[],
                dashed: true,
                unknownLabels: leg.waypoints.map((node) => ({ node_id_str: node.node_id_str })),
              },
            ];

      segments.forEach((seg) => {
        const poly = L.polyline(seg.latlngs, {
          color,
          weight: 4,
          dashArray: seg.dashed ? '10, 10' : undefined,
        }).addTo(map);
        layersRef.current.push(poly);
        seg.latlngs.forEach((p) => bounds.extend(p));

        if (seg.dashed && seg.unknownLabels.length > 0 && seg.latlngs.length >= 2) {
          const mid = midpoint(seg.latlngs[0], seg.latlngs[seg.latlngs.length - 1]);
          seg.unknownLabels.forEach((label) => {
            const tooltip = L.tooltip({
              permanent: true,
              direction: 'center',
              className: 'traceroute-unknown-label',
            })
              .setContent(label.node_id_str)
              .setLatLng(mid);
            tooltip.addTo(map);
            layersRef.current.push(tooltip);
          });
        }
      });
    });

    if (bounds.isValid()) {
      map.invalidateSize();
      const t = setTimeout(() => {
        if (mapInstanceRef.current !== map) return;
        map.invalidateSize();
        const singlePoint = bounds.getNorthEast().equals(bounds.getSouthWest());
        if (singlePoint) {
          map.setView(bounds.getCenter(), 13);
        } else {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        }
        map.invalidateSize();
      }, 150);
      return () => clearTimeout(t);
    }
  }, [sender, senderPos, legs]);

  if (!senderPos) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        No map — sender position unknown
      </div>
    );
  }

  if (legs.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        No feeder positions available for map
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      style={{ height: '280px', position: 'relative', zIndex: 1 }}
      className="map-container rounded-md border"
    />
  );
}
