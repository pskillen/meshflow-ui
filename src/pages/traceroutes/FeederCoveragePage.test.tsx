import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ManagedNode } from '@/lib/models';

vi.mock('@/hooks/api/useNodes', () => ({
  useNodes: vi.fn(),
}));

vi.mock('@/hooks/api/useFeederReach', () => ({
  useFeederReach: vi.fn(),
}));

vi.mock('@/hooks/api/useObservedNodesHeard', () => ({
  useObservedNodesHeard: vi.fn(() => ({ nodes: [], isLoading: false, isFetching: false })),
}));

vi.mock('@/components/traceroutes/FeederCoverageMap', () => ({
  FeederCoverageMap: ({
    feeder,
    targets,
    heardGhosts,
    enabledLayers,
    minAttempts,
  }: {
    feeder: { meshtastic_node_id: number };
    targets: { meshtastic_node_id: number }[];
    heardGhosts: unknown[];
    enabledLayers: string[];
    minAttempts: number;
  }) => (
    <div
      data-testid="feeder-coverage-map-mock"
      data-feeder={feeder.meshtastic_node_id}
      data-target-count={targets.length}
      data-heard-ghost-count={heardGhosts.length}
      data-enabled-layers={enabledLayers.join(',')}
      data-min-attempts={minAttempts}
    />
  ),
}));

import { useNodes } from '@/hooks/api/useNodes';
import { useFeederReach } from '@/hooks/api/useFeederReach';
import { FeederCoveragePage } from './FeederCoveragePage';

const mockedUseNodes = vi.mocked(useNodes);
const mockedUseFeederReach = vi.mocked(useFeederReach);

function makeManagedNode(overrides: Partial<ManagedNode> = {}): ManagedNode {
  return {
    meshtastic_node_id: 200,
    long_name: 'Source node',
    short_name: 'SRC',
    last_heard: null,
    node_id_str: '!000000c8',
    owner: { id: 1, username: 'me' },
    constellation: { id: 1, name: 'C1' },
    allow_auto_traceroute: true,
    position: { latitude: null, longitude: null },
    ...overrides,
  };
}

function setupHooks({
  managedNodes = [makeManagedNode()],
  data,
  isLoading = false,
  error = null,
}: {
  managedNodes?: ManagedNode[];
  data?: ReturnType<typeof useFeederReach>['data'];
  isLoading?: boolean;
  error?: Error | null;
} = {}) {
  mockedUseNodes.mockReturnValue({
    managedNodes,
    isLoadingManagedNodes: false,
  } as unknown as ReturnType<typeof useNodes>);

  mockedUseFeederReach.mockReturnValue({
    data,
    isLoading,
    error,
  } as unknown as ReturnType<typeof useFeederReach>);
}

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <FeederCoveragePage />
    </MemoryRouter>
  );
}

describe('FeederCoveragePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates the selected feeder from the ?feeder= URL parameter', () => {
    setupHooks({
      managedNodes: [
        makeManagedNode({ meshtastic_node_id: 100, short_name: 'AAA' }),
        makeManagedNode({ meshtastic_node_id: 200, short_name: 'BBB' }),
      ],
      data: {
        feeder: {
          meshtastic_node_id: 200,
          node_id_str: '!000000c8',
          short_name: 'BBB',
          long_name: 'Source node',
          lat: 55.86,
          lng: -4.25,
        },
        window: { triggered_at_after: null, triggered_at_before: null },
        targets: [],
      } as unknown as ReturnType<typeof useFeederReach>['data'],
    });

    renderAt('/traceroutes/map/coverage?feeder=200');

    const lastCallArgs = mockedUseFeederReach.mock.calls.at(-1)?.[0];
    expect(lastCallArgs?.feederId).toBe(200);
  });

  it('renders the feeder coverage map only when data is available', () => {
    setupHooks({ data: undefined, isLoading: true });
    const { unmount } = renderAt('/traceroutes/map/coverage?feeder=200');
    expect(screen.queryByTestId('feeder-coverage-map-mock')).not.toBeInTheDocument();
    expect(screen.getByText(/loading coverage/i)).toBeInTheDocument();
    unmount();
  });

  it('passes filtered targets and enabled layers to the map', () => {
    setupHooks({
      data: {
        feeder: {
          meshtastic_node_id: 200,
          node_id_str: '!000000c8',
          short_name: 'SRC',
          long_name: 'Source',
          lat: 55.86,
          lng: -4.25,
        },
        window: { triggered_at_after: null, triggered_at_before: null },
        targets: [
          {
            meshtastic_node_id: 1,
            node_id_str: '!00000001',
            short_name: 'A',
            long_name: null,
            lat: 55.87,
            lng: -4.26,
            attempts: 5,
            successes: 4,
          },
          {
            meshtastic_node_id: 2,
            node_id_str: '!00000002',
            short_name: 'B',
            long_name: null,
            lat: 55.88,
            lng: -4.27,
            attempts: 1,
            successes: 1,
          },
        ],
      } as unknown as ReturnType<typeof useFeederReach>['data'],
    });

    renderAt('/traceroutes/map/coverage?feeder=200');

    const mapEl = screen.getByTestId('feeder-coverage-map-mock');
    // Default minAttempts = 3, so the second target (1 attempt) should be filtered out.
    expect(mapEl.dataset.targetCount).toBe('1');
    expect(mapEl.dataset.enabledLayers).toBe('dots');
    expect(mapEl.dataset.minAttempts).toBe('3');
  });

  it('toggles layer pills and re-renders the map with the new layer set', () => {
    setupHooks({
      data: {
        feeder: {
          meshtastic_node_id: 200,
          node_id_str: '!000000c8',
          short_name: 'SRC',
          long_name: 'Source',
          lat: 55.86,
          lng: -4.25,
        },
        window: { triggered_at_after: null, triggered_at_before: null },
        targets: [],
      } as unknown as ReturnType<typeof useFeederReach>['data'],
    });

    renderAt('/traceroutes/map/coverage?feeder=200');

    fireEvent.click(screen.getByRole('button', { name: /toggle hex layer/i }));
    fireEvent.click(screen.getByRole('button', { name: /toggle polygon layer/i }));

    const mapEl = screen.getByTestId('feeder-coverage-map-mock');
    expect(mapEl.dataset.enabledLayers?.split(',').sort()).toEqual(['dots', 'hex', 'polygon']);
  });
});
