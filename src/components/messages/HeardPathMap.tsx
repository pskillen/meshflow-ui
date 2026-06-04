import type { LatLng } from '@/lib/map-path-segments';
import { MAP_NODE_MARKER_CSS } from '@/lib/map-marker-styles';
import type { TracerouteRouteNode } from '@/lib/models';
import { useMapTileUrl } from '@/hooks/useMapTileUrl';
import { drawHeardPathLayers, hasDrawablePathOnMap, toLatLng } from './heard-path-map-layers';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: LatLng = [55.8642, -4.2518];

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
  /** Display name when sender position is missing (e.g. parsed MC channel prefix). */
  senderName?: string | null;
};

export function HeardPathMap({ sender, legs, senderName }: HeardPathMapProps) {
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
    if (!map || legs.length === 0) return;

    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];

    const bounds = L.latLngBounds([]);
    drawHeardPathLayers({
      map,
      layers: layersRef.current,
      bounds,
      sender,
      legs,
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

  if (legs.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        {senderPos ? 'No feeder positions available for map' : 'No map — sender and feeder positions unknown'}
      </div>
    );
  }

  const showSenderWarning = !senderPos;
  const hasPartialPaths = !senderPos && hasDrawablePathOnMap(null, legs);
  const warningLabel = senderName?.trim() || sender?.label;

  return (
    <div className="relative rounded-md border" style={{ height: '280px' }}>
      <div
        ref={mapRef}
        style={{ height: '100%', position: 'relative', zIndex: 1 }}
        className="map-container rounded-md"
      />
      {showSenderWarning && (
        <div
          className="pointer-events-none absolute left-2 right-2 top-2 z-[1000] rounded-md border border-amber-500/60 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 shadow-sm dark:border-amber-600/50 dark:bg-amber-950/90 dark:text-amber-50"
          role="status"
        >
          Sender position unknown
          {warningLabel ? ` (${warningLabel})` : ''} —
          {hasPartialPaths ? ' paths use known hop and feeder positions only.' : ' feeders shown; path lines omitted.'}
        </div>
      )}
    </div>
  );
}
