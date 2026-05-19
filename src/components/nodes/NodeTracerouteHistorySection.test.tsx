import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AutoTraceRoute, ManagedNode, ObservedNode } from '@/lib/models';

vi.mock('@/hooks/useTraceroutesWithWebSocket', () => ({
  useTraceroutesWithWebSocket: vi.fn(),
}));
vi.mock('@/hooks/api/useTraceroutes', () => ({
  useTracerouteTriggerableNodesSuspense: vi.fn(),
  useTriggerTraceroute: vi.fn(),
}));

vi.mock('@/hooks/api/useNodes', () => ({
  useManagedNodesSuspense: vi.fn(),
}));

vi.mock('@/pages/traceroutes/TracerouteDetailModal', () => ({
  TracerouteDetailModal: ({
    tracerouteId,
    open,
  }: {
    tracerouteId: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog" data-testid="detail-modal">
        Detail for {tracerouteId}
      </div>
    ) : null,
}));

vi.mock('@/pages/traceroutes/TriggerTracerouteModal', () => ({
  TriggerTracerouteModal: ({
    open,
    fixedTargetNode,
  }: {
    open: boolean;
    fixedTargetNode?: ObservedNode;
    onOpenChange: (open: boolean) => void;
    mode: 'user' | 'auto';
    managedNodes: ManagedNode[];
    observedNodes: ObservedNode[];
    onTrigger: (
      managedNodeId: number,
      targetNodeId?: number,
      targetStrategy?: 'intra_zone' | 'dx_across' | 'dx_same_side',
    ) => Promise<void>;
    isSubmitting: boolean;
  }) =>
    open ? (
      <div role="dialog" data-testid="trigger-modal">
        Trigger modal; fixed target = {fixedTargetNode?.node_id_str}
      </div>
    ) : null,
}));

import { useTraceroutesWithWebSocket } from '@/hooks/useTraceroutesWithWebSocket';
import { useTracerouteTriggerableNodesSuspense, useTriggerTraceroute } from '@/hooks/api/useTraceroutes';
import { useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { NodeTracerouteHistorySection } from './NodeTracerouteHistorySection';

const mockedUseTraceroutesWithWebSocket = vi.mocked(useTraceroutesWithWebSocket);
const mockedUseTriggerableNodes = vi.mocked(useTracerouteTriggerableNodesSuspense);
const mockedUseTriggerTraceroute = vi.mocked(useTriggerTraceroute);
const mockedUseManagedNodes = vi.mocked(useManagedNodesSuspense);

function makeObservedNode(overrides: Partial<ObservedNode> = {}): ObservedNode {
  return {
    internal_id: 1,
    meshtastic_node_id: 100,
    node_id_str: '!00000064',
    mac_addr: null,
    long_name: 'Target node',
    short_name: 'TGT',
    hw_model: null,
    public_key: null,
    ...overrides,
  };
}

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
    target_node: makeObservedNode(),
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

interface UseTraceroutesReturn {
  data?: { results: AutoTraceRoute[] };
  isLoading: boolean;
  error: Error | null;
}

function setupHooks(options: {
  traceroutes?: AutoTraceRoute[];
  triggerableNodes?: ManagedNode[];
  managedNodes?: ManagedNode[];
  isLoading?: boolean;
  error?: Error | null;
  mutate?: ReturnType<typeof vi.fn>;
  isPending?: boolean;
}) {
  const result: UseTraceroutesReturn = {
    data: options.isLoading ? undefined : { results: options.traceroutes ?? [] },
    isLoading: options.isLoading ?? false,
    error: options.error ?? null,
  };
  // The real hook returns a UseQueryResult with many fields, but the component
  // only reads data/isLoading/error; cast keeps the type happy for the mock.
  mockedUseTraceroutesWithWebSocket.mockReturnValue(result as ReturnType<typeof useTraceroutesWithWebSocket>);
  mockedUseTriggerableNodes.mockReturnValue({ triggerableNodes: options.triggerableNodes ?? [] });
  mockedUseTriggerTraceroute.mockReturnValue({
    mutate: options.mutate ?? vi.fn(),
    mutateAsync: vi.fn(),
    isPending: options.isPending ?? false,
  } as unknown as ReturnType<typeof useTriggerTraceroute>);
  const managedList = options.managedNodes ?? options.triggerableNodes ?? [];
  mockedUseManagedNodes.mockReturnValue({
    managedNodes: managedList,
    totalManagedNodes: managedList.length,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
  } as unknown as ReturnType<typeof useManagedNodesSuspense>);
}

function renderSection(observedNode: ObservedNode = makeObservedNode()) {
  return render(
    <MemoryRouter>
      <NodeTracerouteHistorySection nodeId={observedNode.meshtastic_node_id} observedNode={observedNode} />
    </MemoryRouter>
  );
}

describe('NodeTracerouteHistorySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state when there are no traceroutes', () => {
    setupHooks({ traceroutes: [], triggerableNodes: [] });
    renderSection();
    expect(screen.getByText(/no traceroutes to this node yet/i)).toBeInTheDocument();
  });

  it('hides the trigger button and repeat column when the user has no triggerable nodes', () => {
    setupHooks({ traceroutes: [makeTraceroute()], triggerableNodes: [] });
    renderSection();
    expect(screen.queryByRole('button', { name: /trigger traceroute to this node/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /repeat traceroute/i })).not.toBeInTheDocument();
  });

  it('shows the trigger button and a repeat button when the user can trigger from the row source', () => {
    const managed = makeManagedNode();
    setupHooks({
      traceroutes: [makeTraceroute({ source_node: managed })],
      triggerableNodes: [managed],
    });
    renderSection();
    expect(screen.getByRole('button', { name: /trigger traceroute to this node/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /repeat traceroute/i })).toBeInTheDocument();
  });

  it('disables the repeat button when the source does not allow auto traceroute', () => {
    const managed = makeManagedNode({ allow_auto_traceroute: false });
    setupHooks({
      traceroutes: [makeTraceroute({ source_node: managed })],
      triggerableNodes: [managed],
    });
    renderSection();
    expect(screen.getByRole('button', { name: /repeat traceroute/i })).toBeDisabled();
  });

  it('opens the detail modal when a row is clicked', () => {
    const managed = makeManagedNode();
    setupHooks({
      traceroutes: [makeTraceroute({ id: 42, source_node: managed })],
      triggerableNodes: [managed],
    });
    renderSection();
    // The row contains the source short name
    fireEvent.click(screen.getByText('SRC'));
    expect(screen.getByTestId('detail-modal')).toHaveTextContent('Detail for 42');
  });

  it('opens the trigger modal with fixedTargetNode when the header button is clicked', () => {
    const managed = makeManagedNode();
    const observed = makeObservedNode({ meshtastic_node_id: 555, node_id_str: '!0000022b' });
    setupHooks({ traceroutes: [], triggerableNodes: [managed] });
    renderSection(observed);
    fireEvent.click(screen.getByRole('button', { name: /trigger traceroute to this node/i }));
    expect(screen.getByTestId('trigger-modal')).toHaveTextContent('fixed target = !0000022b');
  });

  it('calls the trigger mutation with source + target when the repeat button is clicked', () => {
    const managed = makeManagedNode({ meshtastic_node_id: 777 });
    const observed = makeObservedNode({ meshtastic_node_id: 888 });
    const mutate = vi.fn();
    setupHooks({
      traceroutes: [makeTraceroute({ source_node: managed, target_node: observed })],
      triggerableNodes: [managed],
      mutate,
    });
    renderSection(observed);
    fireEvent.click(screen.getByRole('button', { name: /repeat traceroute/i }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ managedNodeId: 777, targetNodeId: 888 }),
      expect.objectContaining({ onError: expect.any(Function) })
    );
  });

  it('renders a View all link pointing at the traceroute history filtered by target', () => {
    const managed = makeManagedNode();
    const observed = makeObservedNode({ meshtastic_node_id: 100 });
    setupHooks({ traceroutes: [makeTraceroute({ source_node: managed })], triggerableNodes: [managed] });
    renderSection(observed);
    const link = screen.getByRole('link', { name: /view all traceroutes to this node/i });
    expect(link).toHaveAttribute('href', '/traceroutes/history?target_node=100');
  });
});
