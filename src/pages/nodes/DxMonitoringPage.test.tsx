import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DxEventDetail, DxEventListItem } from '@/lib/models';
import { useDxEventDetail, useDxEvents, useDxNotificationSettings } from '@/hooks/api/useDxMonitoring';
import DxMonitoringPage from './DxMonitoringPage';

const getCurrentUser = vi.fn();

vi.mock('@/lib/auth/authService', () => ({
  authService: {
    getCurrentUser: () => getCurrentUser(),
  },
}));

const emptyPage = { count: 0, next: null, previous: null, results: [] as DxEventListItem[] };

vi.mock('@/hooks/api/useDxMonitoring', () => ({
  useDxEvents: vi.fn(),
  useDxActiveEventCount: vi.fn(() => ({ isLoading: false, data: 0 })),
  useDxRecentEventCount: vi.fn(() => ({ isLoading: false, data: 0 })),
  useDxEventDetail: vi.fn(),
  useDxNodeExclusionMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDxNotificationSettings: vi.fn(),
}));

const useDxEventsMock = vi.mocked(useDxEvents);
const useDxEventDetailMock = vi.mocked(useDxEventDetail);
const useDxNotificationSettingsMock = vi.mocked(useDxNotificationSettings);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DxMonitoringPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DxMonitoringPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockReturnValue({ id: 1, username: 'staff', is_staff: true });
    useDxEventsMock.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      data: emptyPage,
    } as ReturnType<typeof useDxEvents>);
    useDxEventDetailMock.mockImplementation(
      ((id: string | null | undefined, enabled?: boolean) => {
        if (!enabled || !id) {
          return {
            isLoading: false,
            isSuccess: false,
            isError: false,
            error: null,
            data: undefined,
          } as ReturnType<typeof useDxEventDetail>;
        }
        return {
          isLoading: false,
          isSuccess: false,
          isError: false,
          error: null,
          data: undefined,
        } as ReturnType<typeof useDxEventDetail>;
      }) as typeof useDxEventDetail
    );
    useDxNotificationSettingsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      data: {
        enabled: true,
        all_categories: true,
        categories: [
          'new_distant_node',
          'returned_dx_node',
          'distant_observation',
          'traceroute_distant_hop',
          'confirmed_event',
          'event_closed_summary',
        ],
        discord: { status: 'verified', can_receive_dms: true },
      },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDxNotificationSettings>);
  });

  it('shows staff-only message when user is not staff', () => {
    getCurrentUser.mockReturnValue({ id: 2, username: 'user', is_staff: false });
    renderPage();
    expect(screen.getByText('DX monitoring')).toBeInTheDocument();
    expect(screen.getByText(/staff only/i)).toBeInTheDocument();
  });

  it('renders dashboard heading for staff', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /DX monitoring/i })).toBeInTheDocument();
    expect(screen.getByText(/Detection events and evidence/i)).toBeInTheDocument();
  });

  it('shows profile link and DX notification status for staff', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /Profile: DX notifications/i })).toHaveAttribute(
      'href',
      '/user#dx-notifications'
    );
    const bar = screen.getByRole('link', { name: /Profile: DX notifications/i }).closest('.flex');
    expect(bar?.textContent).toMatch(/Your DX DMs:/);
    expect(bar?.textContent).toMatch(/DX DMs:\s*On/);
  });

  it('shows exploration attempt counts on the list', () => {
    const destination: DxEventListItem['destination'] = {
      internal_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      meshtastic_node_id: 123,
      node_id_str: '!0000007b',
      short_name: 'T',
      long_name: 'Target',
      dx_metadata: { exclude_from_detection: false, exclude_notes: '', updated_at: null },
    };
    const row: DxEventListItem = {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      constellation: { id: 1, name: 'TestC' },
      destination,
      reason_code: 'new_distant_node',
      state: 'active',
      first_observed_at: '2026-01-15T10:00:00.000Z',
      last_observed_at: '2026-01-15T10:00:00.000Z',
      active_until: '2026-01-16T10:00:00.000Z',
      observation_count: 0,
      last_observer: null,
      best_distance_km: 10,
      last_distance_km: 10,
      metadata: {},
      evidence_count: 0,
      exploration_attempt_count: 4,
    };
    useDxEventsMock.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      data: { count: 1, next: null, previous: null, results: [row] },
    } as ReturnType<typeof useDxEvents>);
    renderPage();
    expect(screen.getByRole('columnheader', { name: 'Exploration' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '4' })).toBeInTheDocument();
  });

  it('shows exploration evidence, baseline messaging, and skip reasons in the detail modal', async () => {
    const user = userEvent.setup();
    const destination: DxEventListItem['destination'] = {
      internal_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      meshtastic_node_id: 123,
      node_id_str: '!0000007b',
      short_name: 'T',
      long_name: 'Target',
      dx_metadata: { exclude_from_detection: false, exclude_notes: '', updated_at: null },
    };
    const hop = {
      internal_id: destination.internal_id,
      meshtastic_node_id: destination.meshtastic_node_id,
      node_id_str: destination.node_id_str,
      short_name: destination.short_name,
      long_name: destination.long_name,
    };
    const listRow: DxEventListItem = {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      constellation: { id: 1, name: 'TestC' },
      destination,
      reason_code: 'new_distant_node',
      state: 'active',
      first_observed_at: '2026-01-15T10:00:00.000Z',
      last_observed_at: '2026-01-15T10:00:00.000Z',
      active_until: '2026-01-16T10:00:00.000Z',
      observation_count: 0,
      last_observer: null,
      best_distance_km: null,
      last_distance_km: null,
      metadata: {},
      evidence_count: 0,
      exploration_attempt_count: 2,
    };
    const detail: DxEventDetail = {
      ...listRow,
      observations: [],
      exploration_summary: {
        total: 2,
        pending: 0,
        completed: 1,
        failed: 0,
        skipped: 1,
        baseline_linked_rows: 1,
      },
      traceroute_explorations: [
        {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          outcome: 'skipped',
          skip_reason: 'no_eligible_source',
          metadata: {},
          link_kind: '',
          created_at: '2026-01-15T10:00:00.000Z',
          updated_at: '2026-01-15T10:00:00.000Z',
          source_node: null,
          destination: hop,
          auto_traceroute: null,
        },
        {
          id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          outcome: 'completed',
          skip_reason: '',
          metadata: { link_kind: 'new_node_baseline', route_hops: 2 },
          link_kind: 'new_node_baseline',
          created_at: '2026-01-15T10:05:00.000Z',
          updated_at: '2026-01-15T10:05:00.000Z',
          source_node: {
            internal_id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            meshtastic_node_id: 456,
            node_id_str: '!000001c8',
            name: 'Source MN',
          },
          destination: hop,
          auto_traceroute: {
            id: 99,
            status: 'completed',
            trigger_type: 6,
            trigger_type_label: 'New node baseline',
            trigger_source: null,
            triggered_at: '2026-01-15T10:05:00.000Z',
            earliest_send_at: '2026-01-15T10:05:00.000Z',
            dispatched_at: '2026-01-15T10:05:01.000Z',
            completed_at: '2026-01-15T10:06:00.000Z',
            error_message: null,
          },
        },
      ],
    };
    useDxEventsMock.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      data: { count: 1, next: null, previous: null, results: [listRow] },
    } as ReturnType<typeof useDxEvents>);
    useDxEventDetailMock.mockImplementation(((id: string | null | undefined, enabled?: boolean) => {
      if (!enabled || !id) {
        return {
          isLoading: false,
          isSuccess: false,
          isError: false,
          error: null,
          data: undefined,
        } as ReturnType<typeof useDxEventDetail>;
      }
      return {
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: null,
        data: detail,
      } as ReturnType<typeof useDxEventDetail>;
    }) as typeof useDxEventDetail);

    renderPage();
    await user.click(screen.getByRole('button', { name: 'Detail' }));
    expect(await screen.findByText(/^Exploration evidence$/)).toBeInTheDocument();
    expect(screen.getByText(/Baseline-linked rows 1/i)).toBeInTheDocument();
    expect(
      screen.getByText(/new-node baseline traceroute already covered/i, { exact: false })
    ).toBeInTheDocument();
    expect(screen.getByText('No eligible source')).toBeInTheDocument();
    expect(screen.getByText('New node baseline')).toBeInTheDocument();
  });

  it('shows empty exploration copy when there are no attempt rows', async () => {
    const user = userEvent.setup();
    const destination: DxEventListItem['destination'] = {
      internal_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      meshtastic_node_id: 123,
      node_id_str: '!0000007b',
      short_name: 'T',
      long_name: 'Target',
      dx_metadata: { exclude_from_detection: false, exclude_notes: '', updated_at: null },
    };
    const listRow: DxEventListItem = {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      constellation: { id: 1, name: 'TestC' },
      destination,
      reason_code: 'new_distant_node',
      state: 'active',
      first_observed_at: '2026-01-15T10:00:00.000Z',
      last_observed_at: '2026-01-15T10:00:00.000Z',
      active_until: '2026-01-16T10:00:00.000Z',
      observation_count: 0,
      last_observer: null,
      best_distance_km: null,
      last_distance_km: null,
      metadata: {},
      evidence_count: 0,
      exploration_attempt_count: 0,
    };
    const detail: DxEventDetail = {
      ...listRow,
      observations: [],
      exploration_summary: {
        total: 0,
        pending: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        baseline_linked_rows: 0,
      },
      traceroute_explorations: [],
    };
    useDxEventsMock.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      data: { count: 1, next: null, previous: null, results: [listRow] },
    } as ReturnType<typeof useDxEvents>);
    useDxEventDetailMock.mockImplementation(((id: string | null | undefined, enabled?: boolean) => {
      if (!enabled || !id) {
        return {
          isLoading: false,
          isSuccess: false,
          isError: false,
          error: null,
          data: undefined,
        } as ReturnType<typeof useDxEventDetail>;
      }
      return {
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: null,
        data: detail,
      } as ReturnType<typeof useDxEventDetail>;
    }) as typeof useDxEventDetail);

    renderPage();
    await user.click(screen.getByRole('button', { name: 'Detail' }));
    expect(
      await screen.findByText(/No exploration attempts recorded for this event/i)
    ).toBeInTheDocument();
  });
});
