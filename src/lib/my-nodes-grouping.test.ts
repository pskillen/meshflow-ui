import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ManagedNode, ObservedNode } from '@/lib/models';

import {
  MY_NODES_CLAIMED_ONLINE_MS,
  MY_NODES_CLAIMED_RECENT_MS,
  MY_NODES_FEEDER_FRESH_MS,
  bucketForLastHeard,
  buildNodesForMap,
  getManagedLiveness,
  getPositionHint,
  groupClaimedNodes,
  managedRadioActivityAt,
  mergeManagedPositionIntoObserved,
  managedNodeToObservedNode,
} from './my-nodes-grouping';

const NOW = new Date('2026-04-21T12:00:00.000Z');

function makeObserved(overrides: Partial<ObservedNode> = {}): ObservedNode {
  return {
    internal_id: '00000000-0000-4000-8000-000000000001',
    meshtastic_node_id: 100,
    node_id_str: '!00000064',
    mac_addr: null,
    long_name: 'LN',
    short_name: 'SN',
    meshtastic_hw_model: null,
    meshtastic_public_key: null,
    last_heard: NOW,
    latest_position: null,
    ...overrides,
  } as ObservedNode;
}

function makeManaged(overrides: Partial<ManagedNode> = {}): ManagedNode {
  return {
    meshtastic_node_id: 200,
    long_name: 'Managed LN',
    short_name: 'M1',
    last_heard: NOW,
    node_id_str: '!000000c8',
    owner: { id: 1, username: 'u' },
    constellation: { id: 1 },
    position: { latitude: 55.0, longitude: -4.0 },
    ...overrides,
  } as ManagedNode;
}

describe('bucketForLastHeard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns offline for null last_heard', () => {
    expect(bucketForLastHeard(null, NOW)).toBe('offline');
  });

  it('treats future last_heard as online (clock skew)', () => {
    const future = new Date(NOW.getTime() + 60_000);
    expect(bucketForLastHeard(future, NOW)).toBe('online');
  });

  it('is online at exactly 2h boundary', () => {
    const lh = new Date(NOW.getTime() - MY_NODES_CLAIMED_ONLINE_MS);
    expect(bucketForLastHeard(lh, NOW)).toBe('online');
  });

  it('is recent just past 2h', () => {
    const lh = new Date(NOW.getTime() - MY_NODES_CLAIMED_ONLINE_MS - 1);
    expect(bucketForLastHeard(lh, NOW)).toBe('recent');
  });

  it('is recent at exactly 7d boundary', () => {
    const lh = new Date(NOW.getTime() - MY_NODES_CLAIMED_RECENT_MS);
    expect(bucketForLastHeard(lh, NOW)).toBe('recent');
  });

  it('is offline just past 7d', () => {
    const lh = new Date(NOW.getTime() - MY_NODES_CLAIMED_RECENT_MS - 1);
    expect(bucketForLastHeard(lh, NOW)).toBe('offline');
  });
});

describe('groupClaimedNodes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('partitions nodes into buckets', () => {
    const online = makeObserved({
      meshtastic_node_id: 1,
      last_heard: new Date(NOW.getTime() - 60_000),
    });
    const recent = makeObserved({
      meshtastic_node_id: 2,
      last_heard: new Date(NOW.getTime() - MY_NODES_CLAIMED_ONLINE_MS - 60_000),
    });
    const offline = makeObserved({ meshtastic_node_id: 3, last_heard: null });
    const g = groupClaimedNodes([online, recent, offline], NOW);
    expect(g.online).toEqual([online]);
    expect(g.recent).toEqual([recent]);
    expect(g.offline).toEqual([offline]);
  });
});

describe('getManagedLiveness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is ok when feeder and radio are fresh', () => {
    const feeder = new Date(NOW.getTime() - MY_NODES_FEEDER_FRESH_MS / 2);
    const radio = new Date(NOW.getTime() - MY_NODES_CLAIMED_ONLINE_MS / 2);
    const r = getManagedLiveness(
      {
        last_packet_ingested_at: feeder,
        radio_last_heard: radio,
        last_heard: new Date(0),
      },
      NOW
    );
    expect(r.severity).toBe('ok');
    expect(r.message).toBeNull();
  });

  it('warns when feeder stale and radio fresh', () => {
    const feeder = new Date(NOW.getTime() - MY_NODES_FEEDER_FRESH_MS - 60_000);
    const radio = new Date(NOW.getTime() - 60_000);
    const r = getManagedLiveness(
      {
        last_packet_ingested_at: feeder,
        radio_last_heard: radio,
        last_heard: null,
      },
      NOW
    );
    expect(r.severity).toBe('warn');
    expect(r.message).toMatch(/Feeder not reporting/);
  });

  it('is ok when last_packet_ingested_at is missing but radio is fresh (no false feeder warning)', () => {
    const radio = new Date(NOW.getTime() - 60_000);
    const r = getManagedLiveness(
      {
        last_packet_ingested_at: null,
        radio_last_heard: radio,
        last_heard: new Date(0),
      },
      NOW
    );
    expect(r.severity).toBe('ok');
    expect(r.message).toBeNull();
  });

  it('is ok when last_packet_ingested_at is undefined and last_heard is fresh', () => {
    const r = getManagedLiveness(
      {
        last_packet_ingested_at: undefined,
        radio_last_heard: null,
        last_heard: new Date(NOW.getTime() - 60_000),
      },
      NOW
    );
    expect(r.severity).toBe('ok');
    expect(r.message).toBeNull();
  });

  it('warns when feeder fresh and radio stale', () => {
    const feeder = new Date(NOW.getTime() - 60_000);
    const radio = new Date(NOW.getTime() - MY_NODES_CLAIMED_ONLINE_MS - 60_000);
    const r = getManagedLiveness(
      {
        last_packet_ingested_at: feeder,
        radio_last_heard: radio,
        last_heard: null,
      },
      NOW
    );
    expect(r.severity).toBe('warn');
    expect(r.message).toMatch(/Radio hasn't heard/);
  });

  it('is destructive when both stale', () => {
    const feeder = new Date(NOW.getTime() - MY_NODES_FEEDER_FRESH_MS - 60_000);
    const radio = new Date(NOW.getTime() - MY_NODES_CLAIMED_ONLINE_MS - 60_000);
    const r = getManagedLiveness(
      {
        last_packet_ingested_at: feeder,
        radio_last_heard: radio,
        last_heard: null,
      },
      NOW
    );
    expect(r.severity).toBe('destructive');
    expect(r.message).toMatch(/Managed node offline/);
  });
});

