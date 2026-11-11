import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { NodeIdentityRef, ObservedNode } from '@/lib/models';
import { MeshflowApi } from '@/lib/api/meshflow-api';
import { ClaimFromPreviousButton } from './ClaimFromPreviousButton';
import { NodeIdentityBanner } from './NodeIdentityBanner';
import { MyNodeCard } from './MyNodeCard';

const currentUser = vi.hoisted(() => ({ value: { id: 7 } as null | { id: number } }));

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
vi.mock('@/components/nodes/MeshWatchControls', () => ({ MeshWatchControls: () => <div /> }));

const NEW_ID = '22222222-2222-4222-8222-222222222222';

const handlers = {
  claim: vi.fn<(url: string) => unknown>(),
  getNode: vi.fn<() => unknown>(),
};

function failWith(status: number, data: unknown) {
  return () => {
    const config = { url: '', method: 'post', headers: {} } as InternalAxiosRequestConfig;
    throw new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined, {
      status,
      statusText: 'Error',
      headers: {},
      config,
      data,
    });
  };
}

const api = new MeshflowApi({ baseUrl: 'http://localhost:8000', basePath: '/api', timeout: 1000, auth: { type: 'none' } });
(api as unknown as { axios: ReturnType<typeof axios.create> }).axios.defaults.adapter = async (config) => {
  const url = config.url ?? '';
  // A little latency, so a double-click's second click lands while the first request is still in flight.
  await new Promise((r) => setTimeout(r, 40));
  let data: unknown;
  if (config.method === 'post' && url.endsWith('/claim-from-previous/')) {
    data = handlers.claim(url);
  } else if (config.method === 'get' && url.includes(`/observed-nodes/${NEW_ID}`)) {
    data = handlers.getNode();
  } else {
    failWith(404, { code: 'not_found', detail: 'Not found.' })();
  }
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};

vi.mock('@/hooks/api/useApi', () => ({ useMeshflowApi: () => api, useMeshtasticApi: () => api }));

const newer: NodeIdentityRef = {
  internal_id: NEW_ID,
  protocol: 1,
  meshtastic_node_id: 0x5678ef01,
  node_id_str: '!5678ef01',
};

const oldNode = (over: Partial<ObservedNode> = {}) =>
  ({
    internal_id: '11111111-1111-4111-8111-111111111111',
    protocol: 1,
    meshtastic_node_id: 0x1234abcd,
    node_id_str: '!1234abcd',
    short_name: 'OLD1',
    long_name: 'Old radio',
    last_heard: new Date('2026-04-21T10:00:00Z'),
    latest_position: null,
    owner: { id: 7, username: 'me' },
    replaced_by: newer,
    identity_chain: { previous: [], next: [] },
    ...over,
  }) as unknown as ObservedNode;

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const utils = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
  return { ...utils, invalidate };
}

const card = (node: ObservedNode, owned: string[] | undefined) => (
  <MyNodeCard
    node={node}
    isManaged={false}
    isClaimed
    watch={undefined}
    watchesQuery={{ isLoading: false, isError: false }}
    onConvert={vi.fn()}
    onShowSetupInstructions={vi.fn()}
    ownedNodeIds={owned ? new Set(owned) : undefined}
  />
);

const tap = () => screen.queryByRole('button', { name: 'This is mine too' });

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.value = { id: 7 };
  handlers.claim.mockReturnValue({ node: {}, accepted_at: '2026-11-11T10:00:00Z' });
  handlers.getNode.mockReturnValue({ ...newer, owner: null });
});

