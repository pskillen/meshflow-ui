import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { FeederIdentityEvent } from '@/lib/models';
import { MeshflowApi } from '@/lib/api/meshflow-api';
import { FeederIdentityNotices } from './FeederIdentityNotices';

vi.mock('@/lib/auth/authService', () => ({
  authService: {
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    refreshToken: vi.fn(),
    handleSessionExpired: vi.fn(),
    onSessionExpired: vi.fn(() => () => {}),
  },
  AuthEventType: { AUTH_TOKEN_REFRESHED: 'auth_token_refreshed' },
}));

vi.mock('@/lib/events/eventService', () => ({ eventService: { emit: vi.fn() } }));

/**
 * The real `MeshflowApi` (so the response interceptor in base.ts shapes errors exactly as in the app) on a stubbed
 * axios adapter. Tests set `handlers` per route; a handler may return data or throw an HTTP status via `httpError`.
 */
const handlers = {
  list: vi.fn<() => unknown>(),
  acknowledge: vi.fn<(id: string) => unknown>(),
  repoint: vi.fn<(id: string) => unknown>(),
};

function httpError(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined, {
    status,
    statusText: 'Error',
    headers: {},
    config,
    data,
  });
}

const api = new MeshflowApi({ baseUrl: 'http://localhost:8000', basePath: '/api', timeout: 1000, auth: { type: 'none' } });
(api as unknown as { axios: ReturnType<typeof axios.create> }).axios.defaults.adapter = async (config) => {
  const url = config.url ?? '';
  let data: unknown;
  if (config.method === 'get' && url.startsWith('/nodes/managed-node-identity-events/')) {
    data = handlers.list();
  } else if (config.method === 'post' && /managed-node-identity-events\/(\d+)\/acknowledge/.test(url)) {
    data = handlers.acknowledge(url.match(/events\/(\d+)\//)![1]);
  } else if (config.method === 'post' && /managed-nodes\/([^/]+)\/repoint-meshtastic-id/.test(url)) {
    data = handlers.repoint(url.match(/managed-nodes\/([^/]+)\//)![1]);
  } else {
    throw httpError(config, 404, { detail: 'Not found.' });
  }
  if (data instanceof Error) throw data;
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};

vi.mock('@/hooks/api/useApi', () => ({
  useMeshflowApi: () => api,
  useMeshtasticApi: () => api,
}));

/** Make a handler fail with an HTTP error, to be run through the interceptor. */
function failWith(status: number, data: unknown) {
  return () => {
    throw httpError({ url: '', method: 'post', headers: {} } as InternalAxiosRequestConfig, status, data);
  };
}

const MANAGED = '11111111-1111-4111-8111-111111111111';

function makeEvent(overrides: Partial<FeederIdentityEvent> = {}): FeederIdentityEvent {
  return {
    id: 1,
    managed_node: MANAGED,
    managed_node_name: 'Roof Feeder',
    old_meshtastic_node_id: 0x1234abcd,
    old_node_id_str: '!1234abcd',
    new_meshtastic_node_id: 0x5678ef01,
    new_node_id_str: '!5678ef01',
    outcome: 'auto_updated',
    reason: null,
    needs_action: false,
    created_at: '2026-04-21T12:00:00Z',
    resolved_at: null,
    acknowledged_at: null,
    ...overrides,
  };
}

function page(results: FeederIdentityEvent[]) {
  return { count: results.length, next: null, previous: null, results };
}

function renderNotices(owned: string[] = [MANAGED]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FeederIdentityNotices ownedManagedNodeIds={owned} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const flaggedEvent = (overrides: Partial<FeederIdentityEvent> = {}) =>
  makeEvent({ outcome: 'flagged', needs_action: true, reason: 'shared_key', ...overrides });

describe('FeederIdentityNotices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an auto-updated event with Dismiss only, as a status', async () => {
    handlers.list.mockReturnValue(page([makeEvent()]));
    renderNotices();

    expect(await screen.findByText('Feeder number changed')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/It keeps its history and API key/)).toBeInTheDocument();
    expect(screen.getByText('!1234abcd')).toBeInTheDocument();
    expect(screen.getByText('!5678ef01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss notice for Roof Feeder/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Re-point/ })).not.toBeInTheDocument();
    // Auto-updated: the feeder is stored under the new number.
    expect(screen.getByRole('link', { name: 'View feeder Roof Feeder' })).toHaveAttribute('href', '/nodes/!5678ef01');
  });

  it('renders a flagged event needing action with Re-point and Dismiss, linking the old number', async () => {
    handlers.list.mockReturnValue(page([flaggedEvent()]));
    renderNotices();

    expect(await screen.findByText('Feeder needs review')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/reported/)).toHaveTextContent('Roof Feeder reported !5678ef01 but is stored as !1234abcd.');
    expect(screen.getByText('Its public key is also used by another node.')).toBeInTheDocument();
    expect(screen.getByText(/still being ingested/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-point to !5678ef01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View feeder/ })).toHaveAttribute('href', '/nodes/!1234abcd');
  });

  it('keeps the destructive border, icon and title but uses foreground text for the body', async () => {
    handlers.list.mockReturnValue(page([flaggedEvent()]));
    renderNotices();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveClass('border-destructive/50', 'text-foreground');
    expect(alert).not.toHaveClass('text-destructive');
    expect(screen.getByText('Feeder needs review')).toHaveClass('text-destructive');
  });

  it('reads a resolved flag as resolved, not as a plain change', async () => {
    handlers.list.mockReturnValue(page([flaggedEvent({ needs_action: false, resolved_at: '2026-04-22T00:00:00Z' })]));
    renderNotices();

    expect(await screen.findByText('Feeder review resolved')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/was flagged for review and has since been resolved/);
    expect(screen.queryByText(/changed from/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Re-point/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View feeder/ })).toHaveAttribute('href', '/nodes/!1234abcd');
  });

  it('renders a manual change as neutral with Dismiss only', async () => {
    handlers.list.mockReturnValue(page([makeEvent({ outcome: 'manual' })]));
    renderNotices();

    expect(await screen.findByText('Feeder number changed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Re-point/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View feeder/ })).toHaveAttribute('href', '/nodes/!5678ef01');
  });

  it('says "a different public key" when a key_mismatch reports the same number', async () => {
    handlers.list.mockReturnValue(
      page([
        flaggedEvent({
          reason: 'key_mismatch',
          new_meshtastic_node_id: 0x1234abcd,
          new_node_id_str: '!1234abcd',
        }),
      ])
    );
    renderNotices();

    expect(await screen.findByText(/reported a different public key for/)).toHaveTextContent(
      'Roof Feeder reported a different public key for !1234abcd.'
    );
    expect(screen.queryByText(/but is stored as/)).not.toBeInTheDocument();
  });

  it('hides Re-point for number_collision', async () => {
    handlers.list.mockReturnValue(page([flaggedEvent({ reason: 'number_collision' })]));
    renderNotices();

    expect(await screen.findByText('Feeder needs review')).toBeInTheDocument();
    expect(screen.getByText(/Another feeder already uses that number/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Re-point/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss/ })).toBeInTheDocument();
  });

  it.each(['key_mismatch', 'crc_mismatch'] as const)(
    'hides Re-point for %s and says to contact an administrator',
    async (reason) => {
      handlers.list.mockReturnValue(page([flaggedEvent({ reason })]));
      renderNotices();

      expect(await screen.findByText('Feeder needs review')).toBeInTheDocument();
      expect(screen.getByText(/Contact an administrator/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Re-point/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dismiss/ })).toBeInTheDocument();
    }
  );

  it('ignores key_changed audit events', async () => {
    handlers.list.mockReturnValue(page([makeEvent({ outcome: 'key_changed' })]));
    const { container } = renderNotices();

    await waitFor(() => expect(handlers.list).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only notices for the user's own feeders (staff get everyone's)", async () => {
    handlers.list.mockReturnValue(
      page([
        makeEvent({ id: 1, managed_node_name: 'Mine' }),
        makeEvent({ id: 2, managed_node: '22222222-2222-4222-8222-222222222222', managed_node_name: 'Someone Else' }),
      ])
    );
    renderNotices();

    expect(await screen.findByText(/^Mine changed/)).toBeInTheDocument();
    expect(screen.queryByText(/Someone Else/)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('feeder-identity-notice')).toHaveLength(1);
  });

  it('renders nothing when every event belongs to someone else', async () => {
    handlers.list.mockReturnValue(page([makeEvent({ managed_node: '22222222-2222-4222-8222-222222222222' })]));
    const { container } = renderNotices();

    await waitFor(() => expect(handlers.list).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });

  // These go through MeshflowApi, so the errors have the shape the interceptor gives them ({ message, status, data }).
  it.each([
    [403, 'repoint_not_proven', /can't be confirmed from the feeder's stored public key/],
    [409, 'repoint_target_key_mismatch', /different public key/],
    [409, 'repoint_target_claimed', /belongs to another user/],
    [409, 'number_collision', /Another feeder already uses that number/],
  ])('shows a plain message when re-point fails with %s %s', async (status, code, message) => {
    handlers.list.mockReturnValue(page([flaggedEvent()]));
    handlers.repoint.mockImplementation(failWith(status, { code, detail: 'raw server detail' }));
    renderNotices();

    await userEvent.click(await screen.findByRole('button', { name: 'Re-point to !5678ef01' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm re-point' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText('raw server detail')).not.toBeInTheDocument();
    expect(screen.getByText('Re-point feeder?')).toBeInTheDocument();
  });

  it("shows the API's own message in the dialog for a code it doesn't know (400)", async () => {
    handlers.list.mockReturnValue(page([flaggedEvent({ reason: 'key_not_reported' })]));
    handlers.repoint.mockImplementation(
      failWith(400, { code: 'already_current', error: 'Another feeder already uses !5678ef01.' })
    );
    renderNotices();

    await userEvent.click(await screen.findByRole('button', { name: 'Re-point to !5678ef01' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm re-point' }));

    expect(await screen.findByText('Another feeder already uses !5678ef01.')).toBeInTheDocument();
    expect(screen.getByText('Re-point feeder?')).toBeInTheDocument();
  });

  it('shows a generic message when the failure has no usable body', async () => {
    handlers.list.mockReturnValue(page([flaggedEvent()]));
    handlers.repoint.mockImplementation(failWith(404, undefined));
    renderNotices();

    await userEvent.click(await screen.findByRole('button', { name: 'Re-point to !5678ef01' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm re-point' }));

    expect(await screen.findByText('Could not re-point this feeder. Try again.')).toBeInTheDocument();
  });

  it('keeps the dialog error in foreground text', async () => {
    handlers.list.mockReturnValue(page([flaggedEvent()]));
    handlers.repoint.mockImplementation(failWith(403, { code: 'repoint_not_proven' }));
    renderNotices();

    await userEvent.click(await screen.findByRole('button', { name: 'Re-point to !5678ef01' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm re-point' }));

    const message = await screen.findByText(/can't be confirmed/);
    expect(message.closest('[role="alert"]')).toHaveClass('border-destructive/50', 'text-foreground');
  });

  it('sends one re-point POST when Confirm is double-clicked', async () => {
    const event = flaggedEvent({ reason: 'key_not_reported' });
    handlers.list.mockReturnValueOnce(page([event])).mockReturnValue(page([]));
    handlers.repoint.mockReturnValue(event);
    renderNotices();

    await userEvent.click(await screen.findByRole('button', { name: 'Re-point to !5678ef01' }));
    const confirm = await screen.findByRole('button', { name: 'Confirm re-point' });
    // Two clicks in the same tick, before React re-renders with isPending.
    act(() => {
      confirm.click();
      confirm.click();
    });

    await waitFor(() => expect(screen.queryByText('Feeder needs review')).not.toBeInTheDocument());
    expect(handlers.repoint).toHaveBeenCalledTimes(1);
  });

  it('Dismiss acknowledges the event and the row disappears after refetch', async () => {
    handlers.list.mockReturnValueOnce(page([makeEvent({ id: 42 })])).mockReturnValue(page([]));
    handlers.acknowledge.mockReturnValue(makeEvent({ id: 42 }));
    renderNotices();

    await userEvent.click(await screen.findByRole('button', { name: /Dismiss/ }));

    expect(handlers.acknowledge).toHaveBeenCalledWith('42');
    await waitFor(() => expect(screen.queryByText('Feeder number changed')).not.toBeInTheDocument());
  });

  it('sends one acknowledge POST when Dismiss is double-clicked', async () => {
    handlers.list.mockReturnValueOnce(page([makeEvent({ id: 42 })])).mockReturnValue(page([]));
    handlers.acknowledge.mockReturnValue(makeEvent({ id: 42 }));
    renderNotices();

    const dismiss = await screen.findByRole('button', { name: /Dismiss/ });
    act(() => {
      dismiss.click();
      dismiss.click();
    });

    await waitFor(() => expect(screen.queryByText('Feeder number changed')).not.toBeInTheDocument());
    expect(handlers.acknowledge).toHaveBeenCalledTimes(1);
  });

  it('says so when Dismiss fails and keeps the notice', async () => {
    handlers.list.mockReturnValue(page([makeEvent({ id: 42 })]));
    handlers.acknowledge.mockImplementation(failWith(500, { detail: 'boom' }));
    renderNotices();

    await userEvent.click(await screen.findByRole('button', { name: /Dismiss/ }));

    expect(await screen.findByText('Could not dismiss this notice. Try again.')).toBeInTheDocument();
    expect(screen.getByText('Feeder number changed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss/ })).toBeEnabled();
  });

  it('Re-point confirms, then calls the endpoint with the internal id', async () => {
    const event = flaggedEvent({ reason: 'key_not_reported' });
    handlers.list.mockReturnValueOnce(page([event])).mockReturnValue(page([]));
    handlers.repoint.mockReturnValue(event);
    renderNotices();

    await userEvent.click(await screen.findByRole('button', { name: 'Re-point to !5678ef01' }));
    expect(handlers.repoint).not.toHaveBeenCalled();
    expect(await screen.findByText('Re-point feeder?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm re-point' }));

    expect(handlers.repoint).toHaveBeenCalledWith(event.managed_node);
    await waitFor(() => expect(screen.queryByText('Feeder needs review')).not.toBeInTheDocument());
  });

  it('shows 5 notices and "and 1 more" for six events, newest first', async () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      makeEvent({ id: i + 1, managed_node_name: `Feeder ${i + 1}`, created_at: `2026-04-2${i}T12:00:00Z` })
    );
    handlers.list.mockReturnValue(page(events));
    renderNotices();

    await screen.findAllByText('Feeder number changed');
    expect(screen.getAllByTestId('feeder-identity-notice')).toHaveLength(5);
    expect(screen.getByText('and 1 more')).toBeInTheDocument();
    expect(screen.getByText(/^Feeder 6 changed/)).toBeInTheDocument();
    expect(screen.queryByText(/^Feeder 1 changed/)).not.toBeInTheDocument();
  });

  it('counts events beyond the first page in "and N more"', async () => {
    const events = Array.from({ length: 5 }, (_, i) => makeEvent({ id: i + 1, managed_node_name: `Feeder ${i + 1}` }));
    handlers.list.mockReturnValue({ count: 12, next: 'http://x/?page=2', previous: null, results: events });
    renderNotices();

    await screen.findAllByText('Feeder number changed');
    expect(screen.getByText('and 7 more')).toBeInTheDocument();
  });

  it('renders nothing and does not retry when the list call 404s, even if the client defaults to retrying', async () => {
    handlers.list.mockImplementation(failWith(404, { detail: 'Not found.' }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1 } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <FeederIdentityNotices ownedManagedNodeIds={[MANAGED]} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => expect(handlers.list).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 100));
    expect(handlers.list).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are no events', async () => {
    handlers.list.mockReturnValue(page([]));
    const { container } = renderNotices();

    await waitFor(() => expect(handlers.list).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
