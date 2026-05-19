import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ObservedNode } from '@/lib/models';
import { NodesMap } from './NodesMap';
import { watchMonitoringStatusLegendSwatches } from '@/lib/watch-monitoring-status';

vi.mock('@/hooks/useMapTileUrl', () => ({
  useMapTileUrl: () => ({
    url: 'https://tile.example/{z}/{x}/{y}.png',
    attribution: 'OSM',
  }),
}));

const { mapMocks, createBounds } = vi.hoisted(() => {
  const mapInstance = {
    setView: vi.fn(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
    removeLayer: vi.fn(),
    addLayer: vi.fn(),
  };
  mapInstance.setView.mockImplementation(() => mapInstance);
  mapInstance.fitBounds.mockImplementation(() => mapInstance);
  const { setView, fitBounds } = mapInstance;
  const createBounds = () => {
    let n = 0;
    return {
      extend: vi.fn(() => {
        n++;
      }),
      isValid: vi.fn(() => n > 0),
    };
  };
  return { mapMocks: { setView, fitBounds, mapInstance }, createBounds };
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
    })),
    latLngBounds: vi.fn(() => createBounds()),
  },
}));

function nodeWithPosition(
  id: number,
  lat: number,
  lng: number,
  overrides: Partial<ObservedNode> = {}
): ObservedNode {
  return {
    internal_id: id,
    meshtastic_node_id: id,
    node_id_str: `!${id.toString(16).padStart(8, '0')}`,
    mac_addr: null,
    long_name: 'A',
    short_name: 'A',
    hw_model: null,
    public_key: null,
    role: 2,
    last_heard: null,
    latest_position: {
      latitude: lat,
      longitude: lng,
      altitude: 0,
      logged_time: null,
      reported_time: null,
    },
    ...overrides,
  } as ObservedNode;
}

describe('NodesMap', () => {
  beforeEach(() => {
    mapMocks.setView.mockClear();
    mapMocks.fitBounds.mockClear();
  });

  it('uses fixed zoom for a single node with position instead of maxZoom fitBounds', async () => {
    render(<NodesMap nodes={[nodeWithPosition(1, 55.1, -4.2)]} />);
    await waitFor(() => {
      expect(mapMocks.fitBounds).not.toHaveBeenCalled();
      expect(mapMocks.setView).toHaveBeenLastCalledWith([55.1, -4.2], 12);
    });
  });

  it('uses fitBounds when multiple nodes have positions', async () => {
    render(
      <NodesMap
        nodes={[
          nodeWithPosition(1, 55.1, -4.2),
          nodeWithPosition(2, 55.2, -4.3, { short_name: 'B', node_id_str: '!b' }),
        ]}
      />
    );
    await waitFor(() => expect(mapMocks.fitBounds).toHaveBeenCalled());
  });

  it('shows watch status legend instead of node role when status colours are provided', () => {
    render(
      <NodesMap
        nodes={[nodeWithPosition(1, 55.1, -4.2)]}
        markerColorsByNodeId={new Map([[1, '#dc2626']])}
        mapLegendStatusSwatches={watchMonitoringStatusLegendSwatches()}
        mapLegendStatusTitle="Watch status"
      />
    );
    const legend = screen.getByRole('region', { name: /Map marker colours/i });
    expect(legend).toHaveTextContent('Watch status');
    expect(legend).toHaveTextContent('Offline');
    expect(screen.queryByText('Node role')).not.toBeInTheDocument();
  });
});
