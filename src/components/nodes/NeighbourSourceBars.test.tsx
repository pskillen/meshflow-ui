import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { StatsRange } from '@/hooks/useStatsRange';
import { statsRangeWindow } from '@/lib/stats-range';

const neighbours = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/api/usePacketStats', () => ({ useNeighbourStats: neighbours }));

import { NeighbourSourceBars } from './NeighbourSourceBars';
import { NEIGHBOUR_BARS_SHOWN, neighbourSourceLabel } from '@/lib/neighbour-sources';

const NOW = new Date('2026-11-10T09:37:00Z');
const range = { key: '30d', longLabel: 'last 30 days', window: statsRangeWindow('30d', NOW) } as StatsRange;

const source = (n: number, count: number, short: string | null = `N${n}`) => ({
  source: n,
  source_type: 'full' as const,
  count,
  candidates: [{ meshtastic_node_id: n, node_id_str: `!${n.toString(16).padStart(8, '0')}`, short_name: short }],
});

function show(by_source: unknown[]) {
  neighbours.mockReturnValue({ data: { by_source }, isLoading: false, error: null });
  return render(
    <MemoryRouter>
      <NeighbourSourceBars nodeId={5} range={range} />
    </MemoryRouter>
  );
}

beforeEach(() => neighbours.mockReset());

describe('NeighbourSourceBars', () => {
  it('asks for the page range, ending past the current hour', () => {
    show([]);
    const params = neighbours.mock.calls[0]![0];
    expect(params.nodeId).toBe(5);
    expect(params.startDate.getTime()).toBe(range.window.start.getTime());
    expect(params.endDate.getTime()).toBeGreaterThanOrEqual(NOW.getTime());
  });

  it('ranks sources by count, largest first, with the largest at full width', () => {
    show([source(1, 10), source(2, 40), source(3, 20)]);
    const rows = screen.getAllByTestId('neighbour-bars-row');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('N2'),
      expect.stringContaining('N3'),
      expect.stringContaining('N1'),
    ]);
    const widths = rows.map((r) => (r.querySelector('[style*="width"]') as HTMLElement).style.width);
    expect(widths).toEqual(['100%', '50%', '25%']);
    expect(screen.getByTestId('chart-node-neighbours-headline').textContent).toBe('70 packets');
  });

  it('is not a pie: no recharts svg, only bars drawn from the chart token', () => {
    const { container } = show([source(1, 3)]);
    expect(container.querySelector('svg.recharts-surface')).toBeNull();
    expect(container.innerHTML).toContain('hsl(var(--chart-1))');
  });

  it('shows the top sources and sums the rest', () => {
    const many = Array.from({ length: NEIGHBOUR_BARS_SHOWN + 3 }, (_, i) => source(i + 1, 100 - i));
    show(many);
    expect(screen.getAllByTestId('neighbour-bars-row')).toHaveLength(NEIGHBOUR_BARS_SHOWN);
    expect(screen.getByTestId('neighbour-bars-rest').textContent).toBe(`and 3 more, ${(90 + 89 + 88).toString()} packets`);
  });

  it('links each candidate to its node page', () => {
    show([source(255, 4, 'ABCD')]);
    expect(screen.getByRole('link', { name: 'ABCD' }).getAttribute('href')).toContain('/nodes/');
  });

  it('says so with no data, while loading, and on error', () => {
    show([]);
    expect(screen.getByText(/No packets received from neighbours in the last 30 days/)).toBeTruthy();
    neighbours.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(
      <MemoryRouter>
        <NeighbourSourceBars nodeId={5} range={range} />
      </MemoryRouter>
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
    neighbours.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') });
    render(
      <MemoryRouter>
        <NeighbourSourceBars nodeId={5} range={range} />
      </MemoryRouter>
    );
    expect(screen.getByText(/Failed to load: boom/)).toBeTruthy();
  });
});

describe('neighbourSourceLabel', () => {
  it('uses the short name, "LSB n" for an ambiguous last byte, and the id with no name', () => {
    expect(neighbourSourceLabel(source(1, 1, 'AB'))).toBe('AB');
    expect(neighbourSourceLabel(source(2, 1, null))).toBe('!00000002');
    expect(neighbourSourceLabel({ source: 9, source_type: 'lsb', count: 1, candidates: [] })).toBe('LSB 9');
  });
});
