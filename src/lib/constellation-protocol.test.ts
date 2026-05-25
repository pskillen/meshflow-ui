import { describe, expect, it } from 'vitest';
import { filterConstellationsForProtocol, resolveMessageConstellationId } from '@/lib/constellation-protocol';
import type { Constellation } from '@/lib/models';

const constellations: Constellation[] = [
  {
    id: 1,
    name: 'Central Belt Scotland',
    description: '',
    created_by: 1,
    protocol: 1,
    map_color: '#000',
    channels: [
      { id: 10, name: 'mt', constellation: 1, protocol: 1 },
      { id: 11, name: 'stray-mc', constellation: 1, protocol: 2 },
    ],
  },
  {
    id: 2,
    name: 'Scottish Mesh MC',
    description: '',
    created_by: 1,
    protocol: 2,
    map_color: '#111',
    channels: [{ id: 20, name: 'mc', constellation: 2, protocol: 2 }],
  },
];

describe('filterConstellationsForProtocol', () => {
  it('excludes Meshtastic constellations in MeshCore mode even if they have MC channels', () => {
    expect(filterConstellationsForProtocol(constellations, 'meshcore').map((c) => c.id)).toEqual([2]);
    expect(filterConstellationsForProtocol(constellations, 'meshtastic').map((c) => c.id)).toEqual([1]);
  });
});

describe('resolveMessageConstellationId', () => {
  it('ignores preferred id when it is not in the filtered list', () => {
    const mcOnly = filterConstellationsForProtocol(constellations, 'meshcore');
    expect(resolveMessageConstellationId(mcOnly, 1, 'meshcore')).toBe(2);
  });

  it('keeps preferred id when it is in the filtered list', () => {
    const mtOnly = filterConstellationsForProtocol(constellations, 'meshtastic');
    expect(resolveMessageConstellationId(mtOnly, 1, 'meshtastic')).toBe(1);
  });
});
