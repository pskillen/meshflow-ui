import { describe, it, expect } from 'vitest';
import { observedNodeHeardOnOrAfter, pickTargetLastHeardCutoff } from '@/lib/observed-node-recency';
import type { ObservedNode } from '@/lib/models';

function makeNode(overrides: Partial<ObservedNode> = {}): ObservedNode {
  return {
    internal_id: 1,
    meshtastic_node_id: 1,
    node_id_str: '!00000001',
    mac_addr: null,
    long_name: null,
    short_name: 'A',
    hw_model: null,
    public_key: null,
    ...overrides,
  };
}

describe('observed-node-recency', () => {
  it('pickTargetLastHeardCutoff is about 48h before now', () => {
    const now = new Date('2026-01-15T12:00:00Z');
    const c = pickTargetLastHeardCutoff(now);
    expect(c.getTime()).toBe(now.getTime() - 48 * 60 * 60 * 1000);
  });

  it('observedNodeHeardOnOrAfter rejects missing last_heard', () => {
    const cutoff = new Date('2026-01-10T00:00:00Z');
    expect(observedNodeHeardOnOrAfter(makeNode({ last_heard: null }), cutoff)).toBe(false);
    expect(observedNodeHeardOnOrAfter(makeNode({ last_heard: undefined }), cutoff)).toBe(false);
  });

  it('observedNodeHeardOnOrAfter compares against cutoff', () => {
    const cutoff = new Date('2026-01-10T12:00:00Z');
    expect(observedNodeHeardOnOrAfter(makeNode({ last_heard: new Date('2026-01-10T11:59:00Z') }), cutoff)).toBe(
      false
    );
    expect(observedNodeHeardOnOrAfter(makeNode({ last_heard: new Date('2026-01-10T12:00:00Z') }), cutoff)).toBe(
      true
    );
    expect(observedNodeHeardOnOrAfter(makeNode({ last_heard: new Date('2026-01-11T00:00:00Z') }), cutoff)).toBe(true);
  });
});
