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

function toLatLngFromNode(node: TracerouteRouteNode): LatLng {
  return [node.position!.latitude, node.position!.longitude];
}

export type PartialSegmentParams = {
  startPos: LatLng | null;
  waypoints: TracerouteRouteNode[];
  endPos: LatLng | null;
  truncateAfterLastKnown?: boolean;
};

/**
 * Build path segments when start and/or end may be missing and trailing hops may lack positions.
 * Omits lines past the last positioned intermediate when truncateAfterLastKnown is true.
 */
export function buildPartialSegments({
  startPos,
  waypoints,
  endPos,
  truncateAfterLastKnown = true,
}: PartialSegmentParams): PathSegment[] {
  let nodes = waypoints;
  let end = endPos;

  if (truncateAfterLastKnown && endPos) {
    let lastPositionedIdx = -1;
    for (let i = waypoints.length - 1; i >= 0; i -= 1) {
      if (waypoints[i].position) {
        lastPositionedIdx = i;
        break;
      }
    }
    if (lastPositionedIdx >= 0) {
      const trailingUnknown = waypoints.slice(lastPositionedIdx + 1).some((w) => !w.position);
      if (trailingUnknown) {
        end = null;
        nodes = waypoints.slice(0, lastPositionedIdx + 1);
      }
    } else if (!startPos) {
      return [];
    }
  }

  let start = startPos;
  if (!start) {
    const firstIdx = nodes.findIndex((w) => w.position);
    if (firstIdx < 0) {
      return [];
    }
    start = toLatLngFromNode(nodes[firstIdx]);
    nodes = nodes.slice(firstIdx + 1);
  }

  if (!start) {
    return [];
  }

  if (!end) {
    const lastPositioned = [...nodes].reverse().find((w) => w.position);
    if (!lastPositioned?.position) {
      return [];
    }
    const endAnchor = toLatLngFromNode(lastPositioned);
    const lastIdx = nodes.indexOf(lastPositioned);
    const chain = nodes.slice(0, lastIdx + 1);
    return buildSegments(start, chain, endAnchor);
  }

  const hasPositionedHop = nodes.some((w) => w.position);
  if (!hasPositionedHop) {
    return [
      {
        latlngs: [start, end],
        dashed: true,
        unknownLabels: waypoints.map((node) => ({ node_id_str: node.node_id_str })),
      },
    ];
  }

  return buildSegments(start, nodes, end);
}
