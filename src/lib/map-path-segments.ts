import type { TracerouteRouteNode } from '@/lib/models';

export type LatLng = [number, number];

export interface PathSegment {
  latlngs: LatLng[];
  dashed: boolean;
  unknownLabels: { node_id_str: string }[];
}

export function buildSegments(
  startPos: LatLng | null,
  nodes: TracerouteRouteNode[],
  endPos: LatLng | null
): PathSegment[] {
  if (!startPos || !endPos) return [];
  const segments: PathSegment[] = [];
  let solidRun: LatLng[] = [startPos];
  let pendingUnknowns: { node_id_str: string }[] = [];

  for (const node of nodes) {
    if (node.position) {
      const pos: LatLng = [node.position.latitude, node.position.longitude];
      if (pendingUnknowns.length > 0) {
        segments.push({
          latlngs: [solidRun[solidRun.length - 1], pos],
          dashed: true,
          unknownLabels: pendingUnknowns,
        });
        pendingUnknowns = [];
      }
      solidRun.push(pos);
    } else {
      if (solidRun.length >= 2) {
        segments.push({ latlngs: [...solidRun], dashed: false, unknownLabels: [] });
      }
      solidRun = [solidRun[solidRun.length - 1]];
      pendingUnknowns.push({ node_id_str: node.node_id_str });
    }
  }

  if (pendingUnknowns.length > 0) {
    segments.push({
      latlngs: [solidRun[solidRun.length - 1], endPos],
      dashed: true,
      unknownLabels: pendingUnknowns,
    });
  } else {
    solidRun.push(endPos);
    segments.push({ latlngs: solidRun, dashed: false, unknownLabels: [] });
  }

  return segments;
}

export function midpoint(a: LatLng, b: LatLng): LatLng {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
