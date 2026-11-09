import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import {
  computeManagedConstellationGroups,
  constellationLegendItems,
  drawnConstellationLegendItems,
} from './map-constellation-colors';
import type { ManagedNode } from '@/lib/models';

function makeManaged(
  nodeId: number,
  constellation: { id: number; name?: string; map_color?: string }
): ManagedNode {
  return {
    meshtastic_node_id: nodeId,
    long_name: null,
    short_name: 'S',
    last_heard: null,
    node_id_str: `!${nodeId.toString(16)}`,
    owner: { id: 1, username: 'u' },
    constellation,
    position: { latitude: 1, longitude: 1 },
  } as ManagedNode;
}

describe('computeManagedConstellationGroups', () => {
  it('assigns d3 fallback colours in first-seen id string order (matches previous map behaviour)', () => {
    const nodes: ManagedNode[] = [
      makeManaged(1, { id: 20, name: 'B', map_color: '' }),
      makeManaged(2, { id: 10, name: 'A', map_color: '' }),
    ];
    const groups = computeManagedConstellationGroups(nodes, null);
    const ids = Object.keys(groups).sort((a, b) => +a - +b);
    expect(ids).toEqual(['10', '20']);
    // `Object.keys` uses ascending numeric key order when assigning fallback colours.
    expect(groups[10].color).toBe(d3.schemeCategory10[0]);
    expect(groups[20].color).toBe(d3.schemeCategory10[1]);
  });

  it('keeps explicit map_color from API', () => {
    const nodes: ManagedNode[] = [makeManaged(1, { id: 1, name: 'X', map_color: '#abcdef' })];
    const groups = computeManagedConstellationGroups(nodes, null);
    expect(groups[1].color).toBe('#abcdef');
  });

  it('filters by constellation ids when provided', () => {
    const nodes: ManagedNode[] = [
      makeManaged(1, { id: 1, name: 'Keep' }),
      makeManaged(2, { id: 2, name: 'Drop' }),
    ];
    const groups = computeManagedConstellationGroups(nodes, [1]);
    expect(Object.keys(groups)).toEqual(['1']);
  });
});

describe('constellationLegendItems', () => {
  it('sorts by constellation id', () => {
    const groups = computeManagedConstellationGroups(
      [makeManaged(1, { id: 5, name: 'E' }), makeManaged(2, { id: 2, name: 'B' })],
      null
    );
    const items = constellationLegendItems(groups);
    expect(items.map((i) => i.id)).toEqual([2, 5]);
  });
});

describe('drawnConstellationLegendItems', () => {
  const unpositioned = (nodeId: number, constellation: { id: number; name?: string; map_color?: string }) =>
    ({ ...makeManaged(nodeId, constellation), position: { latitude: null, longitude: null } }) as ManagedNode;

  it('lists only constellations with at least one positioned node, across mixed protocols', () => {
    const nodes: ManagedNode[] = [
      { ...makeManaged(1, { id: 1, name: 'Mesh drawn', map_color: '#111111' }), protocol: 1 } as ManagedNode,
      { ...unpositioned(2, { id: 2, name: 'MeshCore no position', map_color: '#222222' }), protocol: 2 } as ManagedNode,
      { ...makeManaged(3, { id: 3, name: 'MeshCore drawn', map_color: '#333333' }), protocol: 2 } as ManagedNode,
      unpositioned(4, { id: 3, name: 'MeshCore drawn', map_color: '#333333' }),
    ];
    const items = drawnConstellationLegendItems(computeManagedConstellationGroups(nodes, null));
    expect(items.map((i) => i.name)).toEqual(['Mesh drawn', 'MeshCore drawn']);
  });

  it('does not recolour pins: fallback colours stay indexed over the full group set', () => {
    const nodes: ManagedNode[] = [
      unpositioned(1, { id: 1, name: 'Hidden' }),
      makeManaged(2, { id: 2, name: 'Shown' }),
    ];
    const groups = computeManagedConstellationGroups(nodes, null);
    const items = drawnConstellationLegendItems(groups);
    expect(items).toEqual([{ id: 2, name: 'Shown', color: d3.schemeCategory10[1] }]);
    expect(items[0].color).toBe(groups[2].color);
  });
});
