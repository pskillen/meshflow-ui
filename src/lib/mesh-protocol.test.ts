import { describe, it, expect } from 'vitest';
import type { ManagedNode } from '@/lib/models';
import {
  filterManagedNodesForClaim,
  meshProtocolFromManagedNode,
  meshProtocolFromObservedNode,
  MESHTASTIC_CONFIG,
  MESHCORE_CONFIG,
} from './mesh-protocol';

describe('mesh-protocol config', () => {
  it('meshtastic routes use legacy paths', () => {
    expect(MESHTASTIC_CONFIG.routes.map).toBe('/map');
    expect(MESHTASTIC_CONFIG.routes.nodes).toBe('/nodes');
    expect(MESHTASTIC_CONFIG.routes.managedNodes).toBe('/nodes/managed-nodes');
  });

  it('meshcore routes use meshcore prefix', () => {
    expect(MESHCORE_CONFIG.routes.map).toBeUndefined();
    expect(MESHCORE_CONFIG.routes.messages).toBe('/meshcore/messages');
    expect(MESHCORE_CONFIG.routes.managedNodes).toBe('/meshcore/managed-nodes');
  });

  it('meshtastic messages route', () => {
    expect(MESHTASTIC_CONFIG.routes.messages).toBe('/messages');
  });

  it('meshcore uses meshcore role legend', () => {
    expect(MESHCORE_CONFIG.features.roleLegend).toBe('meshcore');
    expect(MESHTASTIC_CONFIG.features.roleLegend).toBe('meshtastic');
  });
});

describe('claim feeder protocol filter', () => {
  const mt = { protocol: 1, node_id_str: '!12345678' } as ManagedNode;
  const mc = { protocol: 2, node_id_str: 'mc:aabbccddeeff' } as ManagedNode;
  const legacyMt = { node_id_str: '!abcdef01' } as ManagedNode;

  it('meshProtocolFromObservedNode respects mc: prefix', () => {
    expect(meshProtocolFromObservedNode({ protocol: 1, node_id_str: 'mc:abc' })).toBe(2);
  });

  it('filterManagedNodesForClaim keeps only matching feeders', () => {
    const all = [mt, mc, legacyMt];
    expect(filterManagedNodesForClaim(all, 1).map((n) => n.node_id_str)).toEqual(['!12345678', '!abcdef01']);
    expect(filterManagedNodesForClaim(all, 2).map((n) => n.node_id_str)).toEqual(['mc:aabbccddeeff']);
  });

  it('meshProtocolFromManagedNode uses node_id_str when protocol missing', () => {
    expect(meshProtocolFromManagedNode({ node_id_str: 'mc:ff00' })).toBe(2);
    expect(meshProtocolFromManagedNode({ node_id_str: '!00ff00ff' })).toBe(1);
  });
});
