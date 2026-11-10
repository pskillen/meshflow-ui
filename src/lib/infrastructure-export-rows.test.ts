import { describe, expect, it } from 'vitest';
import type { ObservedNode } from '@/lib/models';
import { buildInfrastructureExportRow } from './infrastructure-export-rows';

function nodeWithBattery(battery_level: number | null | undefined): ObservedNode {
  return {
    internal_id: 'x',
    meshtastic_node_id: 1,
    node_id_str: '!00000001',
    last_heard: new Date('2026-01-01T00:00:00Z'),
    latest_position: null,
    latest_device_metrics:
      battery_level === undefined
        ? null
        : ({ battery_level, reported_time: new Date(), logged_time: null } as ObservedNode['latest_device_metrics']),
  } as ObservedNode;
}

describe('buildInfrastructureExportRow battery_percent', () => {
  it.each([
    ['a level', 87, '87'],
    ['zero', 0, '0'],
    ['powered (101)', 101, 'Powered'],
    ['null', null, ''],
    ['no metrics', undefined, ''],
  ])('%s', (_label, raw, expected) => {
    expect(buildInfrastructureExportRow(nodeWithBattery(raw), null).battery_percent).toBe(expected);
  });
});
