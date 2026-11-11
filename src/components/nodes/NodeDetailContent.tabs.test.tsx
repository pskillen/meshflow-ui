import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import type { NodeIdentityRef, ObservedNode } from '@/lib/models';
import { useNodeDetailPageTabs } from '@/pages/nodes/useNodeDetailPageTabs';
import { NodeDetailContent } from './NodeDetailContent';

vi.mock('@/components/nodes/NodesMap', () => ({
  NodesMap: () => <div data-testid="nodes-map" />,
}));

vi.mock('@/components/nodes/RfPropagationSection', () => ({
  RfPropagationSection: () => <div data-testid="rf-propagation" />,
}));

vi.mock('@/components/nodes/NodeStatsSection', () => ({
  NodeStatsSection: ({ range }: { range: { key: string } }) => (
    <div data-testid="node-stats-mock" data-range={range.key}>
      Node Statistics
    </div>
  ),
}));

vi.mock('@/components/nodes/NodeMeshMonitoringSection', () => ({
  NodeMeshMonitoringSection: () => <div data-testid="mesh-monitoring-mock">Mesh monitoring</div>,
}));

vi.mock('@/components/nodes/NodeTracerouteLinksMap', () => ({
  NodeTracerouteLinksMap: () => <div data-testid="links-map" />,
}));

vi.mock('@/components/nodes/LinkSNRCharts', () => ({
  LinkSNRCharts: () => <div data-testid="link-snr-charts" />,
}));

// Has its own tests; it needs the API provider, which this layout test does not set up.
vi.mock('@/components/nodes/NodeIdentityLinksSection', () => ({
  NodeIdentityLinksSection: () => null,
}));

