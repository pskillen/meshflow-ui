import { buildPartialSegments, midpoint, type LatLng, type PathSegment } from '@/lib/map-path-segments';
import { createNodeIcon } from '@/components/nodes/map-utils';
import type { MapPosition } from './HeardPathMap';
import type { HeardPathLeg } from './HeardPathMap';
import { HEARD_PATH_LEG_COLORS, HEARD_PATH_SENDER_COLOR } from './heard-path-constants';
import L from 'leaflet';

export function toLatLng(pos: MapPosition): LatLng {
  return [pos.latitude, pos.longitude];
}

export function planLegPathSegments(senderPos: LatLng | null, leg: HeardPathLeg): PathSegment[] {
  const receiverPos = toLatLng(leg.receiver.position);
  const hasPositionedHop = leg.waypoints.some((node) => node.position != null);

  if (!senderPos && !hasPositionedHop) {
    return [];
  }

  if (leg.pathKnown && hasPositionedHop && senderPos) {
    return buildPartialSegments({
      startPos: senderPos,
      waypoints: leg.waypoints,
      endPos: receiverPos,
      truncateAfterLastKnown: false,
    });
  }

  return buildPartialSegments({
    startPos: senderPos,
    waypoints: leg.waypoints,
    endPos: receiverPos,
    truncateAfterLastKnown: true,
  });
}

function unknownLabelContent(labels: { node_id_str: string }[]): string {
  return labels.map((l) => l.node_id_str).join(' · ');
}

export function addPathSegmentsToMap(map: L.Map, layers: L.Layer[], segments: PathSegment[], color: string): void {
  segments.forEach((seg) => {
    const poly = L.polyline(seg.latlngs, {
      color,
      weight: 4,
      dashArray: seg.dashed ? '10, 10' : undefined,
    }).addTo(map);
    layers.push(poly);

    if (seg.dashed && seg.unknownLabels.length > 0 && seg.latlngs.length >= 2) {
      const mid = midpoint(seg.latlngs[0], seg.latlngs[seg.latlngs.length - 1]);
      const tooltip = L.tooltip({
        permanent: true,
        direction: 'center',
        className: 'traceroute-unknown-label',
      })
        .setContent(unknownLabelContent(seg.unknownLabels))
        .setLatLng(mid);
      tooltip.addTo(map);
      layers.push(tooltip);
    }
  });
}

export type DrawHeardPathLayersOptions = {
  map: L.Map;
  layers: L.Layer[];
  bounds: L.LatLngBounds;
  sender: { label: string; position: MapPosition } | null;
  legs: HeardPathLeg[];
};

function drawLegPolylinesAndHopMarkers(
  map: L.Map,
  layers: L.Layer[],
  bounds: L.LatLngBounds,
  senderPos: LatLng | null,
  legs: HeardPathLeg[],
  options: { includeReceiverMarkers: boolean }
): boolean {
  let drewPath = false;

  legs.forEach((leg, index) => {
    const receiverPos = toLatLng(leg.receiver.position);
    const color = leg.lineColor ?? HEARD_PATH_LEG_COLORS[index % HEARD_PATH_LEG_COLORS.length];

    if (options.includeReceiverMarkers) {
      const receiverMarker = L.marker(receiverPos, {
        icon: createNodeIcon(leg.receiver.label, color, false),
      }).addTo(map);
      layers.push(receiverMarker);
      bounds.extend(receiverPos);
    }

    leg.waypoints.forEach((node) => {
      if (!node.position) return;
      const pos = toLatLng(node.position);
      const label = node.short_name || node.node_id_str;
      const hopMarker = L.marker(pos, {
        icon: createNodeIcon(label, color, false),
      }).addTo(map);
      layers.push(hopMarker);
      bounds.extend(pos);
    });

    const segments = planLegPathSegments(senderPos, leg);
    if (segments.length > 0) {
      drewPath = true;
      addPathSegmentsToMap(map, layers, segments, color);
      segments.forEach((seg) => {
        seg.latlngs.forEach((p) => bounds.extend(p));
      });
    }
  });

  return drewPath;
}

export function drawHeardPathLayers({ map, layers, bounds, sender, legs }: DrawHeardPathLayersOptions): boolean {
  const senderPos = sender ? toLatLng(sender.position) : null;

  if (senderPos) {
    const senderMarker = L.marker(senderPos, {
      icon: createNodeIcon(sender?.label ?? 'S', HEARD_PATH_SENDER_COLOR, false),
    }).addTo(map);
    layers.push(senderMarker);
    bounds.extend(senderPos);
  }

  return drawLegPolylinesAndHopMarkers(map, layers, bounds, senderPos, legs, { includeReceiverMarkers: true });
}

export function drawHeardPathPolylinesOnly(
  map: L.Map,
  layers: L.Layer[],
  bounds: L.LatLngBounds,
  senderPos: LatLng | null,
  legs: HeardPathLeg[]
): boolean {
  return drawLegPolylinesAndHopMarkers(map, layers, bounds, senderPos, legs, { includeReceiverMarkers: false });
}

export function hasDrawablePathOnMap(senderPos: LatLng | null, legs: HeardPathLeg[]): boolean {
  return legs.some((leg) => planLegPathSegments(senderPos, leg).length > 0);
}
