import { describe, expect, it } from 'vitest';
import {
  apiKeyLinkedInternalIds,
  apiKeyLinksManagedNode,
  isObservedNodeManaged,
  normalizeMcPubkeyInput,
} from './managed-node-enrollment';
import type { ManagedNode, NodeApiKey, ObservedNode } from './models';

describe('normalizeMcPubkeyInput', () => {
  it('accepts 64 hex and lowercases', () => {
    const hex = 'a'.repeat(64);
    expect(normalizeMcPubkeyInput(hex.toUpperCase())).toEqual({ ok: true, value: hex });
  });

  it('rejects wrong length', () => {
    expect(normalizeMcPubkeyInput('abc')).toEqual({
      ok: false,
      message: 'Pubkey must be exactly 64 hexadecimal characters (lowercase).',
    });
  });
});

describe('isObservedNodeManaged', () => {
  const mcObserved: Pick<ObservedNode, 'protocol' | 'node_id_str' | 'meshtastic_node_id' | 'mc_pubkey' | 'internal_id'> =
    {
      protocol: 2,
      node_id_str: 'mc:aabbccddeeff',
      meshtastic_node_id: 0,
      mc_pubkey: 'b'.repeat(64),
      internal_id: 'obs-1',
    };

  it('matches MeshCore by mc_pubkey', () => {
    const managed: Pick<ManagedNode, 'protocol' | 'node_id_str' | 'meshtastic_node_id' | 'mc_pubkey' | 'internal_id'> =
      {
        protocol: 2,
        node_id_str: 'mc:aabbccddeeff',
        meshtastic_node_id: null,
        mc_pubkey: 'B'.repeat(64),
        internal_id: 'mgr-1',
      };
    expect(isObservedNodeManaged(mcObserved, [managed])).toBe(true);
  });

  it('matches Meshtastic by meshtastic_node_id', () => {
    const observed = {
      protocol: 1 as const,
      node_id_str: '!0000002a',
      meshtastic_node_id: 42,
      mc_pubkey: null,
      internal_id: 'obs-mt',
    };
    const managed = {
      protocol: 1 as const,
      node_id_str: '!0000002a',
      meshtastic_node_id: 42,
      mc_pubkey: null,
      internal_id: 'mgr-mt',
    };
    expect(isObservedNodeManaged(observed, [managed])).toBe(true);
  });
});

describe('apiKeyLinksManagedNode', () => {
  const mcNode: Pick<ManagedNode, 'internal_id' | 'meshtastic_node_id' | 'protocol'> = {
    internal_id: 'uuid-mc',
    meshtastic_node_id: null,
    protocol: 2,
  };

  it('uses linked_managed_nodes for MeshCore', () => {
    const key = {
      nodes: [],
      linked_managed_nodes: [{ internal_id: 'uuid-mc', node_id_str: 'mc:abc', protocol: 2, meshtastic_node_id: null }],
    } as unknown as NodeApiKey;
    expect(apiKeyLinksManagedNode(key, mcNode)).toBe(true);
  });

  it('falls back to legacy nodes list for Meshtastic', () => {
    const mtNode = { internal_id: 'uuid-mt', meshtastic_node_id: 100, protocol: 1 as const };
    const key = { nodes: [100], linked_managed_nodes: [] } as unknown as NodeApiKey;
    expect(apiKeyLinksManagedNode(key, mtNode)).toBe(true);
  });
});

describe('apiKeyLinkedInternalIds', () => {
  it('merges linked_managed_nodes and legacy numeric nodes', () => {
    const key = {
      nodes: [7],
      linked_managed_nodes: [{ internal_id: 'uuid-mc', node_id_str: 'mc:x', protocol: 2, meshtastic_node_id: null }],
    } as unknown as NodeApiKey;
    const managed = [
      { internal_id: 'uuid-mt', meshtastic_node_id: 7 },
      { internal_id: 'uuid-mc', meshtastic_node_id: null },
    ];
    expect(apiKeyLinkedInternalIds(key, managed).sort()).toEqual(['uuid-mc', 'uuid-mt']);
  });
});
