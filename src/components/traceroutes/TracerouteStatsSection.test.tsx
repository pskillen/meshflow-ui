import { cloneElement, isValidElement, type ReactElement } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ResponsiveContainer measures its parent, which jsdom reports as 0x0; give it a fixed size.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      isValidElement(children)
        ? cloneElement(children as ReactElement<{ width: number; height: number }>, { width: 800, height: 190 })
        : null,
  };
});

const useTracerouteStats = vi.fn();
vi.mock('@/hooks/api/useTraceroutes', () => ({
  useTracerouteStats: (...args: unknown[]) => useTracerouteStats(...args),
}));

import { TracerouteStatsSection } from '@/components/traceroutes/TracerouteStatsSection';
import { statsRangeWindow, STATS_RANGES, type StatsRangeKey } from '@/lib/stats-range';

const NOW = new Date('2026-11-09T14:30:00Z');

function rangeFor(key: StatsRangeKey) {
  return { key, longLabel: STATS_RANGES[key].longLabel, window: statsRangeWindow(key, NOW) };
}

function target(id: number, name: string, completed: number, failed: number) {
  const total = completed + failed;
  return {
    meshtastic_node_id: id,
    node_id_str: `!${id.toString(16).padStart(8, '0')}`,
    short_name: name,
    long_name: null,
    total,
    completed,
    failed,
    success_rate: total ? completed / total : null,
  };
}

const BASE = {
  sources: [
    { trigger_type: 3, count: 30 },
    { trigger_type: 1, count: 10 },
  ],
  success_failure: [
    { status: 'completed', count: 30 },
    { status: 'failed', count: 10 },
  ],
  top_routers: [],
  by_source: [
    {
      managed_node_id: 'm1',
      meshtastic_node_id: 12,
      node_id_str: '!0000000c',
      name: 'Alpha',
      short_name: 'ALP',
      total: 25,
      completed: 20,
      failed: 5,
      success_rate: 0.8,
    },
    {
      managed_node_id: 'm2',
      meshtastic_node_id: 13,
      node_id_str: '!0000000d',
      name: 'Beta',
      short_name: 'BET',
      total: 15,
      completed: 10,
      failed: 5,
      success_rate: 10 / 15,
    },
  ],
  by_target: [
    target(1, 'GOOD', 9, 1),
    target(2, 'MID', 5, 5),
    target(3, 'BAD', 1, 9),
    target(4, 'FEW', 2, 0), // under 5 attempts: not ranked
  ],
  success_over_time: [{ date: '2026-11-08', completed: 30, failed: 10 }],
  by_strategy: {
    intra_zone: { completed: 20, failed: 5, pending: 1, sent: 0 },
    dx_across: { completed: 10, failed: 5, pending: 0, sent: 2 },
  },
  by_strategy_excluding_external: {
    intra_zone: { completed: 20, failed: 5, pending: 1, sent: 0 },
    dx_across: { completed: 10, failed: 5, pending: 0, sent: 2 },
  },
};

function renderSection(key: StatsRangeKey = '7d', sourceNodeId: number | null = null) {
  return render(
    <MemoryRouter>
      <TracerouteStatsSection sourceNodeId={sourceNodeId} range={rangeFor(key)} />
    </MemoryRouter>
  );
}

