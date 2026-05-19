import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TracerouteTopologyPage } from './TracerouteTopologyPage';

vi.mock('@/hooks/api/useHeatmapEdges', () => ({
  useHeatmapEdges: vi.fn(),
}));

vi.mock('@/hooks/api/useNodes', () => ({
  useManagedNodesSuspense: vi.fn(),
}));

vi.mock('@/components/traceroutes/TracerouteTopologyGraph', () => ({
  TracerouteTopologyGraph: () => <div data-testid="topology-graph-stub" />,
}));

import { useHeatmapEdges } from '@/hooks/api/useHeatmapEdges';
import { useManagedNodesSuspense } from '@/hooks/api/useNodes';

const mockUseHeatmap = vi.mocked(useHeatmapEdges);
const mockUseManaged = vi.mocked(useManagedNodesSuspense);

const sampleNode = {
  meshtastic_node_id: 0x11a,
  node_id_str: '!0000011a',
  short_name: 'A',
  long_name: 'Node A',
  lat: 55.9,
  lng: -4.2,
  degree: 2,
  centrality: 0.5,
  role: 'relay' as const,
  last_seen: '2026-01-10T12:00:00.000Z',
};

describe('TracerouteTopologyPage URL → API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseManaged.mockReturnValue({
      managedNodes: [
        {
          meshtastic_node_id: 99,
          short_name: 'Feed',
          node_id_str: '!00000063',
          long_name: null,
          last_heard: null,
          owner: { id: 1, username: 'x' },
          constellation: { id: 1 },
          position: { latitude: null, longitude: null },
        },
      ],
      totalManagedNodes: 1,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
    } as unknown as ReturnType<typeof useManagedNodesSuspense>);
    mockUseHeatmap.mockReturnValue({
      data: {
        edges: [{ from_node_id: 1, to_node_id: 2, from_lat: 0, from_lng: 0, to_lat: 1, to_lng: 1, weight: 1 }],
        nodes: [sampleNode],
        meta: { active_nodes_count: 1, total_trace_routes_count: 1 },
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useHeatmapEdges>);
  });

  function renderPage(path: string) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <TracerouteTopologyPage edgeMetric="packets" />
      </MemoryRouter>
    );
  }

  it('passes strategy CSV and source mesh id from search params to useHeatmapEdges', () => {
    renderPage('/traceroutes/map/topology/heat?strategy=dx_across,intra_zone&source=99');
    expect(mockUseHeatmap).toHaveBeenCalledWith(
      expect.objectContaining({
        targetStrategy: 'dx_across,intra_zone',
        sourceNodeId: 99,
      })
    );
  });

  it('shows node panel when selected query matches a loaded node', () => {
    renderPage(`/traceroutes/map/topology/heat?selected=${sampleNode.meshtastic_node_id}`);
    expect(screen.getByTestId('topology-node-panel')).toBeInTheDocument();
    expect(screen.getByText('Open details')).toBeInTheDocument();
  });

  it('renders backbone and relay table below the graph', () => {
    renderPage('/traceroutes/map/topology/heat');
    expect(screen.getByTestId('heatmap-backbone-relay-table')).toBeInTheDocument();
    expect(screen.getByText(/Normalised betweenness/)).toBeInTheDocument();
  });
});
