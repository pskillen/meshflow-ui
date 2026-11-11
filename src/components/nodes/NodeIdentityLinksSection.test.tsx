import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { NodeIdentityLink, ObservedNode } from '@/lib/models';
import { MeshflowApi } from '@/lib/api/meshflow-api';
import { NodeIdentityLinksSection } from './NodeIdentityLinksSection';
import { IDENTITY_LINK_ERROR_CODES } from './identityLinkErrors';

const currentUser = vi.hoisted(() => ({ value: null as null | { id: number; is_staff?: boolean } }));

vi.mock('@/lib/auth/authService', () => ({
  authService: {
    getCurrentUser: () => currentUser.value,
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    refreshToken: vi.fn(),
    handleSessionExpired: vi.fn(),
    onSessionExpired: vi.fn(() => () => {}),
  },
  AuthEventType: { AUTH_TOKEN_REFRESHED: 'auth_token_refreshed' },
}));

vi.mock('@/lib/events/eventService', () => ({ eventService: { emit: vi.fn() } }));

// The real picker talks to the search API; a stub that "selects" a node is enough here.
vi.mock('@/components/NodeSearch', () => ({
  NodeSearch: ({
    displayValue,
    onNodeSelect,
  }: {
    displayValue?: string | null;
    onNodeSelect?: (id: number, n?: { node_id_str?: string; long_name?: string }) => void;
  }) =>
    displayValue ? (
      <span data-testid="picked">{displayValue}</span>
    ) : (
      <button type="button" onClick={() => onNodeSelect?.(0x5678ef01, { node_id_str: '!5678ef01', long_name: 'New one' })}>
        pick new node
      </button>
    ),
}));