vi.mock('@/hooks/api/useTraceroutes', () => ({
  useTraceroutes: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

vi.mock('@/components/nodes/NodeTracerouteHistorySection', () => ({
  NODE_TRACEROUTE_HISTORY_PAGE_SIZE: 10,
  NodeTracerouteHistorySection: () => <div data-testid="traceroute-history-mock">Traceroutes to this node</div>,
}));

vi.mock('@/hooks/api/useNodeTracerouteLinks', () => ({
  useNodeTracerouteLinks: vi.fn(() => ({
    data: { edges: [], nodes: [], snr_history: [] },
    isLoading: false,
    error: null,
  })),
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
import { useNodeTracerouteLinks } from '@/hooks/api/useNodeTracerouteLinks';
import { useTraceroutes } from '@/hooks/api/useTraceroutes';
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

function UrlEcho() {
  const { search } = useLocation();
  return <span data-testid="url-echo">{search}</span>;
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

  it('renders the identity banner above the tab content when the node is replaced', () => {
    const target: NodeIdentityRef = { internal_id: 'n2', protocol: 1, meshtastic_node_id: 2, node_id_str: '!00000002' };
    mockedUseNodeSuspense.mockReturnValue({
      ...minimalNode,
      replaced_by: target,
      identity_chain: { previous: [], next: [] },
    });
    render(
      <MemoryRouter initialEntries={[`/nodes/${TEST_OBSERVED_INTERNAL_ID}`]}>
        <Routes>
          <Route path="/nodes/:id" element={<NodeDetailTabbedPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('node-identity-replaced')).toHaveTextContent('This radio now uses node !00000002');
  });

  it('explains that inferred max hops is a best guess', () => {
    mockedUseNodeSuspense.mockReturnValue({ ...minimalNode, meshtastic_inferred_max_hops: 5 });
    render(
      <MemoryRouter initialEntries={[`/nodes/${TEST_OBSERVED_INTERNAL_ID}`]}>
        <Routes>
          <Route path="/nodes/:id" element={<NodeDetailTabbedPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/A best guess from recent packets/)).toBeInTheDocument();
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

  it('has a back link named "Back to nodes" in the header', () => {
    render(
      <MemoryRouter initialEntries={[`/nodes/${TEST_OBSERVED_INTERNAL_ID}`]}>
        <Routes>
          <Route path="/nodes/:id" element={<PageWithSearchEcho />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Back to nodes' })).toHaveAttribute('href', '/nodes');
  });

  it('hides traceroutes and monitoring tabs for MeshCore nodes', () => {
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
    expect(screen.queryByTestId('node-detail-tab-traceroutes')).not.toBeInTheDocument();
    expect(screen.queryByTestId('node-detail-tab-monitoring')).not.toBeInTheDocument();
    expect(screen.getByTestId('node-detail-panel-overview')).toBeInTheDocument();
    expect(screen.getByTestId('url-search')).toHaveTextContent('');
  });

  describe('Traceroutes tiles', () => {
    const edge = { peer_node_id: 1, avg_snr_in: 5, avg_snr_out: null, count: 4 };
    const renderTraceroutes = () =>
      render(
        <MemoryRouter initialEntries={[`/nodes/${TEST_OBSERVED_INTERNAL_ID}?tab=traceroutes&range=7d`]}>
          <Routes>
            <Route path="/nodes/:id" element={<PageWithSearchEcho />} />
          </Routes>
        </MemoryRouter>
      );

    beforeEach(() => {
      vi.mocked(useNodeTracerouteLinks).mockReturnValue({
        data: { edges: [edge], nodes: [], snr_history: [] },
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useNodeTracerouteLinks>);
    });

    it('shows the count of traceroutes to this node, asked with the history table params', () => {
      vi.mocked(useTraceroutes).mockReturnValue({
        data: { count: 1234, results: [] },
        isLoading: false,
      } as unknown as ReturnType<typeof useTraceroutes>);
      renderTraceroutes();
      const tile = screen.getByTestId('node-traceroute-tile-traceroutes');
      expect(tile).toHaveTextContent('Traceroutes');
      expect(tile).toHaveTextContent((1234).toLocaleString());
      expect(tile).toHaveTextContent('to this node');
      expect(screen.queryByTestId('node-traceroute-tile-peers')).not.toBeInTheDocument();
      expect(useTraceroutes).toHaveBeenLastCalledWith({
        target_node: 100,
        triggered_after: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
        page_size: 10,
      });
    });

    it('shows a dash while the count loads', () => {
      vi.mocked(useTraceroutes).mockReturnValue({ data: undefined, isLoading: true } as unknown as ReturnType<
        typeof useTraceroutes
      >);
      renderTraceroutes();
      expect(screen.getByTestId('node-traceroute-tile-traceroutes')).toHaveTextContent('\u2014');
    });

    it('shows a dash, not 0, when the count query failed (no data, not loading)', () => {
      vi.mocked(useTraceroutes).mockReturnValue({ data: undefined, isLoading: false } as unknown as ReturnType<
        typeof useTraceroutes
      >);
      renderTraceroutes();
      const tile = screen.getByTestId('node-traceroute-tile-traceroutes');
      expect(tile).toHaveTextContent('\u2014');
      expect(tile).not.toHaveTextContent('0');
    });
  });

  describe('shared range', () => {
    const renderAt = (entry: string) =>
      render(
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/nodes/:id" element={<PageWithSearchEcho />} />
          </Routes>
        </MemoryRouter>
      );
    const base = `/nodes/${TEST_OBSERVED_INTERNAL_ID}`;

    it('keeps ?range= when switching between Statistics and Traceroutes', async () => {
      const user = userEvent.setup();
      renderAt(`${base}?tab=statistics&range=30d`);
      expect(screen.getByTestId('node-stats-mock')).toHaveAttribute('data-range', '30d');

      await user.click(screen.getByTestId('node-detail-tab-traceroutes'));
      expect(screen.getByTestId('url-search')).toHaveTextContent('tab=traceroutes');
      expect(screen.getByTestId('url-search')).toHaveTextContent('range=30d');
      expect(screen.getByRole('radio', { name: '30d' })).toBeChecked();

      await user.click(screen.getByTestId('node-detail-tab-statistics'));
      expect(screen.getByTestId('url-search')).toHaveTextContent('range=30d');
      expect(screen.getByTestId('node-stats-mock')).toHaveAttribute('data-range', '30d');
    });

    it('changing the range on Statistics writes ?range= and keeps ?tab=', async () => {
      const user = userEvent.setup();
      renderAt(`${base}?tab=statistics`);
      expect(screen.getByRole('radio', { name: '7d' })).toBeChecked();
      await user.click(screen.getByRole('radio', { name: '90d' }));
      expect(screen.getByTestId('url-search')).toHaveTextContent('tab=statistics');
      expect(screen.getByTestId('url-search')).toHaveTextContent('range=90d');
      expect(screen.getByTestId('node-stats-mock')).toHaveAttribute('data-range', '90d');
    });

    it('has no range bar on Overview', () => {
      renderAt(`${base}?range=30d`);
      expect(screen.getByTestId('node-detail-panel-overview')).toBeInTheDocument();
      expect(screen.queryByTestId('stats-range-bar')).not.toBeInTheDocument();
    });

    it('shows the bar on Statistics without an Online (2h) option', () => {
      renderAt(`${base}?tab=statistics`);
      expect(screen.getByTestId('stats-range-bar')).toBeInTheDocument();
      expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['24h', '7d', '30d', '90d']);
    });

    it('the compact sheet has no bar and never touches the URL', () => {
      render(
        <MemoryRouter initialEntries={['/nodes?foo=1']}>
          <Routes>
            <Route
              path="/nodes"
              element={
                <>
                  <Suspense fallback={null}>
                    <NodeDetailContent internalId={TEST_OBSERVED_INTERNAL_ID} compact />
                  </Suspense>
                  <UrlEcho />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.queryByTestId('stats-range-bar')).not.toBeInTheDocument();
      expect(screen.getByTestId('url-echo')).toHaveTextContent('?foo=1');
    });

    it('the compact sheet leaves garbage range and tab params alone', () => {
      render(
        <MemoryRouter initialEntries={['/nodes?foo=1&range=garbage&tab=bogus']}>
          <Routes>
            <Route
              path="/nodes"
              element={
                <>
                  <Suspense fallback={null}>
                    <NodeDetailContent internalId={TEST_OBSERVED_INTERNAL_ID} compact />
                  </Suspense>
                  <UrlEcho />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByTestId('url-echo')).toHaveTextContent('?foo=1&range=garbage&tab=bogus');
    });
  });

  describe('Right now', () => {
    const withMetrics = (battery: number) => ({
      ...minimalNode,
      latest_device_metrics: {
        reported_time: new Date(),
        logged_time: new Date(),
        battery_level: battery,
        voltage: 4.08,
        meshtastic_channel_utilization: 12.74,
        meshtastic_air_util_tx: 2.6,
        uptime_seconds: 14 * 86400 + 5,
      },
    });
    const renderAt = (entry: string) =>
      render(
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/nodes/:id" element={<PageWithSearchEcho />} />
          </Routes>
        </MemoryRouter>
      );

    it('shows the latest readings on Overview', () => {
      mockedUseNodeSuspense.mockReturnValue(withMetrics(93));
      renderAt(`/nodes/${TEST_OBSERVED_INTERNAL_ID}`);
      expect(screen.getByTestId('node-right-now-tile-battery')).toHaveTextContent('93%');
      expect(screen.getByTestId('node-right-now-tile-channel')).toHaveTextContent('12.7%');
      expect(screen.getByTestId('node-right-now-tile-uptime')).toHaveTextContent('14d');
      expect(screen.getByTestId('node-right-now-table')).toBeInTheDocument();
    });

    it('shows it on Statistics too, and shows Powered for raw 101', () => {
      mockedUseNodeSuspense.mockReturnValue(withMetrics(101));
      renderAt(`/nodes/${TEST_OBSERVED_INTERNAL_ID}?tab=statistics`);
      expect(screen.getByTestId('node-right-now-tile-battery')).toHaveTextContent('Powered');
      expect(screen.getByTestId('node-right-now-tile-battery')).not.toHaveTextContent('101');
    });

    it('is not on the Map tab', () => {
      mockedUseNodeSuspense.mockReturnValue(withMetrics(50));
      renderAt(`/nodes/${TEST_OBSERVED_INTERNAL_ID}?tab=map`);
      expect(screen.queryByTestId('node-right-now')).not.toBeInTheDocument();
    });

    it('falls back to Last heard alone when the node has no device metrics', () => {
      renderAt(`/nodes/${TEST_OBSERVED_INTERNAL_ID}`);
      expect(screen.getByTestId('node-right-now-tile-heard')).toBeInTheDocument();
      expect(screen.queryByTestId('node-right-now-tile-battery')).not.toBeInTheDocument();
    });
  });

  describe('Firmware row', () => {
    const renderOverview = () =>
      render(
        <MemoryRouter initialEntries={[`/nodes/${TEST_OBSERVED_INTERNAL_ID}`]}>
          <Routes>
            <Route path="/nodes/:id" element={<PageWithSearchEcho />} />
          </Routes>
        </MemoryRouter>
      );

    it('shows the chip for a Meshtastic node with an inferred generation', () => {
      mockedUseNodeSuspense.mockReturnValue({
        ...minimalNode,
        inferred_firmware: '2.8',
        inferred_firmware_basis: 'key_identity',
      });
      renderOverview();
      expect(screen.getByText('Firmware:')).toBeInTheDocument();
      expect(screen.getByText('2.8+ (inferred)')).toBeInTheDocument();
    });

    it('shows Unknown when the API returns null', () => {
      mockedUseNodeSuspense.mockReturnValue({ ...minimalNode, inferred_firmware: null, inferred_firmware_basis: null });
      renderOverview();
      expect(screen.getByText('Firmware:')).toBeInTheDocument();
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('hides the whole row when the API omits the field', () => {
      renderOverview();
      expect(screen.queryByText('Firmware:')).not.toBeInTheDocument();
    });

    it('hides the whole row for MeshCore', () => {
      mockedUseNodeSuspense.mockReturnValue({
        ...minimalNode,
        protocol: 2,
        meshtastic_node_id: 0,
        node_id_str: 'mc:abc',
        inferred_firmware: '2.8',
      });
      renderOverview();
      expect(screen.queryByText('Firmware:')).not.toBeInTheDocument();
    });
  });
});
