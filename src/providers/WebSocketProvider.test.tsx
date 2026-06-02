import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { WebSocketProvider } from './WebSocketProvider';
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

function NavigationHarness({ onNavigate }: { onNavigate: (navigate: ReturnType<typeof useNavigate>) => void }) {
  const navigate = useNavigate();
  onNavigate(navigate);
  return null;
}

function renderWithRoutes(initialPath: string) {
  let navigateFn: ReturnType<typeof useNavigate> | null = null;

  const utils = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <WebSocketProvider>
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

const sampleMessage = {
  id: 1,
  message_text: 'hello',
  protocol: 'meshtastic',
  channel: 1,
  sender: { node_id_str: '!aabbccdd', short_name: 'AB' },
} as unknown as TextMessage;

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
});
