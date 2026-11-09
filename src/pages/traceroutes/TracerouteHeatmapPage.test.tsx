import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('defaults to the 7d preset as a fixed 168h window', () => {
    renderPage('/traceroutes/map/heat');
    const arg = mockUseHeatmap.mock.calls.at(-1)?.[0];
    expect(screen.getByRole('radio', { name: '7d' })).toHaveAttribute('aria-checked', 'true');
    expect(arg?.triggeredAtAfter).toBeInstanceOf(Date);
    expect(arg!.triggeredAtAfter!.getTime() % 3600000).toBe(0);
  });

  it('offers 90d and sends a window of at least 90 x 24h, starting on a UTC day boundary', () => {
    renderPage('/traceroutes/map/heat?range=90d');
    expect(screen.getByRole('radio', { name: '90d' })).toHaveAttribute('aria-checked', 'true');
    const after = mockUseHeatmap.mock.calls.at(-1)![0]!.triggeredAtAfter!;
    const hours = (Date.now() - after.getTime()) / 3600000;
    expect(hours).toBeGreaterThanOrEqual(2160);
    // start is floored to the UTC day (90d uses daily buckets): up to 24h longer, plus the hour in progress
    expect(hours).toBeLessThan(2185);
    expect(after.getTime() % 86400000).toBe(0);
  });

  it('custom since date overrides the preset and clears the selection; a preset click drops it', () => {
    renderPage('/traceroutes/map/heat?since=2026-01-05');
    const arg = mockUseHeatmap.mock.calls.at(-1)![0]!;
    expect(arg.triggeredAtAfter).toEqual(new Date(2026, 0, 5));
    expect(screen.getByTestId('map-since-button')).toHaveTextContent('Since 5 Jan 2026');
    for (const r of screen.getAllByRole('radio')) expect(r).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('radio', { name: '30d' }));
    expect(screen.getByTestId('map-since-button')).toHaveTextContent('Custom');
    expect(screen.getByRole('radio', { name: '30d' })).toHaveAttribute('aria-checked', 'true');
  });
});
