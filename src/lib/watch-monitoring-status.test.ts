import { describe, it, expect } from 'vitest';
import type { NodeWatch, ObservedNodeWatchSummary } from '@/lib/models';
import {
  compareWatchesByMonitoringStatus,
  countWatchesByMonitoringStatus,
  deriveWatchMonitoringStatus,
  sortWatchesByMonitoringStatus,
  WATCH_STATUS_SORT_RANK,
} from './watch-monitoring-status';

function makeWatch(overrides: {
  watch?: Partial<NodeWatch>;
  node?: Partial<ObservedNodeWatchSummary>;
}): NodeWatch {
  const node: ObservedNodeWatchSummary = {
    internal_id: '00000000-0000-4000-8000-000000000001',
    meshtastic_node_id: 42,
    node_id_str: '!0000002a',
    mac_addr: null,
    long_name: null,
    short_name: 'N42',
    meshtastic_hw_model: null,
    meshtastic_public_key: null,
    last_heard: new Date('2026-01-01T12:00:00.000Z'),
    latest_device_metrics: null,
    latest_environment_metrics: null,
    latest_power_metrics: null,
    latest_position: null,
    owner: null,
    ...overrides.node,
  };
  return {
    id: 1,
    observed_node: node,
    offline_after: 3600,
    enabled: true,
    offline_notifications_enabled: true,
    battery_notifications_enabled: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides.watch,
  };
}

describe('deriveWatchMonitoringStatus', () => {
  const now = new Date('2026-01-01T13:00:00.000Z').getTime();

  it('returns offline when monitoring_offline_confirmed_at is set', () => {
    const w = makeWatch({
      node: {
        monitoring_offline_confirmed_at: '2026-01-01T12:30:00Z',
        last_heard: new Date('2026-01-01T12:59:00.000Z'),
      },
    });
    expect(deriveWatchMonitoringStatus(w, now)).toBe('offline');
  });

  it('returns verifying when verification started and not offline', () => {
    const w = makeWatch({
      node: {
        monitoring_verification_started_at: '2026-01-01T12:30:00Z',
        monitoring_offline_confirmed_at: null,
      },
    });
    expect(deriveWatchMonitoringStatus(w, now)).toBe('verifying');
  });

  it('returns battery_low when battery_alert_active and not verifying/offline', () => {
    const w = makeWatch({
      node: {
        battery_alert_active: true,
        monitoring_verification_started_at: null,
        monitoring_offline_confirmed_at: null,
        last_heard: new Date('2026-01-01T12:30:00.000Z'),
      },
      watch: { offline_after: 7200 },
    });
    expect(deriveWatchMonitoringStatus(w, now)).toBe('battery_low');
  });

  it('returns online when last_heard is within offline_after', () => {
    const w = makeWatch({
      watch: { offline_after: 7200 },
      node: {
        monitoring_verification_started_at: null,
        last_heard: new Date('2026-01-01T12:30:00.000Z'),
      },
    });
    expect(deriveWatchMonitoringStatus(w, now)).toBe('online');
  });

  it('returns unknown when last_heard is older than offline_after and not verifying', () => {
    const w = makeWatch({
      watch: { offline_after: 1800 },
      node: {
        monitoring_verification_started_at: null,
        last_heard: new Date('2026-01-01T12:00:00.000Z'),
      },
    });
    expect(deriveWatchMonitoringStatus(w, now)).toBe('unknown');
  });

  it('returns unknown when last_heard is missing', () => {
    const w = makeWatch({ node: { last_heard: null } });
    expect(deriveWatchMonitoringStatus(w, now)).toBe('unknown');
  });
});

describe('sortWatchesByMonitoringStatus', () => {
  it('orders offline before online', () => {
    const now = new Date('2026-01-01T15:00:00.000Z').getTime();
    const online = makeWatch({
      watch: { id: 1, offline_after: 3600 },
      node: {
        meshtastic_node_id: 1,
        last_heard: new Date('2026-01-01T14:30:00.000Z'),
        monitoring_offline_confirmed_at: null,
        monitoring_verification_started_at: null,
      },
    });
    const offline = makeWatch({
      watch: { id: 2, offline_after: 3600 },
      node: {
        meshtastic_node_id: 2,
        monitoring_offline_confirmed_at: '2026-01-01T14:00:00Z',
        last_heard: new Date('2026-01-01T14:30:00.000Z'),
      },
    });
    const sorted = sortWatchesByMonitoringStatus([online, offline], now);
    expect(sorted.map((w) => w.id)).toEqual([2, 1]);
    expect(WATCH_STATUS_SORT_RANK.offline < WATCH_STATUS_SORT_RANK.online).toBe(true);
  });
});

describe('countWatchesByMonitoringStatus', () => {
  it('aggregates by status', () => {
    const now = new Date('2026-01-01T13:00:00.000Z').getTime();
    const watches = [
      makeWatch({
        watch: { id: 1 },
        node: { monitoring_offline_confirmed_at: '2026-01-01T12:00:00Z' },
      }),
      makeWatch({
        watch: { id: 2, offline_after: 7200 },
        node: { meshtastic_node_id: 3, last_heard: new Date('2026-01-01T12:30:00.000Z') },
      }),
    ];
    expect(countWatchesByMonitoringStatus(watches, now)).toEqual({
      offline: 1,
      verifying: 0,
      battery_low: 0,
      unknown: 0,
      online: 1,
    });
  });
});

describe('compareWatchesByMonitoringStatus', () => {
  it('sorts unknown with older last_heard before newer within same rank', () => {
    const now = new Date('2026-01-01T15:00:00.000Z').getTime();
    const newerUnknown = makeWatch({
      watch: { id: 1, offline_after: 60 },
      node: { meshtastic_node_id: 10, last_heard: new Date('2026-01-01T14:50:00.000Z') },
    });
    const olderUnknown = makeWatch({
      watch: { id: 2, offline_after: 60 },
      node: { meshtastic_node_id: 11, last_heard: new Date('2026-01-01T14:00:00.000Z') },
    });
    const sorted = [newerUnknown, olderUnknown].sort((a, b) => compareWatchesByMonitoringStatus(a, b, now));
    expect(sorted[0].id).toBe(2);
    expect(sorted[1].id).toBe(1);
  });
});
