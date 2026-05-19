import { describe, it, expect } from 'vitest';
import type { ObservedNode } from '@/lib/models';
import {
  hasMeshInfraMapBatteryOrPresenceAlert,
  isLowBatteryTableRowVisible,
  matchesLowBatteryStaleReadingRow,
  partitionMeshInfraLowBatteryTableNodes,
  partitionLowBatteryNodes,
} from './infrastructure-low-battery';

function node(partial: Partial<ObservedNode>): ObservedNode {
  return {
    internal_id: 1,
    meshtastic_node_id: 1,
    node_id_str: '!00000001',
    mac_addr: null,
    long_name: 'A',
    short_name: 'A',
    meshtastic_hw_model: null,
    meshtastic_public_key: null,
    last_heard: new Date(),
    latest_position: null,
    latest_device_metrics: null,
    latest_environment_metrics: null,
    latest_power_metrics: null,
    ...partial,
  } as ObservedNode;
}

describe('partitionMeshInfraLowBatteryTableNodes', () => {
  it('includes nodes with battery_alert_active even when not in heuristic low-battery list', () => {
    const okBattery = node({
      meshtastic_node_id: 1,
      latest_device_metrics: {
        battery_level: 90,
        reported_time: new Date(),
        logged_time: null,
      } as ObservedNode['latest_device_metrics'],
      battery_alert_active: false,
    });
    const alertOnly = node({
      meshtastic_node_id: 2,
      latest_device_metrics: {
        battery_level: 90,
        reported_time: new Date(),
        logged_time: null,
      } as ObservedNode['latest_device_metrics'],
      battery_alert_active: true,
    });
    const low = node({
      meshtastic_node_id: 3,
      latest_device_metrics: {
        battery_level: 10,
        reported_time: new Date(),
        logged_time: null,
      } as ObservedNode['latest_device_metrics'],
    });
    const out = partitionMeshInfraLowBatteryTableNodes([okBattery, alertOnly, low]);
    expect(out.map((n) => n.meshtastic_node_id)).toContain(2);
    expect(out.map((n) => n.meshtastic_node_id)).toContain(3);
    expect(out[0].meshtastic_node_id).toBe(2);
    expect(partitionLowBatteryNodes([okBattery, alertOnly, low]).some((n) => n.meshtastic_node_id === 2)).toBe(false);
  });
});

describe('isLowBatteryTableRowVisible', () => {
  const baseFilters = {
    showStaleReadings: false,
    showZeroPercent: false,
    showNoTelemetry: false,
  };

  it('hides no-telemetry rows by default', () => {
    const n = node({ meshtastic_node_id: 1, latest_device_metrics: null });
    expect(isLowBatteryTableRowVisible(n, baseFilters)).toBe(false);
    expect(isLowBatteryTableRowVisible(n, { ...baseFilters, showNoTelemetry: true })).toBe(true);
  });

  it('hides stale-reading rows by default', () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const n = node({
      meshtastic_node_id: 2,
      latest_device_metrics: {
        battery_level: 90,
        reported_time: old,
        logged_time: null,
      } as ObservedNode['latest_device_metrics'],
    });
    expect(matchesLowBatteryStaleReadingRow(n)).toBe(true);
    expect(isLowBatteryTableRowVisible(n, baseFilters)).toBe(false);
    expect(isLowBatteryTableRowVisible(n, { ...baseFilters, showStaleReadings: true })).toBe(true);
  });

  it('shows mesh-alert-only rows regardless of battery filters', () => {
    const n = node({
      meshtastic_node_id: 3,
      latest_device_metrics: {
        battery_level: 90,
        reported_time: new Date(),
        logged_time: null,
      } as ObservedNode['latest_device_metrics'],
      battery_alert_active: true,
    });
    expect(isLowBatteryTableRowVisible(n, baseFilters)).toBe(true);
  });
});

describe('hasMeshInfraMapBatteryOrPresenceAlert', () => {
  it('returns false for stale-but-ok percentage', () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const n = node({
      meshtastic_node_id: 1,
      last_heard: new Date(),
      latest_device_metrics: {
        battery_level: 88,
        reported_time: old,
        logged_time: null,
      } as ObservedNode['latest_device_metrics'],
    });
    expect(hasMeshInfraMapBatteryOrPresenceAlert(n)).toBe(false);
  });

  it('returns true for low percent with stale reading', () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const n = node({
      meshtastic_node_id: 2,
      last_heard: new Date(),
      latest_device_metrics: {
        battery_level: 12,
        reported_time: old,
        logged_time: null,
      } as ObservedNode['latest_device_metrics'],
    });
    expect(hasMeshInfraMapBatteryOrPresenceAlert(n)).toBe(true);
  });
});
