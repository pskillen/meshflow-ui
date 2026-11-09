import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/hooks/api/useConstellations', () => ({
  useConstellations: vi.fn(),
}));

vi.mock('@/hooks/api/useConstellationCoverage', () => ({
  useConstellationCoverage: vi.fn(),
}));

vi.mock('@/hooks/api/useNodes', () => ({
  useNodes: vi.fn(() => ({ managedNodes: [], isLoadingManagedNodes: false })),
}));

vi.mock('@/hooks/api/useObservedNodesHeard', () => ({
  useObservedNodesHeard: vi.fn(() => ({ nodes: [], isLoading: false, isFetching: false })),
}));

vi.mock('@/components/traceroutes/ConstellationCoverageMap', () => ({
  ConstellationCoverageMap: ({
    hexes,
    heardGhosts,
    minAttempts,
  }: {
    hexes: { cell: string }[];
    heardGhosts: unknown[];
    minAttempts: number;
  }) => (
    <div
      data-testid="constellation-coverage-map-mock"
      data-hex-count={hexes.length}
      data-heard-ghost-count={heardGhosts.length}
      data-min-attempts={minAttempts}
    />
  ),
}));

import { useConstellations } from '@/hooks/api/useConstellations';
import { useConstellationCoverage } from '@/hooks/api/useConstellationCoverage';
import { ConstellationCoveragePage } from './ConstellationCoveragePage';

const mockedUseConstellations = vi.mocked(useConstellations);
const mockedUseCoverage = vi.mocked(useConstellationCoverage);

function setupHooks({
  constellations = [{ id: 1, name: 'C1' }],
  data,
  isLoading = false,
  error = null,
}: {
  constellations?: { id: number; name: string }[];
  data?: ReturnType<typeof useConstellationCoverage>['data'];
  isLoading?: boolean;
  error?: Error | null;
} = {}) {
  mockedUseConstellations.mockReturnValue({
    constellations,
    isLoading: false,
  } as unknown as ReturnType<typeof useConstellations>);

  mockedUseCoverage.mockReturnValue({
    data,
    isLoading,
    error,
  } as unknown as ReturnType<typeof useConstellationCoverage>);
}

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/traceroutes/map/coverage/constellation/:constellationId"
          element={<ConstellationCoveragePage />}
        />
        <Route
          path="/traceroutes/map/coverage/constellation"
          element={<ConstellationCoveragePage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ConstellationCoveragePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the constellation id from the URL to the coverage hook', () => {
    setupHooks({
      data: {
        constellation_id: 1,
        h3_resolution: 6,
        window: { triggered_at_after: null, triggered_at_before: null },
        hexes: [],
      } as unknown as ReturnType<typeof useConstellationCoverage>['data'],
    });
    renderAt('/traceroutes/map/coverage/constellation/1');
    const lastArgs = mockedUseCoverage.mock.calls.at(-1)?.[0];
    expect(lastArgs?.constellationId).toBe(1);
    expect(lastArgs?.h3Resolution).toBe(6);
  });

  it('filters hexes by minAttempts before passing to the map', () => {
    setupHooks({
      data: {
        constellation_id: 1,
        h3_resolution: 6,
        window: { triggered_at_after: null, triggered_at_before: null },
        hexes: [
          {
            cell: '8616a4a17ffffff',
            attempts: 5,
            successes: 4,
            contributing_feeders: 1,
            contributing_targets: 2,
          },
          {
            cell: '8616a4a1bffffff',
            attempts: 1,
            successes: 1,
            contributing_feeders: 1,
            contributing_targets: 1,
          },
        ],
      } as unknown as ReturnType<typeof useConstellationCoverage>['data'],
    });

    renderAt('/traceroutes/map/coverage/constellation/1');

    const mapEl = screen.getByTestId('constellation-coverage-map-mock');
    // default minAttempts = 3
    expect(mapEl.dataset.hexCount).toBe('1');
    expect(mapEl.dataset.minAttempts).toBe('3');
  });

  it('shows the loading state when the coverage query is still loading', () => {
    setupHooks({ isLoading: true });
    renderAt('/traceroutes/map/coverage/constellation/1');
    expect(screen.getByText(/loading coverage/i)).toBeInTheDocument();
    expect(screen.queryByTestId('constellation-coverage-map-mock')).not.toBeInTheDocument();
  });

  it('uses the shared range bar (default 7d, 90d offered) and a fixed window start', () => {
    setupHooks({ data: { hexes: [] } as unknown as ReturnType<typeof useConstellationCoverage>['data'] });
    renderAt('/traceroutes/map/coverage/constellation/1?range=90d');
    expect(screen.getByRole('radio', { name: '90d' })).toHaveAttribute('aria-checked', 'true');
    const after = mockedUseCoverage.mock.calls.at(-1)![0].triggeredAtAfter!;
    expect(after.getTime() % 3600000).toBe(0);
    expect((Date.now() - after.getTime()) / 3600000).toBeGreaterThanOrEqual(2160);
  });

  it('puts the description behind the info button', () => {
    setupHooks({ data: { hexes: [] } as unknown as ReturnType<typeof useConstellationCoverage>['data'] });
    renderAt('/traceroutes/map/coverage/constellation/1');
    expect(screen.queryByText(/Combines traceroute attempts/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'About this map' }));
    expect(screen.getByText(/Combines traceroute attempts/)).toBeInTheDocument();
  });
});
