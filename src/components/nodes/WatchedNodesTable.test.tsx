import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AutoTraceRoute, NodeWatch, ObservedNode, ObservedNodeWatchSummary } from '@/lib/models';
import type { ComponentProps } from 'react';
import { WatchedNodesTable } from './WatchedNodesTable';

vi.mock('@/components/nodes/MeshWatchControls', () => ({
  MeshWatchControls: () => <div data-testid="mesh-watch-controls" />,
}));

const getTraceroutes = vi.fn();

vi.mock('@/hooks/api/useApi', () => ({
  useMeshtasticApi: () => ({
    getTraceroutes,
  }),
}));

vi.mock('@/hooks/useTraceroutesWithWebSocket', () => ({
  useTraceroutesWebSocketInvalidator: vi.fn(),
}));

vi.mock('@/hooks/api/useMultiNodeMetrics', () => ({
  useMultiNodeMetrics: () => ({
    metricsMap: {} as Record<number, unknown[]>,
    isLoading: false,
    isError: false,
    errors: [],
  }),
}));

function makeObservedNode(overrides: Partial<ObservedNodeWatchSummary> = {}): ObservedNode {
  return {
    internal_id: '00000000-0000-4000-8000-000000000001',
    meshtastic_node_id: 100,
    node_id_str: '!00000064',
    mac_addr: null,
    long_name: 'Long',
    short_name: 'SN100',
    meshtastic_hw_model: null,
    meshtastic_public_key: null,
    last_heard: new Date('2026-04-21T12:00:00.000Z'),
    latest_position: null,
    ...overrides,
  } as ObservedNode;
}

function makeWatch(overrides: Partial<NodeWatch> & { node?: Partial<ObservedNodeWatchSummary> } = {}): NodeWatch {
  const { node: nodeOverrides, id: idOverride, ...rest } = overrides;
  const id = idOverride ?? 1;
  const node = makeObservedNode({
    internal_id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    meshtastic_node_id: 100 + id,
    short_name: `SN${id}`,
    ...nodeOverrides,
  });
  return {
    ...rest,
    id,
    observed_node: node as NodeWatch['observed_node'],
    offline_after: rest.offline_after ?? 3600,
    enabled: rest.enabled ?? true,
    offline_notifications_enabled: rest.offline_notifications_enabled ?? true,
    battery_notifications_enabled: rest.battery_notifications_enabled ?? false,
    created_at: rest.created_at ?? '2026-04-21T00:00:00Z',
  };
}

