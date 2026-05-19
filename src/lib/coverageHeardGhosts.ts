import type { ObservedNode } from '@/lib/models';

/** Observed node with position, not shown as a traceroute target or feeder marker. */
export interface CoverageHeardGhost {
  meshtastic_node_id: number;
  node_id_str: string;
  short_name: string | null;
  long_name: string | null;
  lat: number;
  lng: number;
}

/** Nodes heard in the window with a map position, excluding traceroute coverage rows and feeders. */
export function observedNodesToCoverageGhosts(
  nodes: ObservedNode[],
  representedNodeIds: ReadonlySet<number>
): CoverageHeardGhost[] {
  const out: CoverageHeardGhost[] = [];
  for (const n of nodes) {
    if (representedNodeIds.has(n.meshtastic_node_id)) continue;
    const p = n.latest_position;
    if (p == null || p.latitude == null || p.longitude == null) continue;
    out.push({
      meshtastic_node_id: n.meshtastic_node_id,
      node_id_str: n.node_id_str,
      short_name: n.short_name ?? null,
      long_name: n.long_name ?? null,
      lat: p.latitude,
      lng: p.longitude,
    });
  }
  return out;
}
