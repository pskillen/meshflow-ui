import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { WebSocketProvider, useWebSocket } from './WebSocketProvider';
import { eventService } from '@/lib/events/eventService';
import { WebSocketEventType } from '@/lib/websocket/websocketService';
import type { TextMessage } from '@/lib/models';
import { NotFoundError } from '@/lib/types';
import { unreadCountsQueryKey } from '@/hooks/api/useUnreadCounts';

const mockConfig = { apis: { meshBot: { baseUrl: 'http://127.0.0.1:8000' } } };

const { connect, disconnect, initialize } = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  initialize: vi.fn(),
}));

const { getUnreadCounts, markChannelRead } = vi.hoisted(() => ({
  getUnreadCounts: vi.fn(),
  markChannelRead: vi.fn(),
}));

vi.mock('@/providers/ConfigProvider', () => ({
  useConfig: () => mockConfig,
}));

vi.mock('@/hooks/api/useApi', () => ({
  useMeshflowApi: () => ({ getUnreadCounts, markChannelRead }),
}));

vi.mock('@/lib/websocket/websocketService', () => ({
  websocketService: {
    initialize,
    connect,
    disconnect,
  },
  WebSocketEventType: {
    CONNECTED: 'websocket:connected',
    DISCONNECTED: 'websocket:disconnected',
    MESSAGE_RECEIVED: 'websocket:message_received',
    ERROR: 'websocket:error',
  },
  ConnectionState: {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error',
  },
}));

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
  useToast: () => ({ toast: toastMock }),
}));

function makeMessage(overrides: Partial<TextMessage> & { id: string; channel: number }): TextMessage {
  return {
    packet_id: 1,
    protocol: 'meshtastic',
    sender: { node_id_str: '!aabbccdd', long_name: null, short_name: 'AB' },
    recipient_meshtastic_node_id: null,
    sent_at: '2025-01-01T00:00:00Z',
    message_text: 'hello',
    is_emoji: false,
    reply_to_meshtastic_packet_id: null,
    heard: [],
    ...overrides,
  } as TextMessage;
}

function UnreadProbe() {
  const ws = useWebSocket();
  return (
    <div>
      <span data-testid="mt-count">{ws.unreadCountForProtocol('meshtastic')}</span>
      <span data-testid="mc-count">{ws.unreadCountForProtocol('meshcore')}</span>
      <span data-testid="ch1-count">{ws.unreadCountForChannel('meshtastic', 1)}</span>
      <span data-testid="ch2-count">{ws.unreadCountForChannel('meshtastic', 2)}</span>
      <button type="button" onClick={() => ws.setActiveMessagesView({ protocol: 'meshtastic', channelId: 1 })}>
        set-active-ch1
      </button>
      <button
        type="button"
        onClick={() => ws.setActiveMessagesView({ protocol: 'meshtastic', channelId: 1, markRead: false })}
      >
        set-auto-ch1
      </button>
      <button type="button" onClick={() => ws.setActiveMessagesView(null)}>
        clear-active
      </button>
      <button type="button" onClick={() => ws.reportShownMessage('meshtastic', 1, 'newest-1')}>
        shown-ch1
      </button>
    </div>
  );
}

function NavigationHarness({ onNavigate }: { onNavigate: (navigate: ReturnType<typeof useNavigate>) => void }) {
  const navigate = useNavigate();
  onNavigate(navigate);
  return null;
}

function renderWithRoutes(initialPath: string, withProbe = false) {
  let navigateFn: ReturnType<typeof useNavigate> | null = null;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <WebSocketProvider>
          {withProbe ? <UnreadProbe /> : null}
          <Routes>
            <Route path="/" element={<NavigationHarness onNavigate={(n) => (navigateFn = n)} />} />
            <Route path="/nodes" element={<NavigationHarness onNavigate={(n) => (navigateFn = n)} />} />
            <Route path="/messages" element={<NavigationHarness onNavigate={(n) => (navigateFn = n)} />} />
            <Route path="/meshcore/messages" element={<NavigationHarness onNavigate={(n) => (navigateFn = n)} />} />
          </Routes>
        </WebSocketProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return {
    ...utils,
    queryClient,
    navigate: (path: string) => {
      if (!navigateFn) throw new Error('navigate not ready');
      act(() => navigateFn!(path));
    },
  };
}

const sampleMessage = makeMessage({ id: 'mt-1', channel: 1, protocol: 'meshtastic' });

const emit = (message: TextMessage) =>
  act(() => {
    eventService.emit(WebSocketEventType.MESSAGE_RECEIVED, message);
  });

const text = (id: string) => screen.getByTestId(id).textContent;

function serverCounts(mt: Record<string, number> = {}, mc: Record<string, number> = {}) {
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  return {
    meshtastic: { total: sum(mt), channels: mt },
    meshcore: { total: sum(mc), channels: mc },
  };
}

