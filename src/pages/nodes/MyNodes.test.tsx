import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ManagedNode, ObservedNode } from '@/lib/models';

import { MyNodes } from './MyNodes';
import { MY_NODES_CLAIMED_ONLINE_MS, MY_NODES_CLAIMED_RECENT_MS, MY_NODES_FEEDER_FRESH_MS } from '@/lib/my-nodes-grouping';

vi.mock('@/providers/ConfigProvider', () => ({
  useConfig: () => ({ apis: { meshBot: { baseUrl: 'https://bot.example' } } }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: [] })),
  };
});

const useMyClaimedNodesSuspense = vi.fn();
const useMyManagedNodesSuspense = vi.fn();

vi.mock('@/hooks/api/useNodes', () => ({
  useMyClaimedNodesSuspense: () => useMyClaimedNodesSuspense(),
  useMyManagedNodesSuspense: () => useMyManagedNodesSuspense(),
}));

vi.mock('@/hooks/api/useNodeWatches', () => ({
  useNodeWatches: () => ({
    data: { results: [] },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/hooks/api/useApi', () => ({
  useMeshflowApi: () => ({
    getApiKeys: vi.fn(),
  }),
  useMeshtasticApi: () => ({
    getApiKeys: vi.fn(),
  }),
}));

vi.mock('@/components/nodes/NodesMap', () => ({
  NodesMap: () => <div data-testid="nodes-map">map</div>,
}));

vi.mock('@/components/nodes/MonitoredNodesBatteryChart', () => ({
  MonitoredNodesBatteryChart: () => <div data-testid="battery-chart">chart</div>,
}));

vi.mock('@/components/nodes/MeshWatchControls', () => ({
  MeshWatchControls: () => <div data-testid="mesh-watch">watch</div>,
}));

const NOW = new Date('2026-04-21T12:00:00.000Z');

function makeObserved(overrides: Partial<ObservedNode> = {}): ObservedNode {
  return {
    internal_id: '00000000-0000-4000-8000-000000000001',
    meshtastic_node_id: 100,
    node_id_str: '!00000064',
    mac_addr: null,
    long_name: 'LN',
    short_name: 'SN',
    meshtastic_hw_model: null,
    meshtastic_public_key: null,
    last_heard: NOW,
    latest_position: null,
    owner: { id: 1, username: 'me' },
    ...overrides,
  } as ObservedNode;
}

function makeManaged(overrides: Partial<ManagedNode> = {}): ManagedNode {
  return {
    meshtastic_node_id: 200,
    long_name: 'MLN',
    short_name: 'M1',
    last_heard: NOW,
    node_id_str: '!000000c8',
    owner: { id: 1, username: 'me' },
    constellation: { id: 1 },
    position: { latitude: 55.0, longitude: -4.0 },
    last_packet_ingested_at: new Date(NOW.getTime() - 60_000),
    radio_last_heard: new Date(NOW.getTime() - 60_000),
    ...overrides,
  } as ManagedNode;
}

function renderMyNodes() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MyNodes />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MyNodes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    useMyClaimedNodesSuspense.mockReturnValue({ myClaimedNodes: [] });
    useMyManagedNodesSuspense.mockReturnValue({ myManagedNodes: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not show managed section when there are no managed nodes', () => {
    renderMyNodes();
    expect(screen.queryByText('Managed nodes')).not.toBeInTheDocument();
  });

  it('shows managed section when there are managed nodes', () => {
    useMyManagedNodesSuspense.mockReturnValue({ myManagedNodes: [makeManaged()] });
    renderMyNodes();
    expect(screen.getByText('Managed nodes')).toBeInTheDocument();
  });

  it('dedupes claimed+managed so the node appears only under Managed', () => {
    const nid = 42;
    const claimed = makeObserved({
      meshtastic_node_id: nid,
      node_id_str: '!0000002a',
      short_name: 'DEDUP',
      last_heard: new Date(NOW.getTime() - 60_000),
    });
    const managed = makeManaged({
      meshtastic_node_id: nid,
      node_id_str: '!0000002a',
      short_name: 'DEDUP',
    });
    useMyClaimedNodesSuspense.mockReturnValue({ myClaimedNodes: [claimed] });
    useMyManagedNodesSuspense.mockReturnValue({ myManagedNodes: [managed] });
    renderMyNodes();
    expect(screen.getByText('Managed nodes')).toBeInTheDocument();
    expect(screen.queryByText('Claimed nodes')).not.toBeInTheDocument();
    const names = screen.getAllByText('DEDUP');
    expect(names.length).toBe(1);
  });

  it('shows online empty state when every claimed-only node is offline', () => {
    const offline = makeObserved({
      meshtastic_node_id: 1,
      last_heard: new Date(NOW.getTime() - MY_NODES_CLAIMED_RECENT_MS - 60_000),
    });
    useMyClaimedNodesSuspense.mockReturnValue({ myClaimedNodes: [offline] });
    useMyManagedNodesSuspense.mockReturnValue({ myManagedNodes: [] });
    renderMyNodes();
    expect(screen.getByText('No nodes online right now.')).toBeInTheDocument();
    expect(screen.queryByText('Last heard recently')).not.toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('hides Recent and Offline sections when those buckets are empty', () => {
    const online = makeObserved({
      meshtastic_node_id: 1,
      last_heard: new Date(NOW.getTime() - 60_000),
    });
    useMyClaimedNodesSuspense.mockReturnValue({ myClaimedNodes: [online] });
    useMyManagedNodesSuspense.mockReturnValue({ myManagedNodes: [] });
    renderMyNodes();
    expect(screen.queryByText('Last heard recently')).not.toBeInTheDocument();
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  });

  it('shows destructive managed liveness when feeder and radio are stale', () => {
    const managed = makeManaged({
      meshtastic_node_id: 7,
      last_packet_ingested_at: new Date(NOW.getTime() - MY_NODES_FEEDER_FRESH_MS - 120_000),
      radio_last_heard: new Date(NOW.getTime() - MY_NODES_CLAIMED_ONLINE_MS - 120_000),
    });
    useMyClaimedNodesSuspense.mockReturnValue({ myClaimedNodes: [] });
    useMyManagedNodesSuspense.mockReturnValue({ myManagedNodes: [managed] });
    renderMyNodes();
    expect(screen.getByText('Connectivity issue')).toBeInTheDocument();
    expect(screen.getByText(/Managed node offline/)).toBeInTheDocument();
  });

  it('does not show feeder-not-reporting when last_packet_ingested_at is missing but radio is fresh', () => {
    const managed = makeManaged({
      meshtastic_node_id: 8,
      last_packet_ingested_at: null,
      radio_last_heard: new Date(NOW.getTime() - 60_000),
    });
    useMyClaimedNodesSuspense.mockReturnValue({ myClaimedNodes: [] });
    useMyManagedNodesSuspense.mockReturnValue({ myManagedNodes: [managed] });
    renderMyNodes();
    expect(screen.queryByText(/Feeder not reporting/)).not.toBeInTheDocument();
    expect(screen.queryByText('Attention')).not.toBeInTheDocument();
  });

  it('renders map section title and map component', () => {
    useMyClaimedNodesSuspense.mockReturnValue({ myClaimedNodes: [makeObserved()] });
    useMyManagedNodesSuspense.mockReturnValue({ myManagedNodes: [] });
    renderMyNodes();
    expect(screen.getByText('Your nodes on the map')).toBeInTheDocument();
  });
});
