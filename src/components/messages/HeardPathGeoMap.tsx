import type { MapPosition } from '@/lib/models';
import { MAP_NODE_MARKER_CSS } from '@/lib/map-marker-styles';
import { useMapTileUrl } from '@/hooks/useMapTileUrl';
import { createNodeIcon } from '@/components/nodes/map-utils';
import type { LatLng } from '@/lib/map-path-segments';
import type { HeardPathLeg } from './HeardPathMap';
import { drawHeardPathPolylinesOnly, hasDrawablePathOnMap, toLatLng } from './heard-path-map-layers';
import { HEARD_PATH_LEG_COLORS, HEARD_PATH_SENDER_COLOR } from './heard-path-constants';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: LatLng = [55.8642, -4.2518];

export type HeardPathGeoAnchor = {
  label: string;
  position: MapPosition;
  color?: string;
};

export type HeardPathGeoMapProps = {
  sender: HeardPathGeoAnchor | null;
  feeders: HeardPathGeoAnchor[];
  /** Optional per-feeder path geometry (MeshCore); anchor markers remain on this map. */
  pathLegs?: HeardPathLeg[];
  senderName?: string | null;
};

export function HeardPathGeoMap({ sender, feeders, pathLegs = [], senderName }: HeardPathGeoMapProps) {
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
      style.id = 'heard-path-geo-map-styles';
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
    if (!map) return;

    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];

    const bounds = L.latLngBounds([]);
    let hasMarker = false;

    if (sender) {
      const pos = toLatLng(sender.position);
      const marker = L.marker(pos, {
        icon: createNodeIcon(sender.label, HEARD_PATH_SENDER_COLOR, false),
      }).addTo(map);
      layersRef.current.push(marker);
      bounds.extend(pos);
      hasMarker = true;
    }

    feeders.forEach((feeder, index) => {
      const pos = toLatLng(feeder.position);
      const color = feeder.color ?? HEARD_PATH_LEG_COLORS[index % HEARD_PATH_LEG_COLORS.length];
      const marker = L.marker(pos, {
        icon: createNodeIcon(feeder.label, color, false),
      }).addTo(map);
      layersRef.current.push(marker);
      bounds.extend(pos);
      hasMarker = true;
    });

    if (pathLegs.length > 0) {
      drawHeardPathPolylinesOnly(map, layersRef.current, bounds, senderPos, pathLegs);
    }

    if (!hasMarker) return;

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
    }, 150);
    return () => clearTimeout(t);
  }, [sender, feeders, pathLegs, senderPos]);

  if (!sender && feeders.length === 0) {
    return (
      <div
        className="flex min-h-[200px] items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground"
        data-testid="heard-path-geo-map-empty"
      >
        No map — sender and feeder positions unknown
      </div>
    );
  }

  const showSenderWarning = !sender;
  const hasPartialPaths = !sender && hasDrawablePathOnMap(null, pathLegs);
  const warningLabel = senderName?.trim() || sender?.label;

  return (
    <div className="relative rounded-md border" style={{ height: '240px' }} data-testid="heard-path-geo-map">
      <div ref={mapRef} style={{ height: '100%' }} className="map-container rounded-md" />
      {showSenderWarning && feeders.length > 0 && (
        <div
          className="pointer-events-none absolute left-2 right-2 top-2 z-[1000] rounded-md border border-amber-500/60 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 shadow-sm dark:border-amber-600/50 dark:bg-amber-950/90 dark:text-amber-50"
          role="status"
        >
          Sender position unknown
          {warningLabel ? ` (${warningLabel})` : ''} —
          {hasPartialPaths
            ? ' paths use known hop and feeder positions only; full chain below.'
            : ' feeders shown; hop paths are schematic below.'}
        </div>
      )}
    </div>
  );
}