function renderTable(props: Partial<ComponentProps<typeof WatchedNodesTable>> & { watches?: NodeWatch[] } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const recentLastHeard = new Date(Date.now() - 15 * 60 * 1000);
  const watches =
    props.watches ??
    ([
      makeWatch({
        id: 1,
        node: {
          meshtastic_node_id: 1,
          internal_id: '00000000-0000-4000-8000-000000000001',
          node_id_str: '!00000001',
          short_name: 'OnlineN',
          last_heard: recentLastHeard,
          monitoring_offline_confirmed_at: null,
          monitoring_verification_started_at: null,
        },
      }),
      makeWatch({
        id: 2,
        node: {
          meshtastic_node_id: 2,
          internal_id: '00000000-0000-4000-8000-000000000001',
          node_id_str: '!00000002',
          short_name: 'OffN',
          monitoring_offline_confirmed_at: '2026-04-21T11:00:00Z',
          last_heard: new Date('2026-04-20T12:00:00.000Z'),
        },
      }),
    ] as NodeWatch[]);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WatchedNodesTable
          watches={watches}
          watchesQuery={{ isLoading: false, isError: false }}
          onOpenTraceroute={props.onOpenTraceroute ?? vi.fn()}
          onRequestTriggerTraceroute={props.onRequestTriggerTraceroute ?? vi.fn()}
          canTriggerTraceroute={props.canTriggerTraceroute ?? true}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('WatchedNodesTable', () => {
  beforeEach(() => {
    getTraceroutes.mockResolvedValue({ results: [], count: 0, next: null, previous: null });
  });

  it('renders Offline section before Online section', () => {
    renderTable();
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings[0]).toHaveTextContent(/^Offline/);
    expect(headings.map((h) => h.textContent)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Offline/), expect.stringMatching(/^Online/)])
    );
    const offlineIdx = headings.findIndex((h) => h.textContent?.startsWith('Offline'));
    const onlineIdx = headings.findIndex((h) => h.textContent?.startsWith('Online'));
    expect(offlineIdx).toBeLessThan(onlineIdx);
  });

  it('hides latest traceroutes for low-battery watches (same as online)', () => {
    const recent = new Date(Date.now() - 10 * 60 * 1000);
    renderTable({
      watches: [
        makeWatch({
          id: 1,
          node: {
            meshtastic_node_id: 1,
            short_name: 'LowBatt',
            last_heard: recent,
            monitoring_offline_confirmed_at: null,
            monitoring_verification_started_at: null,
            battery_alert_active: true,
          },
        }),
      ],
    });
    expect(screen.getByText(/Low battery watch — traceroute history is hidden/)).toBeInTheDocument();
    expect(screen.queryByText('Latest traceroutes (this target)')).not.toBeInTheDocument();
  });

  it('hides latest traceroutes table for online watches', () => {
    const recent = new Date(Date.now() - 10 * 60 * 1000);
    renderTable({
      watches: [
        makeWatch({
          id: 1,
          node: {
            meshtastic_node_id: 1,
            short_name: 'OnlyOnline',
            last_heard: recent,
            monitoring_offline_confirmed_at: null,
            monitoring_verification_started_at: null,
          },
        }),
      ],
    });
    expect(screen.getByText(/Node is currently online/)).toBeInTheDocument();
    expect(screen.queryByText('Latest traceroutes (this target)')).not.toBeInTheDocument();
  });

  it('loads traceroute rows for offline watches', async () => {
    const tr: AutoTraceRoute = {
      id: 50,
      source_node: {
        meshtastic_node_id: 200,
        short_name: 'SRC',
        node_id_str: '!c8',
        long_name: null,
        last_heard: null,
        owner: { id: 1, username: 'u' },
        constellation: { id: 1 },
        allow_auto_traceroute: true,
        position: { latitude: null, longitude: null },
      },
      target_node: makeObservedNode({ meshtastic_node_id: 2 }),
      trigger_type: 4,
      trigger_type_label: 'Node Watch',
      triggered_by: null,
      triggered_by_username: null,
      trigger_source: null,
      triggered_at: '2026-04-21T10:00:00Z',
      earliest_send_at: '2026-04-21T10:00:00Z',
      dispatched_at: '2026-04-21T10:00:00Z',
      dispatch_attempts: 0,
      dispatch_error: null,
      status: 'completed',
      route: [],
      route_back: [],
      raw_packet: null,
      completed_at: '2026-04-21T10:00:01Z',
      error_message: null,
    };
    getTraceroutes.mockResolvedValue({ results: [tr], count: 1, next: null, previous: null });

    renderTable({
      watches: [
        makeWatch({
          id: 2,
          node: {
            meshtastic_node_id: 2,
            short_name: 'OffOnly',
            monitoring_offline_confirmed_at: '2026-04-21T11:00:00Z',
          },
        }),
      ],
    });

    const offlineHeading = screen.getByRole('heading', { name: /Offline \(1\)/ });
    const section = offlineHeading.closest('section');
    expect(section).toBeTruthy();
    await waitFor(() => {
      expect(within(section!).getByText('SRC')).toBeInTheDocument();
    });
  });

  it('calls onRequestTriggerTraceroute when trigger button is clicked', async () => {
    const user = userEvent.setup();
    const onTrigger = vi.fn();
    renderTable({
      watches: [
        makeWatch({
          id: 3,
          node: {
            meshtastic_node_id: 3,
            short_name: 'Trig',
            monitoring_offline_confirmed_at: '2026-04-21T11:00:00Z',
          },
        }),
      ],
      onRequestTriggerTraceroute: onTrigger,
    });
    await user.click(screen.getByRole('button', { name: /Trigger traceroute/i }));
    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(onTrigger.mock.calls[0][0].meshtastic_node_id).toBe(3);
  });

  it('disables trigger button when canTriggerTraceroute is false', () => {
    const recent = new Date(Date.now() - 10 * 60 * 1000);
    renderTable({
      canTriggerTraceroute: false,
      watches: [
        makeWatch({
          id: 99,
          node: {
            meshtastic_node_id: 99,
            short_name: 'Solo',
            last_heard: recent,
            monitoring_offline_confirmed_at: null,
            monitoring_verification_started_at: null,
          },
        }),
      ],
    });
    expect(screen.getByRole('button', { name: /Trigger traceroute/i })).toBeDisabled();
  });
});
