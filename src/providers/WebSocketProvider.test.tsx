import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { WebSocketProvider, useWebSocket } from './WebSocketProvider';
import { eventService } from '@/lib/events/eventService';
import { WebSocketEventType } from '@/lib/websocket/websocketService';
import type { TextMessage } from '@/lib/models';

const mockConfig = { apis: { meshBot: { baseUrl: 'http://127.0.0.1:8000' } } };

const { connect, disconnect, initialize } = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  initialize: vi.fn(),
}));

vi.mock('@/providers/ConfigProvider', () => ({
  useConfig: () => mockConfig,
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
      <button type="button" onClick={() => ws.setActiveMessagesView(null)}>
        clear-active
      </button>
      <button type="button" onClick={() => ws.markAsReadForChannel('meshtastic', 2)}>
        mark-ch2-read
      </button>
      <button type="button" onClick={() => ws.markAsReadForProtocol('meshtastic')}>
        mark-mt-read
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

  const utils = render(
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
  );

  return {
    ...utils,
    navigate: (path: string) => {
      if (!navigateFn) throw new Error('navigate not ready');
      act(() => navigateFn!(path));
    },
  };
}

const sampleMessage = makeMessage({ id: 'mt-1', channel: 1, protocol: 'meshtastic' });

describe('WebSocketProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('shows toast for messages when not on the matching messages page', () => {
    renderWithRoutes('/');

    act(() => {
      eventService.emit(WebSocketEventType.MESSAGE_RECEIVED, sampleMessage);
    });

    expect(toastMock).toHaveBeenCalled();
  });

  it('suppresses toast when on the matching messages page', () => {
    renderWithRoutes('/messages');

    act(() => {
      eventService.emit(WebSocketEventType.MESSAGE_RECEIVED, sampleMessage);
    });

    expect(toastMock).not.toHaveBeenCalled();
  });

  it('scopes unread counts by protocol', () => {
    renderWithRoutes('/', true);

    act(() => {
      eventService.emit(WebSocketEventType.MESSAGE_RECEIVED, sampleMessage);
      eventService.emit(
        WebSocketEventType.MESSAGE_RECEIVED,
        makeMessage({ id: 'mc-1', channel: 3, protocol: 'meshcore', message_text: 'mc' })
      );
    });

    expect(screen.getByTestId('mt-count')).toHaveTextContent('1');
    expect(screen.getByTestId('mc-count')).toHaveTextContent('1');
  });

  it('does not count unread for the active channel on the messages page', () => {
    renderWithRoutes('/messages', true);

    act(() => {
      screen.getByText('set-active-ch1').click();
    });

    act(() => {
      eventService.emit(WebSocketEventType.MESSAGE_RECEIVED, sampleMessage);
      eventService.emit(
        WebSocketEventType.MESSAGE_RECEIVED,
        makeMessage({ id: 'mt-2', channel: 2, protocol: 'meshtastic' })
      );
    });

    expect(screen.getByTestId('mt-count')).toHaveTextContent('1');
    expect(screen.getByTestId('ch1-count')).toHaveTextContent('0');
    expect(screen.getByTestId('ch2-count')).toHaveTextContent('1');
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('markAsReadForChannel clears only that channel', () => {
    renderWithRoutes('/', true);

    act(() => {
      eventService.emit(WebSocketEventType.MESSAGE_RECEIVED, sampleMessage);
      eventService.emit(
        WebSocketEventType.MESSAGE_RECEIVED,
        makeMessage({ id: 'mt-2', channel: 2, protocol: 'meshtastic' })
      );
    });

    act(() => {
      screen.getByText('mark-ch2-read').click();
    });

    expect(screen.getByTestId('mt-count')).toHaveTextContent('1');
    expect(screen.getByTestId('ch2-count')).toHaveTextContent('0');
  });

  it('does not clear unrelated protocol unread when navigating to messages', () => {
    const { navigate } = renderWithRoutes('/', true);

    act(() => {
      eventService.emit(
        WebSocketEventType.MESSAGE_RECEIVED,
        makeMessage({ id: 'mc-1', channel: 5, protocol: 'meshcore' })
      );
    });

    expect(screen.getByTestId('mc-count')).toHaveTextContent('1');

    navigate('/messages');

    act(() => {
      eventService.emit(WebSocketEventType.MESSAGE_RECEIVED, sampleMessage);
    });

    expect(screen.getByTestId('mc-count')).toHaveTextContent('1');
    expect(screen.getByTestId('mt-count')).toHaveTextContent('1');
  });

  it('resumes counting unread for active channel after clear-active', () => {
    renderWithRoutes('/messages', true);

    act(() => {
      screen.getByText('set-active-ch1').click();
    });

    act(() => {
      eventService.emit(WebSocketEventType.MESSAGE_RECEIVED, sampleMessage);
    });

    expect(screen.getByTestId('ch1-count')).toHaveTextContent('0');

    act(() => {
      screen.getByText('clear-active').click();
    });

    act(() => {
      eventService.emit(
        WebSocketEventType.MESSAGE_RECEIVED,
        makeMessage({ id: 'mt-3', channel: 1, protocol: 'meshtastic' })
      );
    });

    expect(screen.getByTestId('ch1-count')).toHaveTextContent('1');
  });

  it('toasts for other protocol while on messages page', () => {
    renderWithRoutes('/messages', true);

    act(() => {
      eventService.emit(
        WebSocketEventType.MESSAGE_RECEIVED,
        makeMessage({ id: 'mc-1', channel: 3, protocol: 'meshcore' })
      );
    });

    expect(toastMock).toHaveBeenCalled();
  });

  it('markAsReadForProtocol clears all unread for that protocol', () => {
    renderWithRoutes('/', true);

    act(() => {
      eventService.emit(WebSocketEventType.MESSAGE_RECEIVED, sampleMessage);
      eventService.emit(
        WebSocketEventType.MESSAGE_RECEIVED,
        makeMessage({ id: 'mt-2', channel: 2, protocol: 'meshtastic' })
      );
    });

    act(() => {
      screen.getByText('mark-mt-read').click();
    });

    expect(screen.getByTestId('mt-count')).toHaveTextContent('0');
  });
});
