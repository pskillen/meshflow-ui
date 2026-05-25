import { describe, expect, it } from 'vitest';
import { buildMeshCoreMapNodes } from '@/lib/meshcore-map-nodes';
import type { ManagedNode, ObservedNode } from '@/lib/models';

function makeObserved(overrides: Partial<ObservedNode> = {}): ObservedNode {
  return {
    internal_id: '11111111-1111-4111-8111-111111111111',
    meshtastic_node_id: 0,
    node_id_str: 'mc:aaaabbbbcccc',
    mac_addr: null,
    long_name: 'Observed',
    short_name: 'obs',
    meshtastic_hw_model: null,
    meshtastic_public_key: null,
    protocol: 2,
    last_heard: null,
    latest_position: { latitude: 55.1, longitude: -4.2, reported_time: null, logged_time: null, altitude: null, meshtastic_location_source: 'gps' },
    latest_device_metrics: null,
    ...overrides,
  };
}

function makeManaged(overrides: Partial<ManagedNode> = {}): ManagedNode {
  return {
    protocol: 2,
    meshtastic_node_id: 0,
    node_id_str: 'mc:feedfeedfeed',
    long_name: 'Feeder',
    short_name: 'fd',
    last_heard: null,
    owner: { id: 1, username: 'op' },
    constellation: { id: 1, name: 'MC' },
    position: { latitude: 55.5, longitude: -4.5 },
    ...overrides,
  };
}

describe('buildMeshCoreMapNodes', () => {
  it('includes managed feeders with position not in observed list', () => {
    const nodes = buildMeshCoreMapNodes([], [makeManaged()]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].node_id_str).toBe('mc:feedfeedfeed');
    expect(nodes[0].latest_position?.latitude).toBe(55.5);
  });

  it('merges feeder position into matching observed node', () => {
    const observed = makeObserved({ latest_position: null });
    const managed = makeManaged({ node_id_str: observed.node_id_str, position: { latitude: 56, longitude: -5 } });
    const nodes = buildMeshCoreMapNodes([observed], [managed]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].internal_id).toBe(observed.internal_id);
    expect(nodes[0].latest_position?.latitude).toBe(56);
  });
});