/**
 * Wait until the provider has rendered with the first unread-counts snapshot.
 *
 * Frames emitted before that are tagged with the pre-snapshot fetch id and are dropped when the snapshot lands, so
 * asserting earlier races React Query's result delivery (meshflow-ui#459). React Query notifies observers on a 0ms
 * timer scheduled when the query settles; waiting for `success` and then one later timer guarantees that has run.
 */
async function waitForSnapshot(queryClient: QueryClient) {
  await waitFor(() => expect(queryClient.getQueryState(unreadCountsQueryKey)?.status).toBe('success'));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Resolve after a short delay so tests always exercise the "snapshot not here yet" path, not just fast machines. */
function resolveLater<T>(value: T, ms = 10): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

async function renderSeeded(path: string, counts = serverCounts()) {
  getUnreadCounts.mockImplementation(() => resolveLater(counts));
  const utils = renderWithRoutes(path, true);
  await waitForSnapshot(utils.queryClient);
  return utils;
}

describe('WebSocketProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUnreadCounts.mockResolvedValue(serverCounts());
    markChannelRead.mockResolvedValue({ channel_id: 1, last_read_at: '2025-01-01T00:00:00Z' });
  });

  it('connects once on mount and does not disconnect on route changes', () => {
    const { navigate } = renderWithRoutes('/');

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledWith('http://127.0.0.1:8000');
    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();

    navigate('/nodes');
    navigate('/messages');
    navigate('/meshcore/messages');
    navigate('/');

    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('shows toast for messages when not on the matching messages page', async () => {
    await renderSeeded('/');
    emit(sampleMessage);
    expect(toastMock).toHaveBeenCalled();
  });

  it('suppresses toast when on the matching messages page', async () => {
    await renderSeeded('/messages');
    emit(sampleMessage);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('toasts for the other protocol while on a messages page', async () => {
    await renderSeeded('/messages');
    emit(makeMessage({ id: 'mc-1', channel: 3, protocol: 'meshcore' }));
    expect(toastMock).toHaveBeenCalled();
  });

  it('seeds per-protocol totals and per-channel counts from the server (survives reload)', async () => {
    await renderSeeded('/', serverCounts({ '1': 3, '2': 4 }, { '9': 5 }));
    expect(text('mt-count')).toBe('7');
    expect(text('mc-count')).toBe('5');
    expect(text('ch1-count')).toBe('3');
    expect(text('ch2-count')).toBe('4');
  });

  it('adds WS frames on top of the server counts, per protocol, deduped by id', async () => {
    await renderSeeded('/', serverCounts({ '1': 2 }, { '9': 1 }));
    emit(sampleMessage);
    emit(sampleMessage);
    emit(makeMessage({ id: 'mc-1', channel: 9, protocol: 'meshcore' }));
    expect(text('mt-count')).toBe('3');
    expect(text('ch1-count')).toBe('3');
    expect(text('mc-count')).toBe('2');
  });

  it('counts an unclassifiable frame toward neither protocol', async () => {
    await renderSeeded('/');
    emit(makeMessage({ id: 'x-1', channel: 1, protocol: undefined, sender: null }));
    expect(text('mt-count')).toBe('0');
    expect(text('mc-count')).toBe('0');
  });

  it('classifies meshcore without protocol using mc provenance fields', async () => {
    await renderSeeded('/');
    emit(
      makeMessage({ id: 'mc-infer', channel: 9, protocol: undefined, original_mc_packet_id: 'deadbeef', sender: null })
    );
    expect(text('mt-count')).toBe('0');
    expect(text('mc-count')).toBe('1');
  });

  it('on a messages page only the viewed channel is read; nav total excludes just that channel', async () => {
    await renderSeeded('/messages', serverCounts({ '1': 3, '2': 4 }, { '9': 5 }));
    expect(text('mt-count')).toBe('7');

    act(() => screen.getByText('set-active-ch1').click());
    expect(text('ch1-count')).toBe('0');
    expect(text('ch2-count')).toBe('4');
    expect(text('mt-count')).toBe('4');
    expect(text('mc-count')).toBe('5');
  });

  it('acceptance: viewing A, new on A no badge; new on B +1 on MT and B; MC message +1 on MC only', async () => {
    await renderSeeded('/messages');
    act(() => screen.getByText('set-active-ch1').click());

    emit(sampleMessage);
    expect(text('mt-count')).toBe('0');
    expect(text('ch1-count')).toBe('0');

    emit(makeMessage({ id: 'mt-2', channel: 2, protocol: 'meshtastic' }));
    expect(text('mt-count')).toBe('1');
    expect(text('ch2-count')).toBe('1');
    expect(text('mc-count')).toBe('0');

    emit(makeMessage({ id: 'mc-1', channel: 3, protocol: 'meshcore' }));
    expect(text('mc-count')).toBe('1');
    expect(text('mt-count')).toBe('1');
  });

  it('does not clear anything when navigating onto a messages page', async () => {
    const { navigate } = await renderSeeded('/', serverCounts({ '1': 2 }, { '5': 1 }));
    navigate('/messages');
    expect(text('mt-count')).toBe('2');
    expect(text('mc-count')).toBe('1');
  });

  it('keeps a channel read after leaving the page, and counts it again for new frames', async () => {
    const { navigate } = await renderSeeded('/messages', serverCounts({ '1': 3 }));
    act(() => screen.getByText('set-active-ch1').click());
    act(() => screen.getByText('shown-ch1').click());
    navigate('/');
    expect(text('ch1-count')).toBe('0');

    emit(makeMessage({ id: 'mt-9', channel: 1, protocol: 'meshtastic' }));
    expect(text('ch1-count')).toBe('1');
  });

  it('marks the viewed channel read up to the newest message shown', async () => {
    await renderSeeded('/messages', serverCounts({ '1': 3 }));
    act(() => screen.getByText('set-active-ch1').click());
    expect(markChannelRead).not.toHaveBeenCalled();

    act(() => screen.getByText('shown-ch1').click());
    expect(markChannelRead).toHaveBeenCalledTimes(1);
    expect(markChannelRead).toHaveBeenCalledWith(1, 'newest-1');
    expect(text('ch1-count')).toBe('0');
  });

  it('does not mark read for an auto-selected channel and keeps its count', async () => {
    await renderSeeded('/messages', serverCounts({ '1': 3 }));
    act(() => screen.getByText('set-auto-ch1').click());
    act(() => screen.getByText('shown-ch1').click());

    expect(markChannelRead).not.toHaveBeenCalled();
    expect(text('ch1-count')).toBe('3');
    emit(sampleMessage);
    expect(text('ch1-count')).toBe('4');
  });

  it('does not mark read off the messages pages', async () => {
    await renderSeeded('/', serverCounts({ '1': 3 }));
    act(() => screen.getByText('set-active-ch1').click());
    act(() => screen.getByText('shown-ch1').click());
    expect(markChannelRead).not.toHaveBeenCalled();
    expect(text('ch1-count')).toBe('3');
  });

  it('resumes counting the channel after the view is cleared', async () => {
    await renderSeeded('/messages');
    act(() => screen.getByText('set-active-ch1').click());
    emit(sampleMessage);
    expect(text('ch1-count')).toBe('0');

    act(() => screen.getByText('clear-active').click());
    emit(makeMessage({ id: 'mt-3', channel: 1, protocol: 'meshtastic' }));
    expect(text('ch1-count')).toBe('1');
  });

  it('caps a channel at 99', async () => {
    await renderSeeded('/', serverCounts({ '1': 99 }));
    emit(sampleMessage);
    expect(text('ch1-count')).toBe('99');
    expect(text('mt-count')).toBe('99');
  });

  it('refetches on WS reconnect and reconciles (server snapshot replaces local additions)', async () => {
    await renderSeeded('/', serverCounts({ '1': 1 }));
    emit(sampleMessage);
    expect(text('ch1-count')).toBe('2');

    getUnreadCounts.mockResolvedValue(serverCounts({ '1': 2 }));
    await act(async () => {
      eventService.emit(WebSocketEventType.CONNECTED);
    });
    await waitFor(() => expect(getUnreadCounts).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(text('ch1-count')).toBe('2'));
    expect(text('mt-count')).toBe('2');
  });

  describe('API without the unread-counts endpoint (404)', () => {
    beforeEach(() => {
      getUnreadCounts.mockImplementation(() =>
        resolveLater(null).then(() => Promise.reject(new NotFoundError('Not Found')))
      );
    });

    it('falls back to counting WS frames only', async () => {
      const { queryClient } = renderWithRoutes('/', true);
      await waitForSnapshot(queryClient);

      emit(sampleMessage);
      emit(makeMessage({ id: 'mc-1', channel: 3, protocol: 'meshcore' }));
      expect(text('mt-count')).toBe('1');
      expect(text('mc-count')).toBe('1');
    });

    it('still excludes the viewed channel but never calls mark-read', async () => {
      const { queryClient } = renderWithRoutes('/messages', true);
      await waitForSnapshot(queryClient);

      act(() => screen.getByText('set-active-ch1').click());
      act(() => screen.getByText('shown-ch1').click());
      emit(sampleMessage);
      emit(makeMessage({ id: 'mt-2', channel: 2, protocol: 'meshtastic' }));

      expect(text('mt-count')).toBe('1');
      expect(markChannelRead).not.toHaveBeenCalled();
    });
  });
});
