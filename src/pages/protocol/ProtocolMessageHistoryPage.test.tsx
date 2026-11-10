import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProtocolMessageHistoryPage } from './ProtocolMessageHistoryPage';
import { MESHTASTIC_CONFIG } from '@/lib/mesh-protocol';

const { setActiveMessagesView, unreadByChannel } = vi.hoisted(() => ({
  setActiveMessagesView: vi.fn(),
  unreadByChannel: { current: {} as Record<number, number> },
}));

vi.mock('@/providers/WebSocketProvider', () => ({
  useWebSocket: () => ({
    setActiveMessagesView,
    hasUnreadForChannel: (_p: string, id: number) => (unreadByChannel.current[id] ?? 0) > 0,
    unreadCountForChannel: (_p: string, id: number) => unreadByChannel.current[id] ?? 0,
  }),
}));

vi.mock('@/components/messages/MessageList', () => ({
  MessageList: ({ channel }: { channel: number }) => <div data-testid="list">{channel}</div>,
}));

const channel = (id: number, name: string) => ({ id, name, protocol: 1 });
const constellations = [
  { id: 10, name: 'North', protocol: 1, channels: [channel(1, 'Chan A'), channel(2, 'Chan B')] },
  { id: 11, name: 'South', protocol: 1, channels: [channel(3, 'Chan C')] },
];

vi.mock('@/hooks/api/useConstellations', () => ({
  useConstellationsSuspense: () => ({ constellations }),
}));

vi.mock('@/lib/message-channels', () => ({
  filterChannelsForProtocol: (c: unknown[]) => c,
  formatMessageChannelLabel: (c: { name: string }) => c.name,
  protocolSlugFromApiValue: () => 'meshtastic',
}));

const lastView = () => setActiveMessagesView.mock.calls.filter((c) => c[0] != null).at(-1)?.[0];

describe('ProtocolMessageHistoryPage read marking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    unreadByChannel.current = {};
  });

  it('marks the initial channel on mount as read', () => {
    render(<ProtocolMessageHistoryPage config={MESHTASTIC_CONFIG} />);
    expect(lastView()).toEqual({ protocol: 'meshtastic', channelId: 1, markRead: true });
  });

  it('marks an explicitly selected channel as read', () => {
    render(<ProtocolMessageHistoryPage config={MESHTASTIC_CONFIG} />);
    fireEvent.click(screen.getByRole('button', { name: /Chan B/ }));
    expect(lastView()).toEqual({ protocol: 'meshtastic', channelId: 2, markRead: true });
  });

  it('does not mark the channel auto-selected by a constellation switch', () => {
    render(<ProtocolMessageHistoryPage config={MESHTASTIC_CONFIG} />);
    fireEvent.click(screen.getByRole('button', { name: 'South' }));
    expect(lastView()).toEqual({ protocol: 'meshtastic', channelId: 3, markRead: false });
  });

  it('marks the channel once the user clicks it after a constellation switch', () => {
    render(<ProtocolMessageHistoryPage config={MESHTASTIC_CONFIG} />);
    fireEvent.click(screen.getByRole('button', { name: 'South' }));
    fireEvent.click(screen.getByRole('button', { name: /Chan C/ }));
    expect(lastView()).toEqual({ protocol: 'meshtastic', channelId: 3, markRead: true });
  });

  it('shows per-channel unread badges', () => {
    unreadByChannel.current = { 2: 120, 1: 0 };
    render(<ProtocolMessageHistoryPage config={MESHTASTIC_CONFIG} />);
    expect(screen.getByRole('button', { name: /Chan B/ })).toHaveTextContent('99+');
  });
});
