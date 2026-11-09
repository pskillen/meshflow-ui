import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { FeederIdentityEvent } from '@/lib/models';
import { FeederIdentityNotices } from './FeederIdentityNotices';

const api = {
  getFeederIdentityEvents: vi.fn(),
  acknowledgeFeederIdentityEvent: vi.fn(),
  repointManagedNode: vi.fn(),
};

vi.mock('@/hooks/api/useApi', () => ({
  useMeshflowApi: () => api,
  useMeshtasticApi: () => api,
}));

function makeEvent(overrides: Partial<FeederIdentityEvent> = {}): FeederIdentityEvent {
  return {
    id: 1,
    managed_node: '11111111-1111-4111-8111-111111111111',
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

function renderNotices() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FeederIdentityNotices />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FeederIdentityNotices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an auto-updated event with Dismiss only', async () => {
    api.getFeederIdentityEvents.mockResolvedValue(page([makeEvent()]));
    renderNotices();

    expect(await screen.findByText('Feeder number changed')).toBeInTheDocument();
    expect(screen.getByText(/It keeps its history and API key/)).toBeInTheDocument();
    expect(screen.getByText('!1234abcd')).toBeInTheDocument();
    expect(screen.getByText('!5678ef01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Re-point/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View feeder' })).toHaveAttribute('href', '/nodes/!5678ef01');
  });

  it('renders a flagged event needing action with Re-point and Dismiss', async () => {
    api.getFeederIdentityEvents.mockResolvedValue(
      page([makeEvent({ outcome: 'flagged', needs_action: true, reason: 'shared_key' })])
    );
    renderNotices();

    expect(await screen.findByText('Feeder needs review')).toBeInTheDocument();
    expect(screen.getByText(/reported/)).toHaveTextContent('Roof Feeder reported !5678ef01 but is stored as !1234abcd.');
    expect(screen.getByText('Its public key is also used by another node.')).toBeInTheDocument();
    expect(screen.getByText(/still being ingested/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-point to !5678ef01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it.each([
    ['flagged without needs_action', { outcome: 'flagged' as const, needs_action: false, reason: 'shared_key' as const }],
    ['manual', { outcome: 'manual' as const }],
  ])('renders %s as neutral with Dismiss only', async (_label, overrides) => {
    api.getFeederIdentityEvents.mockResolvedValue(page([makeEvent(overrides)]));
    renderNotices();

    expect(await screen.findByText('Feeder number changed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Re-point/ })).not.toBeInTheDocument();
  });

  it('hides Re-point for number_collision', async () => {
    api.getFeederIdentityEvents.mockResolvedValue(
      page([makeEvent({ outcome: 'flagged', needs_action: true, reason: 'number_collision' })])
    );
    renderNotices();

    expect(await screen.findByText('Feeder needs review')).toBeInTheDocument();
    expect(screen.getByText(/Another feeder already uses that number/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Re-point/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it.each(['key_mismatch', 'crc_mismatch'] as const)('hides Re-point for %s and says to contact an administrator', async (reason) => {
    api.getFeederIdentityEvents.mockResolvedValue(page([makeEvent({ outcome: 'flagged', needs_action: true, reason })]));
    renderNotices();

    expect(await screen.findByText('Feeder needs review')).toBeInTheDocument();
    expect(screen.getByText(/Contact an administrator/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Re-point/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it.each([
    [403, 'repoint_not_proven', /can't be confirmed from the feeder's stored public key/],
    [409, 'repoint_target_key_mismatch', /different public key/],
    [409, 'repoint_target_claimed', /belongs to another user/],
    [409, 'number_collision', /Another feeder already uses that number/],
  ])('shows a plain message when re-point fails with %s %s', async (status, code, message) => {
    const event = makeEvent({ outcome: 'flagged', needs_action: true, reason: 'shared_key' });
    api.getFeederIdentityEvents.mockResolvedValue(page([event]));
    api.repointManagedNode.mockRejectedValue(
      new AxiosError('refused', 'ERR_BAD_REQUEST', undefined, undefined, {
        status,
        statusText: 'Refused',
        headers: {},
        config: {} as never,
        data: { code, detail: 'raw server detail' },
      })
    );
    renderNotices();

    await userEvent.click(await screen.findByRole('button', { name: 'Re-point to !5678ef01' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm re-point' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText('raw server detail')).not.toBeInTheDocument();
    expect(screen.getByText('Re-point feeder?')).toBeInTheDocument();
  });

  it('Dismiss acknowledges the event and the row disappears after refetch', async () => {
    api.getFeederIdentityEvents.mockResolvedValueOnce(page([makeEvent({ id: 42 })])).mockResolvedValue(page([]));
    api.acknowledgeFeederIdentityEvent.mockResolvedValue(makeEvent({ id: 42 }));
    renderNotices();

    await userEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));

    expect(api.acknowledgeFeederIdentityEvent).toHaveBeenCalledWith(42);
    await waitFor(() => expect(screen.queryByText('Feeder number changed')).not.toBeInTheDocument());
  });

  it('Re-point confirms, then calls the endpoint with the internal id', async () => {
    const event = makeEvent({ outcome: 'flagged', needs_action: true, reason: 'key_not_reported' });
    api.getFeederIdentityEvents.mockResolvedValueOnce(page([event])).mockResolvedValue(page([]));
    api.repointManagedNode.mockResolvedValue(event);
    renderNotices();

    await userEvent.click(await screen.findByRole('button', { name: 'Re-point to !5678ef01' }));
    expect(api.repointManagedNode).not.toHaveBeenCalled();
    expect(await screen.findByText('Re-point feeder?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm re-point' }));

    expect(api.repointManagedNode).toHaveBeenCalledWith(event.managed_node);
    await waitFor(() => expect(screen.queryByText('Feeder needs review')).not.toBeInTheDocument());
  });

  it("shows the API's own message in the dialog for a code it doesn't know", async () => {
    const event = makeEvent({ outcome: 'flagged', needs_action: true, reason: 'key_not_reported' });
    api.getFeederIdentityEvents.mockResolvedValue(page([event]));
    const err = new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config: {} as never,
      data: { code: 'already_current', error: 'Another feeder already uses !5678ef01.' },
    });
    api.repointManagedNode.mockRejectedValue(err);
    renderNotices();

    await userEvent.click(await screen.findByRole('button', { name: 'Re-point to !5678ef01' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm re-point' }));

    expect(await screen.findByText('Another feeder already uses !5678ef01.')).toBeInTheDocument();
    expect(screen.getByText('Re-point feeder?')).toBeInTheDocument();
  });

  it('shows 5 notices and "and 1 more" for six events, newest first', async () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      makeEvent({ id: i + 1, managed_node_name: `Feeder ${i + 1}`, created_at: `2026-04-2${i}T12:00:00Z` })
    );
    api.getFeederIdentityEvents.mockResolvedValue(page(events));
    renderNotices();

    await screen.findAllByText('Feeder number changed');
    expect(screen.getAllByTestId('feeder-identity-notice')).toHaveLength(5);
    expect(screen.getByText('and 1 more')).toBeInTheDocument();
    expect(screen.getByText(/^Feeder 6 changed/)).toBeInTheDocument();
    expect(screen.queryByText(/^Feeder 1 changed/)).not.toBeInTheDocument();
  });

  it('renders nothing and does not throw when the list call is rejected (404)', async () => {
    api.getFeederIdentityEvents.mockRejectedValue(new Error('Request failed with status code 404'));
    const { container } = renderNotices();

    await waitFor(() => expect(api.getFeederIdentityEvents).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are no events', async () => {
    api.getFeederIdentityEvents.mockResolvedValue(page([]));
    const { container } = renderNotices();

    await waitFor(() => expect(api.getFeederIdentityEvents).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
