import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import type { ObservedNode } from '@/lib/models';
import { useNodeDetailPageTabs } from '@/pages/nodes/useNodeDetailPageTabs';
import { NodeDetailContent } from './NodeDetailContent';

vi.mock('@/components/nodes/NodesMap', () => ({
  NodesMap: () => <div data-testid="nodes-map" />,
}));

vi.mock('@/components/nodes/RfPropagationSection', () => ({
  RfPropagationSection: () => <div data-testid="rf-propagation" />,
}));

vi.mock('@/components/nodes/NodeStatsSection', () => ({
  NodeStatsSection: () => <div data-testid="node-stats-mock">Node Statistics</div>,
}));

vi.mock('@/components/nodes/NodeMeshMonitoringSection', () => ({
  NodeMeshMonitoringSection: () => <div data-testid="mesh-monitoring-mock">Mesh monitoring</div>,
}));

vi.mock('@/components/nodes/NodeTracerouteHistorySection', () => ({
  NodeTracerouteHistorySection: () => <div data-testid="traceroute-history-mock">Traceroutes to this node</div>,
}));

vi.mock('@/hooks/api/useNodeTracerouteLinks', () => ({
  useNodeTracerouteLinks: () => ({
    data: { edges: [], nodes: [], snr_history: [] },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/api/useNodes', () => ({
  useNodeSuspense: vi.fn(),
  useManagedNodesSuspense: vi.fn(),
}));

vi.mock('@/hooks/useRecentNodes', () => ({
  useRecentNodes: () => ({ recentNodes: [], addRecentNode: vi.fn() }),
}));

vi.mock('@/lib/auth/authService', () => ({
  authService: {
    getCurrentUser: () => ({ id: 1, username: 'tester' }),
  },
}));

import { useNodeSuspense, useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { TEST_OBSERVED_INTERNAL_ID } from '@/test/test-node-ids';

const mockedUseNodeSuspense = vi.mocked(useNodeSuspense);
const mockedUseManagedNodesSuspense = vi.mocked(useManagedNodesSuspense);

const minimalNode: ObservedNode = {
  internal_id: '00000000-0000-4000-8000-000000000001',
  meshtastic_node_id: 100,
  node_id_str: '!00000064',
  mac_addr: null,
  long_name: 'Long Name',
  short_name: 'SN',
  meshtastic_hw_model: 'TBEAM',
  meshtastic_public_key: null,
  meshtastic_role: null,
  claim: null,
  owner: null,
  last_heard: null,
  latest_position: null,
  latest_device_metrics: null,
  latest_environment_metrics: null,
  latest_power_metrics: null,
  environment_settings_editable: false,
  environment_exposure: undefined,
  weather_use: undefined,
};

function NodeDetailTabbedPage() {
  const { id } = useParams<{ id: string }>();
  const internalId = id ?? TEST_OBSERVED_INTERNAL_ID;
  const { activeTab, onTabChange } = useNodeDetailPageTabs();
  return (
    <Suspense fallback={null}>
      <NodeDetailContent internalId={internalId} activeTab={activeTab} onTabChange={onTabChange} />
    </Suspense>
  );
}

function PageWithSearchEcho() {
  const { search } = useLocation();
  return (
    <>
      <span data-testid="url-search">{search}</span>
      <NodeDetailTabbedPage />
    </>
  );
}

describe('NodeDetailContent tabbed layout', () => {
  beforeEach(() => {
    mockedUseNodeSuspense.mockReturnValue(minimalNode);
    mockedUseManagedNodesSuspense.mockReturnValue({
      managedNodes: [],
      totalManagedNodes: 0,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
    });
  });

  it('shows statistics panel when URL has tab=statistics', () => {
    render(
      <MemoryRouter initialEntries={[`/nodes/${TEST_OBSERVED_INTERNAL_ID}?tab=statistics`]}>
        <Routes>
          <Route path="/nodes/:id" element={<PageWithSearchEcho />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('node-detail-panel-statistics')).toBeInTheDocument();
    expect(screen.getByTestId('node-stats-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('node-detail-panel-overview')).not.toBeInTheDocument();
  });

  it('switching tab updates the URL', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/nodes/${TEST_OBSERVED_INTERNAL_ID}`]}>
        <Routes>
          <Route path="/nodes/:id" element={<PageWithSearchEcho />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('node-detail-panel-overview')).toBeInTheDocument();
    expect(screen.getByTestId('url-search')).toHaveTextContent('');

    await user.click(screen.getByTestId('node-detail-tab-statistics'));
    expect(screen.getByTestId('url-search')).toHaveTextContent('?tab=statistics');
    expect(screen.getByTestId('node-stats-mock')).toBeInTheDocument();

    await user.click(screen.getByTestId('node-detail-tab-overview'));
    expect(screen.getByTestId('url-search')).toHaveTextContent('');
  });

  it('shows MeshCore traceroutes placeholder instead of Meshtastic history', () => {
    mockedUseNodeSuspense.mockReturnValue({
      ...minimalNode,
      protocol: 2,
      meshtastic_node_id: 0,
      node_id_str: 'mc:abc',
    });
    render(
      <MemoryRouter initialEntries={[`/nodes/${TEST_OBSERVED_INTERNAL_ID}?tab=traceroutes`]}>
        <Routes>
          <Route path="/nodes/:id" element={<PageWithSearchEcho />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('meshcore-traceroutes-unsupported')).toBeInTheDocument();
    expect(screen.queryByTestId('traceroute-history-mock')).not.toBeInTheDocument();
  });
});
