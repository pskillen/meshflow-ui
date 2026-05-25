import { describe, expect, it } from 'vitest';
import { isObservedNodeInternalId, nodeDetailPath, observedNodeDetailPath } from '@/lib/node-detail-routes';

const VALID_UUID = 'a1b2c3d4-e5f6-4789-a012-8456789abcde';

describe('nodeDetailPath', () => {
  it('uses ! node_id_str for Meshtastic when protocol known', () => {
    expect(
      nodeDetailPath({
        protocol: 1,
        node_id_str: '!12345678',
        internal_id: VALID_UUID,
      })
    ).toBe('/nodes/!12345678');
  });

  it('uses mc: for MeshCore when protocol known', () => {
    expect(
      nodeDetailPath({
        protocol: 2,
        node_id_str: 'mc:deadbeefcafe',
        meshtastic_node_id: 0,
      })
    ).toBe('/nodes/mc%3Adeadbeefcafe');
  });

  it('builds ! from meshtastic_node_id when protocol Meshtastic and no node_id_str', () => {
    expect(nodeDetailPath({ protocol: 1, meshtastic_node_id: 42 })).toBe('/nodes/!0000002a');
  });

  it('uses bare hex when protocol unknown', () => {
    expect(nodeDetailPath({ node_id_str: 'abcdef01' })).toBe('/nodes/abcdef01');
  });

  it('returns null when no linkable id', () => {
    expect(nodeDetailPath({ protocol: 2, meshtastic_node_id: 0 })).toBeNull();
  });

  it('isObservedNodeInternalId rejects mc prefix paths', () => {
    expect(isObservedNodeInternalId('mc:abc')).toBe(false);
    expect(isObservedNodeInternalId(VALID_UUID)).toBe(true);
  });

  it('observedNodeDetailPath prefers node_id_str over uuid', () => {
    expect(
      observedNodeDetailPath({
        internal_id: VALID_UUID,
        protocol: 1,
        meshtastic_node_id: 0x12345678,
        node_id_str: '!12345678',
      })
    ).toBe('/nodes/!12345678');
  });
});
