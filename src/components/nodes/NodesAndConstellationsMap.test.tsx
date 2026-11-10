import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import L from 'leaflet';
import type { ManagedNode } from '@/lib/models';
import { NodesAndConstellationsMap } from './NodesAndConstellationsMap';

vi.mock('@/hooks/useMapTileUrl', () => ({
  useMapTileUrl: () => ({
    url: 'https://tile.example/{z}/{x}/{y}.png',
    attribution: 'OSM',
  }),
}));

const { mapMocks } = vi.hoisted(() => {
  const mapInstance = {
    setView: vi.fn(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
    removeLayer: vi.fn(),
    addLayer: vi.fn(),
    on: vi.fn(),
  };
  mapInstance.setView.mockImplementation(() => mapInstance);
  mapInstance.fitBounds.mockImplementation(() => mapInstance);
  return { mapMocks: { mapInstance } };
});

vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => mapMocks.mapInstance),
    tileLayer: vi.fn(() => ({ addTo: vi.fn().mockReturnThis() })),
    divIcon: vi.fn((opts: unknown) => opts),
    marker: vi.fn(() => ({
      bindPopup: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      on: vi.fn().mockReturnThis(),
    })),
    latLngBounds: vi.fn(() => ({
      extend: vi.fn(),
      isValid: vi.fn(() => false),
    })),
    polygon: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), remove: vi.fn() })),
  },
}));

function managedWithConstellation(): ManagedNode {
  return {
    meshtastic_node_id: 1,
    node_id_str: '!00000001',
    long_name: 'A',
    short_name: 'A',
    last_heard: new Date(),
    owner: { id: 1, username: 'u' },
    constellation: { id: 10, name: 'Test Constellation', map_color: '#ff0000' },
    position: { latitude: 55.1, longitude: -4.2 },
  };
}

describe('NodesAndConstellationsMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('omits role legend when showRoleLegendSwatches is false but keeps constellation legend', async () => {
    render(
      <div style={{ height: 500 }}>
        <NodesAndConstellationsMap
          managedNodes={[managedWithConstellation()]}
          observedNodes={[]}
          showConstellation={true}
          showRoleLegendSwatches={false}
        />
      </div>
    );
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Map key/i })).toBeInTheDocument();
    });
    const legend = screen.getByRole('region', { name: /Map key/i });
    expect(legend).toHaveTextContent('Test Constellation');
    expect(screen.queryByText('Other mesh nodes (by role)')).not.toBeInTheDocument();
  });

  it('lists only constellations that have a pin on the map', async () => {
    const hidden: ManagedNode = {
      ...managedWithConstellation(),
      meshtastic_node_id: 2,
      node_id_str: '!00000002',
      constellation: { id: 11, name: 'Unpinned Constellation', map_color: '#00ff00' },
      position: { latitude: null, longitude: null },
    };
    render(
      <div style={{ height: 500 }}>
        <NodesAndConstellationsMap
          managedNodes={[managedWithConstellation(), hidden]}
          observedNodes={[]}
          showConstellation={true}
        />
      </div>
    );
    const legend = await screen.findByRole('region', { name: /Map marker colours/i });
    expect(legend).toHaveTextContent('Test Constellation');
    expect(legend).not.toHaveTextContent('Unpinned Constellation');

    // The key matches the pins: one pin (the positioned node), drawn in the key's colour for it.
    expect(vi.mocked(L.marker)).toHaveBeenCalledTimes(1);
    const pinHtml = vi.mocked(L.divIcon).mock.calls.map((c) => (c[0] as { html: string }).html);
    expect(pinHtml).toHaveLength(1);
    expect(pinHtml[0]).toContain('background: #ff0000;');
    expect(pinHtml[0]).not.toContain('#00ff00');
    const swatches = Array.from(legend.querySelectorAll<HTMLElement>('[style*="background"]')).map(
      (el) => el.style.backgroundColor
    );
    expect(swatches).toContain('rgb(255, 0, 0)');
    expect(swatches).not.toContain('rgb(0, 255, 0)');
  });
});
