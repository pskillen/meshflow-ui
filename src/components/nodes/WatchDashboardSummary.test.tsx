import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeWatch, ObservedNode } from '@/lib/models';
import { WatchDashboardSummary } from './WatchDashboardSummary';
import { countWatchesByMonitoringStatus } from '@/lib/watch-monitoring-status';

function makeNode(overrides: Partial<ObservedNode> = {}): ObservedNode {
  return {
    internal_id: 1,
    meshtastic_node_id: 50,
    node_id_str: '!00000032',
    mac_addr: null,
    long_name: null,
    short_name: 'JumpMe',
    meshtastic_hw_model: null,
    meshtastic_public_key: null,
    last_heard: new Date('2026-04-21T12:00:00.000Z'),
    latest_position: null,
    ...overrides,
  } as ObservedNode;
}

function makeWatch(id: number, node: Partial<ObservedNode>): NodeWatch {
  return {
    id,
    observed_node: makeNode({ internal_id: id, meshtastic_node_id: 50 + id, ...node }) as NodeWatch['observed_node'],
    offline_after: 3600,
    enabled: true,
    offline_notifications_enabled: true,
    battery_notifications_enabled: false,
    created_at: '2026-04-21T00:00:00Z',
  };
}

describe('WatchDashboardSummary', () => {
  it('calls onJumpToWatch with watch id when a jump row is clicked', async () => {
    const user = userEvent.setup();
    const onJump = vi.fn();
    const watches = [
      makeWatch(7, {
        short_name: 'Alpha',
        node_id_str: '!aaaaaaaa',
        last_heard: new Date('2026-04-21T12:00:00.000Z'),
      }),
    ];
    const counts = countWatchesByMonitoringStatus(watches);
    render(<WatchDashboardSummary watches={watches} counts={counts} onJumpToWatch={onJump} />);

    await user.click(screen.getByRole('button', { name: /Alpha/i }));
    expect(onJump).toHaveBeenCalledWith(7);
  });
});
