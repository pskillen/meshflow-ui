import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ObservedNode } from '@/lib/models';
import { MESHCORE_CONFIG, MESHTASTIC_CONFIG } from '@/lib/mesh-protocol';
import { ProtocolNodesPage } from './ProtocolNodesPage';

vi.mock('@/hooks/api/useProtocolNodes', () => ({ useProtocolObservedNodesSuspense: vi.fn() }));
vi.mock('@/hooks/api/useNodes', () => ({ useManagedNodesSuspense: vi.fn() }));
vi.mock('@/hooks/api/useMeshCore', () => ({ useMeshCoreManagedNodesSuspense: vi.fn() }));

// Map components are heavy (Leaflet); stand in with the node count each receives.
vi.mock('@/components/nodes/NodesAndConstellationsMap', () => ({
  NodesAndConstellationsMap: ({ observedNodes }: { observedNodes: unknown[] }) => (
    <div data-testid="map-stub">{observedNodes.length}</div>
  ),
}));
vi.mock('@/components/nodes/NodesMap', () => ({
  NodesMap: ({ nodes }: { nodes: unknown[] }) => <div data-testid="map-stub">{nodes.length}</div>,
}));
vi.mock('@/components/nodes/NodeCard', () => ({
  NodeCard: ({ node }: { node: ObservedNode }) => <div data-testid="node-card">{node.long_name}</div>,
}));

import { useProtocolObservedNodesSuspense } from '@/hooks/api/useProtocolNodes';
import { useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { useMeshCoreManagedNodesSuspense } from '@/hooks/api/useMeshCore';

const mockObserved = vi.mocked(useProtocolObservedNodesSuspense);

function node(id: number, name: string, extra: Partial<ObservedNode> = {}): ObservedNode {
  return {
    internal_id: id,
    node_id_str: `!${id.toString(16).padStart(8, '0')}`,
    long_name: name,
    short_name: name.slice(0, 4),
    last_heard: new Date('2026-11-09T12:00:00Z'),
    ...extra,
  } as ObservedNode;
}

const NODES = [node(1, 'Alpha'), node(2, 'Bravo'), node(3, 'Charlie')];

function renderPage(config = MESHTASTIC_CONFIG, url = '/nodes') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ProtocolNodesPage config={config} />
    </MemoryRouter>
  );
}

describe('ProtocolNodesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.mocked(useManagedNodesSuspense).mockReturnValue({ managedNodes: [] } as unknown as ReturnType<
      typeof useManagedNodesSuspense
    >);
    vi.mocked(useMeshCoreManagedNodesSuspense).mockReturnValue({ feeders: [] } as unknown as ReturnType<
      typeof useMeshCoreManagedNodesSuspense
    >);
    mockObserved.mockReturnValue({
      nodes: NODES,
      totalNodes: 3,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
    } as unknown as ReturnType<typeof useProtocolObservedNodesSuspense>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers Online (2h), 24h, 7d, 30d and 90d, with 7d selected and no All', () => {
    renderPage();
    const group = screen.getByRole('radiogroup', { name: /time range/i });
    const labels = within(group)
      .getAllByRole('radio')
      .map((r) => r.textContent);
    expect(labels).toEqual(['Online (2h)', '24h', '7d', '30d', '90d']);
    expect(within(group).getByRole('radio', { name: '7d' })).toBeChecked();
  });

  it('queries last_heard_after from the range start, about seven days back by default', () => {
    renderPage();
    const opts = mockObserved.mock.calls[0]![1]!;
    const ageHours = (Date.now() - opts.lastHeardAfter!.getTime()) / 3_600_000;
    expect(ageHours).toBeGreaterThan(160);
    expect(ageHours).toBeLessThan(180);
  });

  it('Online (2h) rolls from now: the window start is two hours back (within the 5-minute tick)', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('radio', { name: 'Online (2h)' }));
    const calls = mockObserved.mock.calls;
    const opts = calls[calls.length - 1]![1]!;
    const ageMin = (Date.now() - opts.lastHeardAfter!.getTime()) / 60_000;
    expect(ageMin).toBeGreaterThanOrEqual(120);
    expect(ageMin).toBeLessThan(126);
  });

  it('takes the range from ?range= and ignores the retired all', () => {
    renderPage(MESHTASTIC_CONFIG, '/nodes?range=30d');
    expect(screen.getByRole('radio', { name: '30d' })).toBeChecked();
  });

  it('falls back to 7d for ?range=all', () => {
    renderPage(MESHTASTIC_CONFIG, '/nodes?range=all');
    expect(screen.getByRole('radio', { name: '7d' })).toBeChecked();
  });

  it('puts the search between the map and the list, and filters both', async () => {
    const user = userEvent.setup();
    renderPage();
    const map = screen.getByTestId('map-stub');
    const search = screen.getByRole('textbox', { name: /search nodes/i });
    const firstCard = screen.getAllByTestId('node-card')[0]!;
    expect(map.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(search.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(map).toHaveTextContent('3');
    await user.type(search, 'brav');
    expect(screen.getAllByTestId('node-card')).toHaveLength(1);
    expect(screen.getByTestId('map-stub')).toHaveTextContent('1');
    expect(screen.getByTestId('nodes-count')).toHaveTextContent('1 of 3 heard in last 7 days');
  });

  it('MeshCore: filters the identity-only table and the map from the same search box', async () => {
    const user = userEvent.setup();
    mockObserved.mockReturnValue({
      nodes: [
        node(1, 'Pos', { latest_position: { latitude: 55, longitude: -4 } as ObservedNode['latest_position'] }),
        node(2, 'Nopos'),
      ],
      totalNodes: 2,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
    } as unknown as ReturnType<typeof useProtocolObservedNodesSuspense>);
    renderPage(MESHCORE_CONFIG);
    expect(screen.getByText(/Identity only \/ no position \(1\)/)).toBeInTheDocument();
    const search = screen.getByRole('textbox', { name: /search nodes/i });
    await user.type(search, 'zzz');
    expect(screen.getByText(/Identity only \/ no position \(0\)/)).toBeInTheDocument();
    expect(screen.getByText(/With location \(0\)/)).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'nopos');
    expect(screen.getByText(/Identity only \/ no position \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/With location \(0\)/)).toBeInTheDocument();
  });
});
