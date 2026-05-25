import { describe, expect, it } from 'vitest';
import { isObservedNodeInternalId, nodeDetailPath } from '@/lib/node-detail-routes';

const VALID_UUID = 'a1b2c3d4-e5f6-4789-a012-8456789abcde';

describe('nodeDetailPath', () => {
  it('prefers internal_id UUID', () => {
    expect(
      nodeDetailPath({
        internal_id: VALID_UUID,
        meshtastic_node_id: 42,
        node_id_str: '!0000002a',
      })
    ).toBe(`/nodes/${VALID_UUID}`);
  });

  it('uses legacy meshtastic numeric id when no UUID', () => {
    expect(nodeDetailPath({ meshtastic_node_id: 42, node_id_str: '!0000002a' })).toBe('/nodes/42');
  });

  it('encodes MeshCore node_id_str when numeric id is zero', () => {
    expect(
      nodeDetailPath({
        meshtastic_node_id: 0,
        node_id_str: 'mc:deadbeefcafe',
        protocol: 2,
      })
    ).toBe('/nodes/mc%3Adeadbeefcafe');
  });

  it('isObservedNodeInternalId rejects mc prefix paths', () => {
    expect(isObservedNodeInternalId('mc:abc')).toBe(false);
    expect(isObservedNodeInternalId(VALID_UUID)).toBe(true);
  });
});