describe('ClaimFromPreviousButton', () => {
  it('posts to the NEW node and shows success, refreshing the lists', async () => {
    const { invalidate } = wrap(<ClaimFromPreviousButton newer={newer} />);
    await userEvent.click(screen.getByRole('button', { name: 'This is mine too' }));
    expect(await screen.findByTestId('claim-from-previous-done')).toHaveTextContent('!5678ef01');
    expect(handlers.claim).toHaveBeenCalledTimes(1);
    expect(handlers.claim.mock.calls[0][0]).toContain(`/observed-nodes/${NEW_ID}/claim-from-previous/`);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['nodes'] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['observed-nodes', 'mine'] });
  });

  it('sends once on a double click', async () => {
    wrap(<ClaimFromPreviousButton newer={newer} />);
    await userEvent.dblClick(screen.getByRole('button', { name: 'This is mine too' }));
    await screen.findByTestId('claim-from-previous-done');
    expect(handlers.claim).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['evidence_too_weak', /can't tell for certain/],
    ['already_claimed', /already been claimed/],
  ])('%s falls back to the normal claim page without an error', async (code, text) => {
    handlers.claim.mockImplementation(failWith(409, { code, detail: 'x' }));
    wrap(<ClaimFromPreviousButton newer={newer} />);
    await userEvent.click(screen.getByRole('button', { name: 'This is mine too' }));
    const box = await screen.findByTestId('claim-from-previous-fallback');
    expect(box).toHaveTextContent(text);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('claim-from-previous-link')).toHaveAttribute('href', `/nodes/${NEW_ID}/claim`);
  });

  it.each([
    ['not_owner', /older number you own/],
    ['no_previous', /older number of yours/],
    ['not_found', /was not found/],
  ])('%s shows plain text and keeps the button', async (code, text) => {
    handlers.claim.mockImplementation(failWith(403, { code, detail: 'x' }));
    wrap(<ClaimFromPreviousButton newer={newer} />);
    await userEvent.click(screen.getByRole('button', { name: 'This is mine too' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('button', { name: 'This is mine too' })).toBeEnabled();
  });

  it('shows the api detail for an unknown code', async () => {
    handlers.claim.mockImplementation(failWith(400, { code: 'weird', detail: 'Something odd happened.' }));
    wrap(<ClaimFromPreviousButton newer={newer} />);
    await userEvent.click(screen.getByRole('button', { name: 'This is mine too' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something odd happened.');
  });
});

describe('MyNodeCard one-tap claim', () => {
  it('shows when replaced and the newer node is not owned', () => {
    wrap(card(oldNode(), []));
    expect(tap()).toBeInTheDocument();
  });

  it('hides when the newer node is already owned', () => {
    wrap(card(oldNode(), [NEW_ID]));
    expect(tap()).toBeNull();
  });

  it('hides when the node is not replaced', () => {
    wrap(card(oldNode({ replaced_by: null }), []));
    expect(tap()).toBeNull();
  });

  it('hides without the owned set', () => {
    wrap(card(oldNode(), undefined));
    expect(tap()).toBeNull();
  });
});

describe('NodeIdentityBanner one-tap claim', () => {
  it('shows for the old node owner when the newer node is not theirs', async () => {
    wrap(<NodeIdentityBanner node={oldNode()} />);
    expect(await screen.findByRole('button', { name: 'This is mine too' })).toBeInTheDocument();
  });

  it('hides for a viewer who is not the owner', () => {
    wrap(<NodeIdentityBanner node={oldNode({ owner: { id: 99, username: 'other' } })} />);
    expect(tap()).toBeNull();
    expect(handlers.getNode).not.toHaveBeenCalled();
  });

  it('hides for guests and makes no request', () => {
    currentUser.value = null;
    wrap(<NodeIdentityBanner node={oldNode()} />);
    expect(tap()).toBeNull();
    expect(handlers.getNode).not.toHaveBeenCalled();
  });

  it('hides when the newer node is already theirs', async () => {
    handlers.getNode.mockReturnValue({ ...newer, owner: { id: 7, username: 'me' } });
    wrap(<NodeIdentityBanner node={oldNode()} />);
    await waitFor(() => expect(handlers.getNode).toHaveBeenCalled());
    expect(tap()).toBeNull();
  });

  it('is not part of the compact view', () => {
    wrap(<NodeIdentityBanner node={oldNode()} compact />);
    expect(tap()).toBeNull();
    expect(handlers.getNode).not.toHaveBeenCalled();
  });
});