describe('TracerouteStatsSection', () => {
  beforeEach(() => {
    useTracerouteStats.mockReset();
    useTracerouteStats.mockReturnValue({ data: BASE, isLoading: false, error: null });
  });

  it('shows the four headline tiles', () => {
    renderSection();
    expect(screen.getByTestId('tile-success-rate')).toHaveTextContent('75%');
    expect(screen.getByTestId('tile-success-rate')).toHaveTextContent('30 of 40 finished');
    expect(screen.getByTestId('tile-runs')).toHaveTextContent('40');
    expect(screen.getByTestId('tile-targets')).toHaveTextContent('4');
    expect(screen.getByTestId('tile-targets')).toHaveTextContent('4 reached');
    expect(screen.getByTestId('tile-feeders')).toHaveTextContent('2');
  });

  it('draws one stacked Outcomes chart and no pies', () => {
    const { container } = renderSection('30d');
    const card = screen.getByTestId('traceroute-outcomes-card');
    expect(within(card).getByRole('heading', { name: 'Outcomes' })).toBeInTheDocument();
    expect(within(card).getByTestId('traceroute-outcomes-card-headline')).toHaveTextContent('40 runs');
    expect(within(card).getByTestId('trend-chart')).toHaveAttribute('data-kind', 'bar');
    expect(container.querySelector('.recharts-pie')).toBeNull();
  });

  it('asks for hourly data at 24h only', () => {
    renderSection('24h');
    expect(useTracerouteStats).toHaveBeenLastCalledWith(expect.objectContaining({ bucket: '1h' }));
    renderSection('7d');
    expect(useTracerouteStats).toHaveBeenLastCalledWith(expect.objectContaining({ bucket: undefined }));
  });

  it('24h with hourly rows is hourly; without bucket_start it falls back to days and says so', () => {
    const w = statsRangeWindow('24h', NOW);
    const hourly = Array.from({ length: 25 }, (_, i) => ({
      date: '2026-11-08',
      bucket_start: new Date(w.start.getTime() + i * 3_600_000).toISOString(),
      completed: 1,
      failed: 0,
    }));
    useTracerouteStats.mockReturnValue({ data: { ...BASE, success_over_time: hourly }, isLoading: false, error: null });
    const { unmount } = renderSection('24h');
    expect(screen.getByTestId('traceroute-outcomes-card-measure')).toHaveTextContent('Runs per hour');
    expect(screen.queryByText(/Hourly data is not available/)).toBeNull();
    unmount();

    useTracerouteStats.mockReturnValue({ data: BASE, isLoading: false, error: null });
    renderSection('24h');
    expect(screen.getByTestId('traceroute-outcomes-card-measure')).toHaveTextContent('Runs per UTC day');
    expect(screen.getByText(/Hourly data is not available/)).toBeInTheDocument();
  });

  it('bars for strategy and feeder, with success rate and runs', () => {
    renderSection();
    const strategy = within(screen.getByTestId('traceroute-by-strategy-card')).getByRole('list', {
      name: 'Success rate by strategy',
    });
    expect(strategy).toHaveTextContent('Intra-zone');
    expect(strategy).toHaveTextContent('80% · 25');
    const feeders = within(screen.getByTestId('traceroute-by-feeder-card')).getByRole('list', {
      name: 'Success rate by feeder',
    });
    expect(within(feeders).getAllByRole('listitem')[0]).toHaveTextContent('ALP');
    expect(feeders).toHaveTextContent('80% · 25');
  });

  it('ranks targets with at least 5 attempts, best and worst first', () => {
    renderSection();
    const most = within(screen.getByTestId('traceroute-top-targets-card')).getAllByRole('listitem');
    const least = within(screen.getByTestId('traceroute-least-targets-card')).getAllByRole('listitem');
    expect(most.map((li) => li.textContent)).toEqual(['GOOD90% · 10', 'MID50% · 10', 'BAD10% · 10']);
    expect(least[0]).toHaveTextContent('BAD');
    expect(screen.queryByText('FEW')).toBeNull();
    expect(within(most[0]!).getByRole('link')).toHaveAttribute('href', '/traceroutes/history?target_node=1');
  });

  it('keeps the full tables, with node IDs, behind a toggle on each card', () => {
    renderSection();
    const card = screen.getByTestId('traceroute-by-feeder-card');
    expect(within(card).queryByRole('table')).toBeNull();
    const toggle = within(card).getByRole('button', { name: 'Show table' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(within(card).getByRole('button', { name: 'Hide table' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(card).getByRole('table')).toHaveTextContent('!0000000c');

    const strategy = screen.getByTestId('traceroute-by-strategy-card');
    fireEvent.click(within(strategy).getByRole('button', { name: 'Show table' }));
    expect(within(strategy).getByRole('table')).toHaveTextContent('In flight');

    const trigger = screen.getByTestId('traceroute-by-trigger-card');
    expect(trigger).toHaveTextContent('Monitoring');
    expect(trigger).toHaveTextContent('75% · 30');
  });

  it('shows scope and an empty target message', () => {
    useTracerouteStats.mockReturnValue({
      data: { ...BASE, by_target: [target(4, 'FEW', 2, 0)] },
      isLoading: false,
      error: null,
    });
    renderSection('7d', 12);
    expect(screen.getByText('Stats scoped to source ALP.')).toBeInTheDocument();
    expect(screen.getByTestId('traceroute-top-targets-card')).toHaveTextContent('No targets with at least 5 attempts');
  });

  it('shows loading placeholders and an error', () => {
    useTracerouteStats.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { unmount } = renderSection();
    expect(screen.getByTestId('tile-runs')).toHaveTextContent('…');
    expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0);
    unmount();
    useTracerouteStats.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') });
    renderSection();
    expect(screen.getByText(/Failed to load traceroute stats: boom/)).toBeInTheDocument();
  });
});
