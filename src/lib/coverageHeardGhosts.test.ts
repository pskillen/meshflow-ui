import { describe, it, expect } from 'vitest';

import { observedNodesToCoverageGhosts } from './coverageHeardGhosts';
import type { ObservedNode } from './models';

describe('observedNodesToCoverageGhosts', () => {
  it('drops represented ids and nodes without position', () => {
    const nodes: ObservedNode[] = [
      {
        internal_id: 1,
        meshtastic_node_id: 10,
        node_id_str: '!a',
        mac_addr: null,
        long_name: 'A',
        short_name: 'A',
        hw_model: null,
        public_key: null,
        latest_position: { latitude: 1, longitude: 2, reported_time: null, logged_time: null, altitude: null, location_source: 'gps' },
      },
      {
        internal_id: 2,
        meshtastic_node_id: 20,
        node_id_str: '!b',
        mac_addr: null,
        long_name: null,
        short_name: 'B',
        hw_model: null,
        public_key: null,
        latest_position: null,
      },
    ];
    const represented = new Set([10]);
    expect(observedNodesToCoverageGhosts(nodes, represented)).toEqual([]);
  });

  it('keeps unrepresented nodes with coordinates', () => {
    const nodes: ObservedNode[] = [
      {
        internal_id: 3,
        meshtastic_node_id: 30,
        node_id_str: '!c',
        mac_addr: null,
        long_name: 'Ghost',
        short_name: 'G',
        hw_model: null,
        public_key: null,
        latest_position: { latitude: 55.1, longitude: -4.1, reported_time: null, logged_time: null, altitude: null, location_source: 'gps' },
      },
    ];
    const g = observedNodesToCoverageGhosts(nodes, new Set());
    expect(g).toHaveLength(1);
    expect(g[0].meshtastic_node_id).toBe(30);
    expect(g[0].lat).toBe(55.1);
    expect(g[0].lng).toBe(-4.1);
  });
});
