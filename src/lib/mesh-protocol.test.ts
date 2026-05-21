import { describe, it, expect } from 'vitest';
import { MESHTASTIC_CONFIG, MESHCORE_CONFIG } from './mesh-protocol';

describe('mesh-protocol config', () => {
  it('meshtastic routes use legacy paths', () => {
    expect(MESHTASTIC_CONFIG.routes.map).toBe('/map');
    expect(MESHTASTIC_CONFIG.routes.nodes).toBe('/nodes');
    expect(MESHTASTIC_CONFIG.routes.managedNodes).toBe('/nodes/managed-nodes');
  });

  it('meshcore routes use meshcore prefix', () => {
    expect(MESHCORE_CONFIG.routes.map).toBeUndefined();
    expect(MESHCORE_CONFIG.routes.messages).toBe('/meshcore/messages');
    expect(MESHCORE_CONFIG.routes.managedNodes).toBe('/meshcore/managed-nodes');
  });

  it('meshtastic messages route', () => {
    expect(MESHTASTIC_CONFIG.routes.messages).toBe('/messages');
  });

  it('meshcore uses meshcore role legend', () => {
    expect(MESHCORE_CONFIG.features.roleLegend).toBe('meshcore');
    expect(MESHTASTIC_CONFIG.features.roleLegend).toBe('meshtastic');
  });
});
