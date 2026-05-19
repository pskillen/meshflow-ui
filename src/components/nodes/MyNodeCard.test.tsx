import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ObservedNode } from '@/lib/models';

import { MyNodeCard } from './MyNodeCard';
import { MY_NODES_CLAIMED_RECENT_MS } from '@/lib/my-nodes-grouping';

const NOW = new Date('2026-04-21T12:00:00.000Z');

vi.mock('@/components/nodes/MeshWatchControls', () => ({
  MeshWatchControls: () => <div data-testid="mesh-watch">watch</div>,
}));

function makeNode(overrides: Partial<ObservedNode> = {}): ObservedNode {
  return {
    internal_id: 1,
    meshtastic_node_id: 100,
    node_id_str: '!00000064',
    mac_addr: null,
    long_name: 'Long',
    short_name: 'SN',
    hw_model: null,
    public_key: null,
    role: 2,
    last_heard: new Date('2026-04-21T10:00:00Z'),
    latest_position: null,
    owner: { id: 1, username: 'me' },
    ...overrides,
  } as ObservedNode;
}

function renderCard(props: Partial<ComponentProps<typeof MyNodeCard>> = {}) {
  const client = new QueryClient();
  const node = props.node ?? makeNode();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MyNodeCard
          node={node}
          isManaged={props.isManaged ?? false}
          isClaimed={props.isClaimed ?? true}
          showClaimedBadge={props.showClaimedBadge}
          managedLiveness={props.managedLiveness}
          watch={props.watch}
          watchesQuery={props.watchesQuery ?? { isLoading: false, isError: false }}
          onConvert={props.onConvert ?? vi.fn()}
          onShowSetupInstructions={props.onShowSetupInstructions ?? vi.fn()}
          onRequestUnclaim={props.onRequestUnclaim}
          onRequestUnmanage={props.onRequestUnmanage}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MyNodeCard', () => {
  it('hides Claimed badge when showClaimedBadge is false', () => {
    renderCard({ showClaimedBadge: false, isClaimed: true });
    expect(screen.queryByText('Claimed')).not.toBeInTheDocument();
  });

  it('shows Claimed badge by default when claimed', () => {
    renderCard({ isClaimed: true });
    expect(screen.getByText('Claimed')).toBeInTheDocument();
  });

  it('shows No GPS position when coords missing', () => {
    renderCard({ node: makeNode({ latest_position: null }) });
    const badge = screen.getByText('No GPS position');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/border-destructive/);
  });

  it('renders managed liveness warning when severity is warn', () => {
    renderCard({
      isManaged: true,
      managedLiveness: {
        severity: 'warn',
        message: 'Radio has not been heard — test message.',
      },
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Attention')).toBeInTheDocument();
    expect(screen.getByText(/Radio has not been heard/)).toBeInTheDocument();
  });

  it('does not render liveness alert when severity is ok', () => {
    renderCard({
      isManaged: true,
      managedLiveness: { severity: 'ok', message: null },
    });
    expect(screen.queryByText('Attention')).not.toBeInTheDocument();
    expect(screen.queryByText('Connectivity issue')).not.toBeInTheDocument();
  });

  it('offers Unclaim from the menu for claimed-only nodes when onRequestUnclaim is set', async () => {
    const user = userEvent.setup();
    const onRequestUnclaim = vi.fn();
    renderCard({ isManaged: false, isClaimed: true, onRequestUnclaim });
    await user.click(screen.getByRole('button', { name: /More actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /Unclaim node/i }));
    expect(onRequestUnclaim).toHaveBeenCalledTimes(1);
  });

  it('offers Unmanage from the menu for managed nodes when onRequestUnmanage is set', async () => {
    const user = userEvent.setup();
    const onRequestUnmanage = vi.fn();
    renderCard({ isManaged: true, isClaimed: true, onRequestUnmanage });
    await user.click(screen.getByRole('button', { name: /More actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /Unmanage node/i }));
    expect(onRequestUnmanage).toHaveBeenCalledTimes(1);
  });
});

describe('MyNodeCard position hint styling (fixed clock)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows GPS position recent for fresh reported_time', () => {
    renderCard({
      node: makeNode({
        latest_position: {
          latitude: 55,
          longitude: -4,
          reported_time: new Date('2026-04-21T11:00:00Z'),
          logged_time: null,
          altitude: null,
          location_source: 'gps',
        },
      }),
    });
    expect(screen.getByText('GPS position recent')).toBeInTheDocument();
  });

  it('applies warning-style border to stale GPS copy', () => {
    const old = new Date(NOW.getTime() - MY_NODES_CLAIMED_RECENT_MS - 60_000);
    renderCard({
      node: makeNode({
        latest_position: {
          latitude: 1,
          longitude: 2,
          reported_time: old,
          logged_time: null,
          altitude: null,
          location_source: 'gps',
        },
      }),
    });
    const badge = screen.getByText('GPS position stale (>7d)');
    expect(badge.className).toMatch(/border-amber/);
  });
});
