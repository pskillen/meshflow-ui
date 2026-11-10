import { describe, expect, it } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import type { StatsRange } from '@/hooks/useStatsRange';
import { STATS_RANGES, statsRangeWindow, type StatsPresetKey } from '@/lib/stats-range';
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

  it('shows a message with no links', () => {
    render(<LinkSNRCharts snrHistory={[]} range={rangeFor('7d')} />);
    expect(screen.getByText(/no snr history for links/i)).toBeInTheDocument();
  });
});
