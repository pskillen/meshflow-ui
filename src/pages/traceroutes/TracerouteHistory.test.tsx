import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { AutoTraceRoute, ManagedNode, ObservedNode } from '@/lib/models';

vi.mock('@/hooks/useTraceroutesWithWebSocket', () => ({
  useTraceroutesInfiniteWithWebSocket: vi.fn(),
}));
vi.mock('@/hooks/api/useTraceroutes', () => ({
  useTracerouteTriggerableNodesSuspense: vi.fn(),
  useTriggerTraceroute: vi.fn(),
}));
vi.mock('@/hooks/api/useNodes', () => ({
  useNodesSuspense: vi.fn(),
  useManagedNodesSuspense: vi.fn(),
}));

vi.mock('@/pages/traceroutes/TracerouteDetailModal', () => ({
  TracerouteDetailModal: ({ tracerouteId, open }: { tracerouteId: number | null; open: boolean }) =>
    open ? <div role="dialog" data-testid="detail-modal">Detail for {tracerouteId}</div> : null,
}));

vi.mock('@/pages/traceroutes/TriggerTracerouteModal', () => ({
  TriggerTracerouteModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" data-testid="trigger-modal">Trigger modal</div> : null,
}));

import { useTraceroutesInfiniteWithWebSocket } from '@/hooks/useTraceroutesWithWebSocket';
import { useTracerouteTriggerableNodesSuspense, useTriggerTraceroute } from '@/hooks/api/useTraceroutes';
import { useNodesSuspense, useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { TracerouteHistory } from './TracerouteHistory';

const mockedUseInfinite = vi.mocked(useTraceroutesInfiniteWithWebSocket);
const mockedUseTriggerable = vi.mocked(useTracerouteTriggerableNodesSuspense);
const mockedUseTrigger = vi.mocked(useTriggerTraceroute);
const mockedUseNodes = vi.mocked(useNodesSuspense);
const mockedUseManagedNodes = vi.mocked(useManagedNodesSuspense);

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

function makeTraceroute(overrides: Partial<AutoTraceRoute> = {}): AutoTraceRoute {
  return {
    id: 1,
    source_node: makeManagedNode(),
    target_node: {
      internal_id: '00000000-0000-4000-8000-000000000001',
      meshtastic_node_id: 100,
      node_id_str: '!00000064',
      mac_addr: null,
      long_name: 'Target',
      short_name: 'TGT',
      meshtastic_hw_model: null,
      meshtastic_public_key: null,
    } as ObservedNode,
    trigger_type: 1,
    trigger_type_label: 'User',
    triggered_by: 1,
    triggered_by_username: 'me',
    trigger_source: 'ui',
    triggered_at: '2026-04-17T10:00:00Z',
    earliest_send_at: '2026-04-17T10:00:00Z',
    dispatched_at: '2026-04-17T10:00:01Z',
    dispatch_attempts: 0,
    dispatch_error: null,
    status: 'completed',
    route: [],
    route_back: [],
    raw_packet: null,
    completed_at: '2026-04-17T10:00:05Z',
    error_message: null,
    ...overrides,
  };
}

interface InfiniteOptions {
  traceroutes?: AutoTraceRoute[];
  totalCount?: number | null;
  isLoading?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: ReturnType<typeof vi.fn>;
}

function makeObservedNode(overrides: Partial<ObservedNode> = {}): ObservedNode {
  return {
    internal_id: '00000000-0000-4000-8000-000000000001',
    meshtastic_node_id: 100,
    node_id_str: '!00000064',
    mac_addr: null,
    long_name: 'Target',
    short_name: 'TGT',
    meshtastic_hw_model: null,
    meshtastic_public_key: null,
    ...overrides,
  } as ObservedNode;
}

function setupHooks(
  infinite: InfiniteOptions = {},
  triggerable: ManagedNode[] = [],
  observed: ObservedNode[] = []
) {
  const fetchNextPage = infinite.fetchNextPage ?? vi.fn();
  mockedUseInfinite.mockReturnValue({
    traceroutes: infinite.traceroutes ?? [],
    totalCount: infinite.totalCount ?? null,
    isLoading: infinite.isLoading ?? false,
    error: null,
    fetchNextPage,
    hasNextPage: infinite.hasNextPage ?? false,
    isFetchingNextPage: infinite.isFetchingNextPage ?? false,
  } as unknown as ReturnType<typeof useTraceroutesInfiniteWithWebSocket>);
  mockedUseTriggerable.mockReturnValue({ triggerableNodes: triggerable });
  mockedUseTrigger.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useTriggerTraceroute>);
  mockedUseNodes.mockReturnValue({
    nodes: observed,
    totalCount: observed.length,
  } as unknown as ReturnType<typeof useNodesSuspense>);
  mockedUseManagedNodes.mockReturnValue({
    managedNodes: triggerable,
  } as unknown as ReturnType<typeof useManagedNodesSuspense>);
  return { fetchNextPage };
}

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <TracerouteHistory />
    </MemoryRouter>
  );
}

