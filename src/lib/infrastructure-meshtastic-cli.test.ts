import { describe, expect, it } from 'vitest';
import type { InfrastructureExportRow } from './infrastructure-export-rows';
import { buildSetFavoriteNodeCommands, countSetFavoriteNodeCommands } from './infrastructure-meshtastic-cli';

function row(overrides: Partial<InfrastructureExportRow> = {}): InfrastructureExportRow {
  return {
    internal_id: '00000000-0000-4000-8000-000000000001',
    node_id_str: '!a1b2c3d4',
    short_name: 'R1',
    long_name: 'Router One',
    role_label: 'ROUTER',
    hw_model: '',
    last_heard_iso: '',
    latitude: '',
    longitude: '',
    altitude: '',
    battery_percent: '',
    channel_util_percent: '',
    owner_username: '',
    is_managed_feeder: false,
    constellation_name: '',
    is_licensed: null,
    has_rf_profile: false,
    has_ready_rf_render: false,
    ...overrides,
  };
}

describe('buildSetFavoriteNodeCommands', () => {
  it('emits local favorite commands with quoted node ids', () => {
    const text = buildSetFavoriteNodeCommands([row()], { includeHeader: false });
    expect(text).toBe("meshtastic --set-favorite-node '!a1b2c3d4'");
  });

  it('includes connection prefix when provided', () => {
    const text = buildSetFavoriteNodeCommands([row()], {
      connectionArgs: '-b MyRadio',
      includeHeader: false,
    });
    expect(text).toBe("meshtastic -b MyRadio --set-favorite-node '!a1b2c3d4'");
  });

  it('includes --dest for remote admin', () => {
    const text = buildSetFavoriteNodeCommands([row({ node_id_str: '!0c3a3de4' })], {
      connectionArgs: '-b MyRadio',
      destNodeId: '!a5592387',
      includeHeader: false,
    });
    expect(text).toBe(
      "meshtastic -b MyRadio --dest '!a5592387' --set-favorite-node '!0c3a3de4'"
    );
  });

  it('skips rows with invalid node ids', () => {
    const text = buildSetFavoriteNodeCommands(
      [row({ node_id_str: 'bad' }), row({ node_id_str: '!12345678' })],
      { includeHeader: false }
    );
    expect(text).toBe("meshtastic --set-favorite-node '!12345678'");
    expect(countSetFavoriteNodeCommands([row({ node_id_str: 'bad' }), row()])).toBe(1);
  });

  it('returns empty when dest is invalid', () => {
    expect(buildSetFavoriteNodeCommands([row()], { destNodeId: 'not-an-id' })).toBe('');
  });

  it('includes comment header by default', () => {
    const text = buildSetFavoriteNodeCommands([row(), row({ node_id_str: '!bbbbbbbb' })]);
    expect(text).toMatch(/^# Meshflow infrastructure export — 2 favorite commands/);
    expect(text).toContain("meshtastic --set-favorite-node '!a1b2c3d4'");
  });
});
