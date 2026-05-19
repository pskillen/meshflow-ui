import { describe, expect, it } from 'vitest';

import {
  MANAGED_NODE_ONLINE_MAX_AGE_SECONDS,
  MANAGED_NODE_STALE_MAX_AGE_SECONDS,
  filterManagedNodesForMapDisplay,
  getManagedNodeStatusTier,
  hasManagedNodeEverFedData,
} from './managed-node-status';
import type { ManagedNode } from '@/lib/models';

describe('getManagedNodeStatusTier', () => {
  const now = new Date('2026-04-20T12:00:00Z');

  it('returns never when there is no ingestion timestamp', () => {
    expect(getManagedNodeStatusTier(null, now)).toBe('never');
    expect(getManagedNodeStatusTier(undefined, now)).toBe('never');
  });

  it('returns online at or below online threshold', () => {
    const onlineAtThreshold = new Date(now.getTime() - MANAGED_NODE_ONLINE_MAX_AGE_SECONDS * 1000);
    expect(getManagedNodeStatusTier(onlineAtThreshold, now)).toBe('online');
  });

  it('returns stale just above online threshold and at stale threshold', () => {
    const justAboveOnline = new Date(now.getTime() - (MANAGED_NODE_ONLINE_MAX_AGE_SECONDS + 1) * 1000);
    const staleAtThreshold = new Date(now.getTime() - MANAGED_NODE_STALE_MAX_AGE_SECONDS * 1000);
    expect(getManagedNodeStatusTier(justAboveOnline, now)).toBe('stale');
    expect(getManagedNodeStatusTier(staleAtThreshold, now)).toBe('stale');
  });

  it('returns offline above stale threshold', () => {
    const offline = new Date(now.getTime() - (MANAGED_NODE_STALE_MAX_AGE_SECONDS + 1) * 1000);
    expect(getManagedNodeStatusTier(offline, now)).toBe('offline');
  });
});

describe('hasManagedNodeEverFedData', () => {
  it('is false when last_packet_ingested_at is missing', () => {
    expect(hasManagedNodeEverFedData({} as Pick<ManagedNode, 'last_packet_ingested_at'>)).toBe(false);
    expect(hasManagedNodeEverFedData({ last_packet_ingested_at: null })).toBe(false);
    expect(hasManagedNodeEverFedData({ last_packet_ingested_at: undefined })).toBe(false);
  });

  it('is true when last_packet_ingested_at is set', () => {
    expect(hasManagedNodeEverFedData({ last_packet_ingested_at: new Date('2026-01-01') })).toBe(true);
  });
});

describe('filterManagedNodesForMapDisplay', () => {
  const base: ManagedNode = {
    meshtastic_node_id: 1,
    long_name: null,
    short_name: 'A',
    last_heard: null,
    node_id_str: '!1',
    owner: { id: 1, username: 'u' },
    constellation: { id: 1 },
    allow_auto_traceroute: true,
    position: { latitude: 1, longitude: 1 },
  };

  it('drops nodes with no ingestion timestamp', () => {
    const fed: ManagedNode = { ...base, meshtastic_node_id: 2, last_packet_ingested_at: new Date() };
    const never: ManagedNode = { ...base, meshtastic_node_id: 3 };
    expect(filterManagedNodesForMapDisplay([fed, never])).toEqual([fed]);
  });
});
