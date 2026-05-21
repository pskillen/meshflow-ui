import { describe, it, expect } from 'vitest';
import { isMeshCoreObservedNode, supportsMeshtasticTraceroutes } from './observed-node-capabilities';

describe('supportsMeshtasticTraceroutes', () => {
  it('returns false for MeshCore nodes even with a numeric meshtastic_node_id', () => {
    expect(supportsMeshtasticTraceroutes({ protocol: 2, meshtastic_node_id: 100 })).toBe(false);
  });

  it('returns false when meshtastic_node_id is zero', () => {
    expect(supportsMeshtasticTraceroutes({ protocol: 1, meshtastic_node_id: 0 })).toBe(false);
  });

  it('returns true for Meshtastic nodes with a positive meshtastic_node_id', () => {
    expect(supportsMeshtasticTraceroutes({ protocol: 1, meshtastic_node_id: 100 })).toBe(true);
  });
});

describe('isMeshCoreObservedNode', () => {
  it('detects protocol 2', () => {
    expect(isMeshCoreObservedNode({ protocol: 2 })).toBe(true);
    expect(isMeshCoreObservedNode({ protocol: 1 })).toBe(false);
  });
});
