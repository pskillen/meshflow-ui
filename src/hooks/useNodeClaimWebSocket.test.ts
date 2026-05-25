import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeClaimWebSocket } from './useNodeClaimWebSocket';

const mockConfig = { apis: { meshBot: { baseUrl: 'http://127.0.0.1:8000' } } };

vi.mock('@/providers/ConfigProvider', () => ({
  useConfig: () => mockConfig,
}));

vi.mock('@/lib/auth/authService', () => ({
  authService: { getAccessToken: () => 'test-jwt' },
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.onclose?.();
  }
}

describe('useNodeClaimWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('connects to ws/claims with token when enabled', () => {
    const onAccepted = vi.fn();
    renderHook(() =>
      useNodeClaimWebSocket({
        nodeInternalId: 'uuid-1',
        nodeIdStr: 'mc:aabb',
        enabled: true,
        onAccepted,
      })
    );

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain('ws://127.0.0.1:8000/ws/claims/');
    expect(MockWebSocket.instances[0].url).toContain('token=test-jwt');
  });

  it('calls onAccepted when event matches node', () => {
    const onAccepted = vi.fn();
    renderHook(() =>
      useNodeClaimWebSocket({
        nodeInternalId: 'uuid-1',
        nodeIdStr: 'mc:aabbccddeeff',
        enabled: true,
        onAccepted,
      })
    );

    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.onopen?.();
      socket.onmessage?.({
        data: JSON.stringify({
          event: 'node_claim_accepted',
          node_internal_id: 'uuid-1',
          node_id_str: 'mc:aabbccddeeff',
          protocol: 2,
          accepted_at: '2026-05-25T12:00:00Z',
        }),
      });
    });

    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(onAccepted.mock.calls[0][0].accepted_at).toBe('2026-05-25T12:00:00Z');
  });

  it('ignores events for other nodes', () => {
    const onAccepted = vi.fn();
    renderHook(() =>
      useNodeClaimWebSocket({
        nodeInternalId: 'uuid-1',
        nodeIdStr: 'mc:aabb',
        enabled: true,
        onAccepted,
      })
    );

    MockWebSocket.instances[0].onmessage?.({
      data: JSON.stringify({
        event: 'node_claim_accepted',
        node_internal_id: 'other-uuid',
        node_id_str: 'mc:other',
        protocol: 2,
        accepted_at: '2026-05-25T12:00:00Z',
      }),
    });

    expect(onAccepted).not.toHaveBeenCalled();
  });
});
