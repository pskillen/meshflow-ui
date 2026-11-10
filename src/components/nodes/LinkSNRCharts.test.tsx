import { cloneElement, isValidElement, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import type { StatsRange } from '@/hooks/useStatsRange';
import { STATS_RANGES, statsRangeWindow, type StatsPresetKey } from '@/lib/stats-range';

// ResponsiveContainer measures its parent, which jsdom reports as 0x0; give it a fixed size.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      isValidElement(children)
        ? cloneElement(children as ReactElement<{ width: number; height: number }>, { width: 400, height: 190 })
        : null,
  };
});

import { LinkSNRCharts } from './LinkSNRCharts';

const NOW = new Date('2026-11-10T09:37:00Z');

function rangeFor(key: StatsPresetKey): StatsRange {
  const def = STATS_RANGES[key];
  return {
    key,
    longLabel: def.longLabel,
    bucket: def.bucket,
    bucketLabel: def.bucketLabel,
    window: statsRangeWindow(key, NOW),
  } as StatsRange;
}

const link = (id: number, name: string, n: number, day = '2026-11-09') => ({
  peer_node_id: id,
  peer_short_name: name,
  inbound: Array.from({ length: n }, (_, i) => ({
    triggered_at: new Date(Date.parse(`${day}T00:00:00Z`) + i * 3_600_000).toISOString(),
    snr: -5 + i,
  })),
  outbound: [{ triggered_at: `${day}T00:20:00Z`, snr: 4 }],
});

describe('LinkSNRCharts', () => {
  it('draws one card per link with inbound and outbound, headline from what is drawn', () => {
    render(<LinkSNRCharts snrHistory={[link(1, 'PEER', 3)]} range={rangeFor('7d')} />);
    const card = screen.getByTestId('chart-link-snr-1');
    expect(within(card).getByRole('heading', { name: 'SNR with PEER' })).toBeInTheDocument();
    // 6-hour buckets: inbound -5,-4,-3 share one bucket (mean -4.0), outbound 4.0
    expect(within(card).getByTestId('chart-link-snr-1-headline')).toHaveTextContent('avg in -4.0 / out 4.0 dB');
    expect(within(card).getByTestId('chart-link-snr-1-measure')).toHaveTextContent('per 6-hour bucket');
  });

  it('follows the range bucket', () => {
    render(<LinkSNRCharts snrHistory={[link(1, 'PEER', 3, '2026-11-10')]} range={rangeFor('24h')} />);
    expect(screen.getByTestId('chart-link-snr-1-measure')).toHaveTextContent('per hour');
    // hourly buckets: inbound -5, -4, -3 in three buckets (mean -4.0), outbound 4.0 in one
    expect(screen.getByTestId('chart-link-snr-1-headline')).toHaveTextContent('avg in -4.0 / out 4.0 dB');
  });

  it('says so when a link has no samples in the range', () => {
    render(
      <LinkSNRCharts
        snrHistory={[{ peer_node_id: 2, peer_short_name: 'OLD', inbound: [], outbound: [] }]}
        range={rangeFor('24h')}
      />
    );
    expect(screen.getByTestId('chart-link-snr-2-empty')).toHaveTextContent(/no snr samples/i);
    expect(screen.queryByTestId('chart-link-snr-2-headline')).not.toBeInTheDocument();
  });

  it('shows four links and expands the rest', () => {
    const history = Array.from({ length: 6 }, (_, i) => link(i + 1, `P${i + 1}`, 6 - i));
    render(<LinkSNRCharts snrHistory={history} range={rangeFor('7d')} />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: /show all links \(2 more\)/i }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);
  });

  it('draws a dot for a link whose only sample is in the bucket in progress', () => {
    const only = {
      peer_node_id: 3,
      peer_short_name: 'ONE',
      inbound: [{ triggered_at: '2026-11-10T08:00:00Z', snr: -7 }],
      outbound: [],
    };
    const { container } = render(<LinkSNRCharts snrHistory={[only]} range={rangeFor('7d')} />);
    const card = screen.getByTestId('chart-link-snr-3');
    expect(within(card).getByTestId('chart-link-snr-3-headline')).toHaveTextContent('avg in -7.0 dB');
    expect(container.querySelectorAll('[data-testid="chart-link-snr-3"] .recharts-dot')).toHaveLength(1);
  });

  it('keeps the -20..10 scale with ticks every 10, and says how many points are off it', () => {
    const wild = {
      peer_node_id: 4,
      peer_short_name: 'WILD',
      inbound: [
        { triggered_at: '2026-11-09T00:00:00Z', snr: 15 },
        { triggered_at: '2026-11-09T12:00:00Z', snr: -30 },
        { triggered_at: '2026-11-09T18:00:00Z', snr: 2 },
      ],
      outbound: [],
    };
    const { container } = render(<LinkSNRCharts snrHistory={[wild, link(5, 'OK', 2)]} range={rangeFor('7d')} />);
    expect(screen.getByTestId('chart-link-snr-4')).toHaveTextContent('2 points off the scale.');
    expect(screen.getByTestId('chart-link-snr-5')).not.toHaveTextContent('off the scale');
    const ticks = Array.from(
      container.querySelectorAll('[data-testid="chart-link-snr-4"] .recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')
    ).map((t) => t.textContent);
    expect(ticks).toEqual(['-20', '-10', '0', '10']);
  });

  it('shows a message with no links', () => {
    render(<LinkSNRCharts snrHistory={[]} range={rangeFor('7d')} />);
    expect(screen.getByText(/no snr history for links/i)).toBeInTheDocument();
  });
});
