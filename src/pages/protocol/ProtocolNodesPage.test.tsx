import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import L from 'leaflet';
import type { ManagedNode } from '@/lib/models';
import { MESHTASTIC_CONFIG } from '@/lib/mesh-protocol';
import { ProtocolNodesPage } from './ProtocolNodesPage';

vi.mock('@/hooks/useMapTileUrl', () => ({
  useMapTileUrl: () => ({ url: 'https://tile.example/{z}/{x}/{y}.png', attribution: 'OSM' }),
}));

const { managedNodesMock } = vi.hoisted(() => ({ managedNodesMock: { current: [] as unknown[] } }));

vi.mock('@/hooks/api/useNodes', () => ({
  useManagedNodesSuspense: () => ({ managedNodes: managedNodesMock.current }),
}));
vi.mock('@/hooks/api/useMeshCore', () => ({
  useMeshCoreManagedNodesSuspense: () => ({ feeders: [] }),
}));
vi.mock('@/hooks/api/useProtocolNodes', () => ({
  useProtocolObservedNodesSuspense: () => ({
    nodes: [],
    totalNodes: 0,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
  }),
}));

vi.mock('leaflet', () => {
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
  return {
    default: {
      map: vi.fn(() => mapInstance),
      tileLayer: vi.fn(() => ({ addTo: vi.fn().mockReturnThis() })),
      divIcon: vi.fn((opts: unknown) => opts),
      marker: vi.fn(() => ({
        bindPopup: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(),
        on: vi.fn().mockReturnThis(),
      })),
      latLngBounds: vi.fn(() => ({ extend: vi.fn(), isValid: vi.fn(() => false) })),
      polygon: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), remove: vi.fn() })),
    },
  };
});

function feeder(
  id: number,
  nodeIdStr: string,
  constellation: { id: number; name: string; map_color: string },
  extra: Partial<ManagedNode> = {}
): ManagedNode {
  return {
    meshtastic_node_id: id,
    node_id_str: nodeIdStr,
    long_name: `Feeder ${id}`,
    short_name: `F${id}`,
    last_heard: new Date(),
    last_packet_ingested_at: new Date(),
    owner: { id: 1, username: 'u' },
    constellation,
    position: { latitude: 55 + id / 100, longitude: -4 },
    ...extra,
  };
}

/** Pin fill colours, read from the html passed to `L.divIcon`. */
function pinColours(): string[] {
  return vi
    .mocked(L.divIcon)
    .mock.calls.map((c) => String((c[0] as { html: string }).html.match(/background: ([^;]+);/)?.[1]));
}

describe('ProtocolNodesPage (Meshtastic) constellation key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps Meshtastic and unset-protocol feeders, drops MeshCore ones, and the key matches the pins', async () => {
    const mesh = { id: 1, name: 'Mesh Constellation', map_color: '#ff0000' };
    const unset = { id: 2, name: 'Unset Protocol Constellation', map_color: '#00ff00' };
    const core = { id: 3, name: 'MeshCore By Protocol', map_color: '#0000ff' };
    const coreMc = { id: 4, name: 'MeshCore By Id', map_color: '#ffff00' };
    managedNodesMock.current = [
      feeder(1, '!00000001', mesh, { protocol: 1 }),
      feeder(2, '!00000002', unset), // protocol missing
      feeder(3, '!00000003', core, { protocol: 2 }),
      // MeshCore feeder with protocol missing and an mc: id: the case behind ticket #415
      feeder(4, 'mc:abcdef', coreMc),
    ];

    render(
      <MemoryRouter>
        <ProtocolNodesPage config={MESHTASTIC_CONFIG} />
      </MemoryRouter>
    );

    const legend = await screen.findByRole('region', { name: /Map key/i });
    expect(legend).toHaveTextContent('Mesh Constellation');
    expect(legend).toHaveTextContent('Unset Protocol Constellation');
    expect(legend).not.toHaveTextContent('MeshCore By Protocol');
    expect(legend).not.toHaveTextContent('MeshCore By Id');

    // Two pins drawn, in the colours the key shows.
    expect(vi.mocked(L.marker)).toHaveBeenCalledTimes(2);
    expect(pinColours().sort()).toEqual(['#00ff00', '#ff0000']);
  });
});
