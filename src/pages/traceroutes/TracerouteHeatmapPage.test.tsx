import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TracerouteHeatmapPage } from './TracerouteHeatmapPage';

vi.mock('@/hooks/api/useHeatmapEdges', () => ({
  useHeatmapEdges: vi.fn(),
}));

vi.mock('@/hooks/api/useNodes', () => ({
  useManagedNodesSuspense: vi.fn(),
}));

vi.mock('@/components/traceroutes/TracerouteHeatmapMap', () => ({
  TracerouteHeatmapMap: () => <div data-testid="heatmap-map-stub" />,
}));

import { useHeatmapEdges } from '@/hooks/api/useHeatmapEdges';
import { useManagedNodesSuspense } from '@/hooks/api/useNodes';

const mockUseHeatmap = vi.mocked(useHeatmapEdges);
const mockUseManaged = vi.mocked(useManagedNodesSuspense);

describe('TracerouteHeatmapPage URL → API', () => {
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
        edges: [],
        nodes: [],
        meta: { active_nodes_count: 0, total_trace_routes_count: 0 },
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useHeatmapEdges>);
  });

  function renderPage(path: string) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <TracerouteHeatmapPage edgeMetric="packets" />
      </MemoryRouter>
    );
  }

  it('passes strategy CSV and source mesh id from search params to useHeatmapEdges', () => {
    renderPage('/traceroutes/map/heat?strategy=dx_across,intra_zone&source=99');
    expect(mockUseHeatmap).toHaveBeenCalledWith(
      expect.objectContaining({
        targetStrategy: 'dx_across,intra_zone',
        sourceNodeId: 99,
      })
    );
  });

  it('renders source selector for URL round-trip', () => {
    renderPage('/traceroutes/map/heat?source=99');
    expect(screen.getByTestId('heatmap-source-select')).toBeInTheDocument();
  });
});