const handlers = {
  list: vi.fn<() => unknown>(),
  declare: vi.fn<(id: string, body: unknown) => unknown>(),
  confirm: vi.fn<(id: string) => unknown>(),
  reject: vi.fn<(id: string) => unknown>(),
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

function failWith(status: number, data: unknown) {
  return () => {
    throw httpError({ url: '', method: 'post', headers: {} } as InternalAxiosRequestConfig, status, data);
  };
}

const api = new MeshflowApi({ baseUrl: 'http://localhost:8000', basePath: '/api', timeout: 1000, auth: { type: 'none' } });
(api as unknown as { axios: ReturnType<typeof axios.create> }).axios.defaults.adapter = async (config) => {
  const url = config.url ?? '';
  // A little latency, so a double-click's second click lands while the first request is still in flight.
  await new Promise((r) => setTimeout(r, 40));
  let data: unknown;
  let m: RegExpMatchArray | null;
  if (config.method === 'get' && url.endsWith('/identity-links/')) {
    data = handlers.list();
  } else if (config.method === 'post' && url.endsWith('/identity-links/') && url.includes('observed-nodes')) {
    data = handlers.declare(url, JSON.parse(config.data));
  } else if (config.method === 'post' && (m = url.match(/identity-links\/(\d+)\/confirm/))) {
    data = handlers.confirm(m[1]);
  } else if (config.method === 'post' && (m = url.match(/identity-links\/(\d+)\/reject/))) {
    data = handlers.reject(m[1]);
  } else {
    throw httpError(config, 404, { code: 'not_found', detail: 'Not found.' });
  }
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};

vi.mock('@/hooks/api/useApi', () => ({
  useMeshflowApi: () => api,
  useMeshtasticApi: () => api,
}));

const THIS_NODE = '11111111-1111-4111-8111-111111111111';
const OLD_NODE = '22222222-2222-4222-8222-222222222222';

const node = (overrides: Partial<ObservedNode> = {}) =>
  ({
    internal_id: THIS_NODE,
    protocol: 1,
    meshtastic_node_id: 0x1234abcd,
    node_id_str: '!1234abcd',
    short_name: 'OLD1',
    long_name: 'Old radio',
    owner: { id: 7, username: 'me' },
    ...overrides,
  }) as ObservedNode;

function makeLink(overrides: Partial<NodeIdentityLink> = {}): NodeIdentityLink {
  return {
    id: 5,
    old: {
      internal_id: THIS_NODE,
      protocol: 1,
      meshtastic_node_id: 0x1234abcd,
      node_id_str: '!1234abcd',
      long_name: 'Old radio',
    },
    new: {
      internal_id: OLD_NODE,
      protocol: 1,
      meshtastic_node_id: 0x5678ef01,
      node_id_str: '!5678ef01',
      long_name: 'New radio',
    },
    evidence: 'public_key',
    state: 'suggested',
    created_at: '2026-11-01T12:00:00Z',
    reviewed_at: null,
    can_confirm: true,
    can_reject: true,
    ...overrides,
  };
}

function renderSection(n: ObservedNode = node()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NodeIdentityLinksSection node={n} internalId={THIS_NODE} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { invalidate };
}

describe('NodeIdentityLinksSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser.value = { id: 7 };
    handlers.list.mockReturnValue([makeLink()]);
  });

  it('renders nothing and sends no request for a guest', async () => {
    currentUser.value = null;
    renderSection();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('node-identity-links')).toBeNull();
    expect(handlers.list).not.toHaveBeenCalled();
  });

  it('renders nothing and sends no request for a signed-in user who is not the owner', async () => {
    currentUser.value = { id: 99 };
    renderSection();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('node-identity-links')).toBeNull();
    expect(handlers.list).not.toHaveBeenCalled();
  });

  it('renders nothing and sends no request for a MeshCore node, even for its owner', async () => {
    renderSection(node({ protocol: 2 }));
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByTestId('node-identity-links')).toBeNull();
    expect(handlers.list).not.toHaveBeenCalled();
  });

  it('shows the section to staff on a node they do not own', async () => {
    currentUser.value = { id: 99, is_staff: true };
    renderSection(node({ owner: null }));
    expect(await screen.findByTestId('node-identity-links')).toBeTruthy();
  });

  it('shows a suggested link in plain words with both buttons', async () => {
    renderSection();
    const row = await screen.findByTestId('node-identity-link');
    expect(row.textContent).toContain('Same radio as node !5678ef01 (New radio)');
    expect(row.textContent).toContain('same public key');
    expect(within(row).getByText('suggested by Meshflow')).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Confirm' })).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Not the same radio' })).toBeTruthy();
  });

  it('buttons follow can_confirm and can_reject', async () => {
    handlers.list.mockReturnValue([makeLink({ state: 'confirmed', can_confirm: false, can_reject: true })]);
    renderSection();
    const row = await screen.findByTestId('node-identity-link');
    expect(within(row).queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(within(row).getByRole('button', { name: 'Not the same radio' })).toBeTruthy();
    expect(within(row).getByText('confirmed')).toBeTruthy();
  });

  it('lists suggested first and rejected last', async () => {
    handlers.list.mockReturnValue([
      makeLink({ id: 1, state: 'rejected', can_confirm: false, can_reject: false }),
      makeLink({ id: 2, state: 'confirmed', can_confirm: false }),
      makeLink({ id: 3, state: 'suggested' }),
    ]);
    renderSection();
    await screen.findAllByTestId('node-identity-link');
    const states = screen.getAllByTestId('node-identity-link').map((r) => r.getAttribute('data-state'));
    expect(states).toEqual(['suggested', 'confirmed', 'rejected']);
  });

  it('on the newer node it says the other node is the older number', async () => {
    const l = makeLink();
    handlers.list.mockReturnValue([{ ...l, old: l.new, new: { ...l.old, internal_id: THIS_NODE } }]);
    renderSection();
    const row = await screen.findByTestId('node-identity-link');
    expect(row.textContent).toContain('Same radio as node !5678ef01');
    expect(row.textContent).toContain('the older number');
  });

  it('Confirm calls the api once even on a double-click, then invalidates', async () => {
    handlers.confirm.mockReturnValue(makeLink({ state: 'confirmed' }));
    const { invalidate } = renderSection();
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Confirm' });
    await user.dblClick(button);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['nodes'] }));
    expect(handlers.confirm).toHaveBeenCalledTimes(1);
    expect(handlers.confirm).toHaveBeenCalledWith('5');
  });

  it('rejecting asks first, then calls the api once', async () => {
    handlers.reject.mockReturnValue(makeLink({ state: 'rejected' }));
    const { invalidate } = renderSection();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Not the same radio' }));
    expect(handlers.reject).not.toHaveBeenCalled();
    const yes = await screen.findByRole('button', { name: 'Yes, not the same radio' });
    await user.dblClick(yes);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['nodes'] }));
    expect(handlers.reject).toHaveBeenCalledTimes(1);
    expect(handlers.reject).toHaveBeenCalledWith('5');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Yes, not the same radio' })).toBeNull());
  });

  it('cancelling the reject step sends nothing', async () => {
    renderSection();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Not the same radio' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(handlers.reject).not.toHaveBeenCalled();
  });

  describe('every error code has plain text', () => {
    it.each(IDENTITY_LINK_ERROR_CODES)('confirm: %s', async (code) => {
      handlers.confirm.mockImplementation(failWith(400, { code, detail: 'RAW SERVER TEXT' }));
      renderSection();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Confirm' }));
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).not.toContain('RAW SERVER TEXT');
      expect(alert.textContent).not.toContain(code);
      expect(alert.textContent!.length).toBeGreaterThan(10);
    });
  });

  describe('a failed reject shows its error inside the open dialog', () => {
    it.each(IDENTITY_LINK_ERROR_CODES)('reject: %s', async (code) => {
      handlers.reject.mockImplementation(failWith(409, { code, detail: 'RAW SERVER TEXT' }));
      renderSection();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Not the same radio' }));
      await user.click(await screen.findByRole('button', { name: 'Yes, not the same radio' }));
      const dialog = screen.getByRole('dialog');
      const alert = await within(dialog).findByRole('alert');
      expect(alert.textContent).not.toContain('RAW SERVER TEXT');
      expect(alert.textContent).not.toContain(code);
      expect(alert.textContent!.length).toBeGreaterThan(10);
      // The dialog stays open and the error is the only alert a screen reader can reach.
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(within(dialog).getByRole('button', { name: 'Yes, not the same radio' })).toBeTruthy();
    });

    it('shows the error in the row once the dialog is closed', async () => {
      handlers.reject.mockImplementation(failWith(409, { code: 'invalid_state', detail: 'x' }));
      renderSection();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Not the same radio' }));
      await user.click(await screen.findByRole('button', { name: 'Yes, not the same radio' }));
      await within(screen.getByRole('dialog')).findByRole('alert');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect((await screen.findByRole('alert')).textContent).toContain('already reviewed');
    });
  });

  it('a rejected row does not read "Same radio as"', async () => {
    handlers.list.mockReturnValue([makeLink({ state: 'rejected', can_confirm: false, can_reject: false })]);
    renderSection();
    const row = await screen.findByTestId('node-identity-link');
    expect(row.textContent).toContain('Not the same radio as node');
    expect(row.textContent).not.toContain('Same radio as');
  });

  it('shows the server detail for an unknown code', async () => {
    handlers.confirm.mockImplementation(failWith(400, { code: 'brand_new', detail: 'Something new happened.' }));
    renderSection();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Something new happened.');
  });

  describe('Declare a replacement', () => {
    async function openAndPick() {
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Declare a replacement' }));
      await user.click(await screen.findByRole('button', { name: 'pick new node' }));
      return user;
    }

    it('is disabled until a node is picked, hints that both must be theirs, then posts the !hex id', async () => {
      handlers.list.mockReturnValue([]);
      handlers.declare.mockReturnValue(makeLink({ state: 'confirmed', evidence: 'declared' }));
      const { invalidate } = renderSection();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Declare a replacement' }));
      expect(screen.getByText(/Both nodes must be yours/)).toBeTruthy();
      expect((screen.getByRole('button', { name: 'Declare replacement' }) as HTMLButtonElement).disabled).toBe(true);
      await user.click(screen.getByRole('button', { name: 'pick new node' }));
      expect(screen.getByTestId('picked').textContent).toBe('!5678ef01 (New one)');
      await user.dblClick(screen.getByRole('button', { name: 'Declare replacement' }));
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['nodes'] }));
      expect(handlers.declare).toHaveBeenCalledTimes(1);
      expect(handlers.declare.mock.calls[0][0]).toContain(`/observed-nodes/${THIS_NODE}/identity-links/`);
      expect(handlers.declare.mock.calls[0][1]).toEqual({ new_node: '!5678ef01' });
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Declare replacement' })).toBeNull());
    });

    it('staff get a different hint', async () => {
      currentUser.value = { id: 99, is_staff: true };
      renderSection(node({ owner: null }));
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Declare a replacement' }));
      expect(screen.getByText(/Staff can link any two nodes/)).toBeTruthy();
    });

    it.each(IDENTITY_LINK_ERROR_CODES)('shows plain text for %s and stays open', async (code) => {
      handlers.declare.mockImplementation(failWith(400, { code, detail: 'RAW SERVER TEXT' }));
      renderSection();
      const user = await openAndPick();
      await user.click(screen.getByRole('button', { name: 'Declare replacement' }));
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).not.toContain('RAW SERVER TEXT');
      expect(alert.textContent).not.toContain(code);
      expect(screen.getByRole('button', { name: 'Declare replacement' })).toBeTruthy();
    });
  });
});