describe('TracerouteHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hydrates target_node from the URL into the query params', () => {
    setupHooks();
    renderAt('/traceroutes/history?target_node=1127903080');
    expect(mockedUseInfinite).toHaveBeenCalledWith(
      expect.objectContaining({ target_node: 1127903080 })
    );
  });

  it('hydrates target_node and status (CSV) from the URL', () => {
    setupHooks();
    renderAt('/traceroutes/history?target_node=42&status=completed,failed');
    expect(mockedUseInfinite).toHaveBeenCalledWith(
      expect.objectContaining({ target_node: 42, status: 'completed,failed' })
    );
  });

  it('hydrates trigger_type CSV from the URL', () => {
    setupHooks();
    renderAt('/traceroutes/history?trigger_type=user,monitor');
    expect(mockedUseInfinite).toHaveBeenCalledWith(
      expect.objectContaining({ trigger_type: 'user,monitor' })
    );
  });

  it('hydrates strategy CSV from the URL into target_strategy', () => {
    setupHooks();
    renderAt('/traceroutes/history?strategy=intra_zone,dx_across');
    expect(mockedUseInfinite).toHaveBeenCalledWith(
      expect.objectContaining({ target_strategy: 'intra_zone,dx_across' })
    );
  });

  it('passes unknown filter values through to the API (graceful)', () => {
    setupHooks();
    renderAt('/traceroutes/history?status=bogus_value&target_node=999999999');
    expect(mockedUseInfinite).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'bogus_value', target_node: 999999999 })
    );
  });

  it('shows the Trigger CTA when the user has triggerable nodes', () => {
    setupHooks({}, [makeManagedNode()]);
    renderAt('/traceroutes/history');
    expect(screen.getByRole('button', { name: /trigger traceroute/i })).toBeInTheDocument();
  });

  it('hides the Trigger CTA when the user has no triggerable nodes', () => {
    setupHooks({}, []);
    renderAt('/traceroutes/history');
    expect(screen.queryByRole('button', { name: /^trigger traceroute$/i })).not.toBeInTheDocument();
  });

  it('shows a "Clear filters" button only when at least one filter is set', () => {
    setupHooks();
    const { unmount } = renderAt('/traceroutes/history');
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
    unmount();

    renderAt('/traceroutes/history?target_node=42');
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });

  it('renders Load more disabled when there is no next page', () => {
    setupHooks({ traceroutes: [makeTraceroute()], hasNextPage: false });
    renderAt('/traceroutes/history');
    const btn = screen.getByRole('button', { name: /no more results/i });
    expect(btn).toBeDisabled();
  });

  it('calls fetchNextPage when Load more is clicked', () => {
    const fetchNextPage = vi.fn();
    setupHooks({
      traceroutes: [makeTraceroute()],
      hasNextPage: true,
      fetchNextPage,
    });
    renderAt('/traceroutes/history');
    fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    expect(fetchNextPage).toHaveBeenCalled();
  });

  it('shows the total count in the table title when available', () => {
    setupHooks({ traceroutes: [makeTraceroute()], totalCount: 73 });
    renderAt('/traceroutes/history');
    expect(screen.getByText('(73)')).toBeInTheDocument();
  });

  it('applies the "Show successful" preset to status filter when clicked', () => {
    setupHooks();
    renderAt('/traceroutes/history');
    fireEvent.click(screen.getByRole('button', { name: /show successful/i }));
    const lastCall = mockedUseInfinite.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual(expect.objectContaining({ status: 'completed,pending,sent' }));
  });

  it('clears status when "Show successful" is clicked while already active', () => {
    setupHooks();
    renderAt('/traceroutes/history?status=completed,pending,sent');
    fireEvent.click(screen.getByRole('button', { name: /show successful/i }));
    const lastCall = mockedUseInfinite.mock.calls.at(-1)?.[0];
    expect(lastCall?.status).toBeUndefined();
  });

  it('applies the "Monitoring TRs" preset to trigger_type when clicked', () => {
    setupHooks();
    renderAt('/traceroutes/history');
    fireEvent.click(screen.getByRole('button', { name: /monitoring trs/i }));
    const lastCall = mockedUseInfinite.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual(expect.objectContaining({ trigger_type: '4' }));
  });

  it('applies the "Manually triggered" preset to trigger_type when clicked', () => {
    setupHooks();
    renderAt('/traceroutes/history');
    fireEvent.click(screen.getByRole('button', { name: /manually triggered/i }));
    const lastCall = mockedUseInfinite.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual(expect.objectContaining({ trigger_type: '1' }));
  });

  it('opens the searchable target filter and filters options by query', () => {
    const nodes = [
      makeObservedNode({ meshtastic_node_id: 1, node_id_str: '!00000001', short_name: 'AAA', long_name: 'Alpha' }),
      makeObservedNode({ meshtastic_node_id: 2, node_id_str: '!00000002', short_name: 'BBB', long_name: 'Bravo' }),
      makeObservedNode({ meshtastic_node_id: 3, node_id_str: '!00000003', short_name: 'CCC', long_name: 'Charlie' }),
    ];
    setupHooks({}, [], nodes);
    renderAt('/traceroutes/history');

    fireEvent.click(screen.getByRole('button', { name: /target \(recipient\)/i }));

    expect(screen.getAllByText('AAA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BBB').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CCC').length).toBeGreaterThan(0);

    const searchInput = screen.getByPlaceholderText('Search nodes...');
    fireEvent.change(searchInput, { target: { value: 'brav' } });

    expect(screen.queryByText('AAA')).not.toBeInTheDocument();
    expect(screen.getAllByText('BBB').length).toBeGreaterThan(0);
    expect(screen.queryByText('CCC')).not.toBeInTheDocument();
  });

  it('selecting a node from the searchable target filter updates the query', () => {
    const nodes = [
      makeObservedNode({ meshtastic_node_id: 555, node_id_str: '!0000022b', short_name: 'PICKME', long_name: 'Pick me' }),
    ];
    setupHooks({}, [], nodes);
    renderAt('/traceroutes/history');

    fireEvent.click(screen.getByRole('button', { name: /target \(recipient\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /pickme/i }));

    const lastCall = mockedUseInfinite.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual(expect.objectContaining({ target_node: 555 }));
  });

  it('shows Queued badge and due line for pending traceroute', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-04-17T12:00:00.000Z'));
    setupHooks({
      traceroutes: [
        makeTraceroute({
          status: 'pending',
          completed_at: null,
          dispatched_at: null,
          earliest_send_at: '2026-04-17T13:00:00.000Z',
          route: null,
          route_back: null,
        }),
      ],
    });
    renderAt('/traceroutes/history');
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByText(/^Due /)).toBeInTheDocument();
  });

  it('shows In flight and sent line for sent traceroute', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-04-17T12:00:00.000Z'));
    setupHooks({
      traceroutes: [
        makeTraceroute({
          status: 'sent',
          completed_at: null,
          earliest_send_at: '2026-04-17T11:00:00.000Z',
          dispatched_at: '2026-04-17T11:45:00.000Z',
          route: null,
          route_back: null,
        }),
      ],
    });
    renderAt('/traceroutes/history');
    expect(screen.getByText('In flight')).toBeInTheDocument();
    expect(screen.getByText(/^Sent /)).toBeInTheDocument();
  });

  it('status filter dropdown uses Queued and In flight labels', async () => {
    const user = userEvent.setup();
    setupHooks();
    renderAt('/traceroutes/history');
    await user.click(screen.getByRole('button', { name: /^Status$/i }));
    expect(await screen.findByRole('menuitemcheckbox', { name: /^Queued$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: /^In flight$/i })).toBeInTheDocument();
  });
});
