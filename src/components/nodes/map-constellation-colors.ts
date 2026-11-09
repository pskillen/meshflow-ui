import * as d3 from 'd3';
import type { ManagedNode } from '@/lib/models';

/** True when a node has both coordinates, i.e. the map can draw a pin for it. Shared by the draw code and the key. */
export function hasMapPosition(node: Pick<ManagedNode, 'position'>): boolean {
  return node.position?.latitude != null && node.position?.longitude != null;
}

export type ConstellationMapGroup = {
  name: string;
  color: string;
  nodes: ManagedNode[];
};

/**
 * Same constellation grouping and colours as the mesh map: `map_color` when set, else `d3.schemeCategory10` by first-seen index.
 */
export function computeManagedConstellationGroups(
  managedNodes: ManagedNode[],
  filterConstellationIds: number[] | null | undefined
): Record<number, ConstellationMapGroup> {
  const filteredManaged =
    filterConstellationIds != null && filterConstellationIds.length > 0
      ? managedNodes.filter((n) => n.constellation && filterConstellationIds.includes(n.constellation.id))
      : managedNodes;

  const constellations: Record<number, ConstellationMapGroup> = {};
  filteredManaged.forEach((node) => {
    if (node.constellation) {
      const id = node.constellation.id;
      if (!constellations[id]) {
        constellations[id] = {
          name: node.constellation.name || 'Unknown',
          color: node.constellation.map_color || '',
          nodes: [],
        };
      }
      constellations[id].nodes.push(node);
    }
  });

  const constellationIds = Object.keys(constellations);
  constellationIds.forEach((id, idx) => {
    if (!constellations[+id].color) {
      constellations[+id].color = d3.schemeCategory10[idx % d3.schemeCategory10.length];
    }
  });

  return constellations;
}

export function constellationLegendItems(
  groups: Record<number, ConstellationMapGroup>
): Array<{ id: number; name: string; color: string }> {
  return Object.entries(groups)
    .map(([id, g]) => ({ id: +id, name: g.name, color: g.color }))
    .sort((a, b) => a.id - b.id);
}

/**
 * Keeps only legend items whose constellation has at least one node with a position, i.e. at least one pin on the map.
 * Call on groups computed from the full set so fallback colours (assigned by index) stay the same as the pins.
 */
export function drawnConstellationLegendItems(
  groups: Record<number, ConstellationMapGroup>
): Array<{ id: number; name: string; color: string }> {
  const drawn: Record<number, ConstellationMapGroup> = {};
  Object.entries(groups).forEach(([id, g]) => {
    if (g.nodes.some(hasMapPosition)) {
      drawn[+id] = g;
    }
  });
  return constellationLegendItems(drawn);
}
