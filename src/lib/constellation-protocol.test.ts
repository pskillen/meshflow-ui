import { describe, expect, it } from 'vitest';
import { filterConstellationsForProtocol } from '@/lib/constellation-protocol';
import type { Constellation } from '@/lib/models';

const constellations: Constellation[] = [
  {
    id: 1,
    name: 'MT only',
    description: '',
    created_by: 1,
    map_color: '#000',
    channels: [{ id: 10, name: 'mt', constellation: 1, protocol: 1 }],
  },
  {
    id: 2,
    name: 'MC only',
    description: '',
    created_by: 1,
    map_color: '#111',
    channels: [{ id: 20, name: 'mc', constellation: 2, protocol: 2 }],
  },
];

describe('filterConstellationsForProtocol', () => {
  it('keeps constellations with at least one matching channel', () => {
    expect(filterConstellationsForProtocol(constellations, 'meshcore').map((c) => c.id)).toEqual([2]);
    expect(filterConstellationsForProtocol(constellations, 'meshtastic').map((c) => c.id)).toEqual([1]);
  });
});