describe('managedRadioActivityAt', () => {
  it('prefers radio_last_heard over last_heard', () => {
    const r = new Date('2026-01-01T00:00:00Z');
    const l = new Date('2026-06-01T00:00:00Z');
    expect(managedRadioActivityAt({ radio_last_heard: r, last_heard: l })).toBe(r);
  });

  it('falls back to last_heard', () => {
    const l = new Date('2026-06-01T00:00:00Z');
    expect(managedRadioActivityAt({ radio_last_heard: null, last_heard: l })).toBe(l);
  });
});

describe('getPositionHint', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns No GPS position for missing coords', () => {
    const n = makeObserved({ latest_position: { latitude: 0, longitude: 0 } as ObservedNode['latest_position'] });
    const h = getPositionHint(n, NOW);
    expect(h.label).toBe('No GPS position');
    expect(h.treatment).toBe('missing');
  });

  it('returns stale when reported_time older than 7d', () => {
    const old = new Date(NOW.getTime() - MY_NODES_CLAIMED_RECENT_MS - 60_000);
    const n = makeObserved({
      latest_position: {
        latitude: 1,
        longitude: 2,
        reported_time: old,
        logged_time: null,
        altitude: null,
        meshtastic_location_source: 'gps',
      },
    });
    const h = getPositionHint(n, NOW);
    expect(h.label).toBe('GPS position stale (>7d)');
    expect(h.treatment).toBe('stale');
  });

  it('marks recent position as ok treatment', () => {
    const n = makeObserved({
      latest_position: {
        latitude: 1,
        longitude: 2,
        reported_time: new Date(NOW.getTime() - 60_000),
        logged_time: null,
        altitude: null,
        meshtastic_location_source: 'gps',
      },
    });
    expect(getPositionHint(n, NOW).treatment).toBe('ok');
  });
});

describe('buildNodesForMap and merge', () => {
  it('dedupes by meshtastic_node_id and merges managed position when observed has none', () => {
    const claimed = makeObserved({
      meshtastic_node_id: 42,
      latest_position: null,
    });
    const managed = makeManaged({
      meshtastic_node_id: 42,
      position: { latitude: 10, longitude: 20 },
    });
    const merged = buildNodesForMap([claimed], [managed]);
    expect(merged).toHaveLength(1);
    expect(merged[0].latest_position?.latitude).toBe(10);
    expect(merged[0].short_name).toBe('SN');
  });

  it('keeps claimed position when already valid', () => {
    const claimed = makeObserved({
      meshtastic_node_id: 42,
      latest_position: {
        latitude: 1,
        longitude: 2,
        reported_time: null,
        logged_time: null,
        altitude: null,
        meshtastic_location_source: 'gps',
      },
    });
    const managed = makeManaged({
      meshtastic_node_id: 42,
      position: { latitude: 10, longitude: 20 },
    });
    const merged = buildNodesForMap([claimed], [managed]);
    expect(merged[0].latest_position?.latitude).toBe(1);
  });

  it('adds managed-only nodes', () => {
    const managed = makeManaged({ meshtastic_node_id: 99 });
    const merged = buildNodesForMap([], [managed]);
    expect(merged).toHaveLength(1);
    expect(merged[0].meshtastic_node_id).toBe(99);
  });

  it('mergeManagedPositionIntoObserved fills from managed', () => {
    const o = makeObserved({ meshtastic_node_id: 1, latest_position: null });
    const m = makeManaged({ meshtastic_node_id: 1, position: { latitude: 3, longitude: 4 } });
    const r = mergeManagedPositionIntoObserved(o, m);
    expect(r.latest_position?.latitude).toBe(3);
  });

  it('managedNodeToObservedNode exposes coords for map', () => {
    const m = makeManaged({ position: { latitude: 5, longitude: 6 } });
    const o = managedNodeToObservedNode(m);
    expect(o.latest_position?.latitude).toBe(5);
  });
});
