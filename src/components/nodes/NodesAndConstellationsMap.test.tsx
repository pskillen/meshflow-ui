import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    divIcon: vi.fn(() => ({})),
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
      expect(screen.getByRole('region', { name: /Map marker colours/i })).toBeInTheDocument();
    });
    const legend = screen.getByRole('region', { name: /Map marker colours/i });
    expect(legend).toHaveTextContent('Test Constellation');
    expect(screen.queryByText('Other mesh nodes (by role)')).not.toBeInTheDocument();
  });
});
