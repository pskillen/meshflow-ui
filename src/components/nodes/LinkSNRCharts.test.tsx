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

  describe('Means / Raw toggle', () => {
    const toggleRaw = () => fireEvent.click(screen.getByRole('radio', { name: 'Raw samples' }));
    const rows = (testId: string) => within(screen.getByTestId(testId)).getAllByRole('row').length - 1; // minus header

    it('defaults to Means', () => {
      render(<LinkSNRCharts snrHistory={[link(1, 'PEER', 3)]} range={rangeFor('7d')} />);
      expect(screen.getByRole('radio', { name: 'Bucket means' })).toBeChecked();
      expect(screen.getByLabelText('SNR view')).toBeInTheDocument();
      expect(screen.getByTestId('chart-link-snr-1-measure')).toHaveTextContent('per 6-hour bucket');
      expect(screen.queryByTestId('snr-points-chart')).not.toBeInTheDocument();
    });

    it('Raw plots every sample, with the raw headline, and switches back', () => {
      render(<LinkSNRCharts snrHistory={[link(1, 'PEER', 3)]} range={rangeFor('7d')} />);
      toggleRaw();
      const card = screen.getByTestId('chart-link-snr-1');
      expect(within(card).getByTestId('snr-points-chart')).toHaveAttribute(
        'aria-label',
        expect.stringContaining('3 inbound, 1 outbound')
      );
      expect(within(card).getByTestId('chart-link-snr-1-measure')).toHaveTextContent("one traceroute's SNR");
      // mean of raw samples -5, -4, -3 and 4
      expect(within(card).getByTestId('chart-link-snr-1-headline')).toHaveTextContent('avg in -4.0 / out 4.0 dB');
      expect(rows('snr-points-table')).toBe(4);
      fireEvent.click(screen.getByRole('radio', { name: 'Bucket means' }));
      expect(screen.queryByTestId('snr-points-chart')).not.toBeInTheDocument();
    });

    it('raw headline is the mean of the samples, not of bucket means', () => {
      // 6-hour buckets: -10 and -10 share one bucket, -1 is alone in the next: bucket mean -5.5, raw mean -7.0
      const l = {
        peer_node_id: 7,
        peer_short_name: 'SKEW',
        inbound: [
          { triggered_at: '2026-11-09T00:10:00Z', snr: -10 },
          { triggered_at: '2026-11-09T00:20:00Z', snr: -10 },
          { triggered_at: '2026-11-09T06:10:00Z', snr: -1 },
        ],
        outbound: [],
      };
      render(<LinkSNRCharts snrHistory={[l]} range={rangeFor('7d')} />);
      expect(screen.getByTestId('chart-link-snr-7-headline')).toHaveTextContent('avg in -5.5 dB');
      toggleRaw();
      expect(screen.getByTestId('chart-link-snr-7-headline')).toHaveTextContent('avg in -7.0 dB');
    });

    it('drops samples before the window and after its end in both views', () => {
      // 24h, hourly buckets: window ends at 09:00 on 2026-11-10
      const l = {
        peer_node_id: 8,
        peer_short_name: 'EDGE',
        inbound: [
          { triggered_at: '2026-11-10T08:30:00Z', snr: -6 },
          { triggered_at: '2026-11-10T09:30:00Z', snr: 9 },
          { triggered_at: '2026-11-08T00:00:00Z', snr: 9 },
        ],
        outbound: [],
      };
      render(<LinkSNRCharts snrHistory={[l]} range={rangeFor('24h')} />);
      expect(screen.getByTestId('chart-link-snr-8-headline')).toHaveTextContent('avg in -6.0 dB');
      toggleRaw();
      expect(screen.getByTestId('chart-link-snr-8-headline')).toHaveTextContent('avg in -6.0 dB');
      expect(rows('snr-points-table')).toBe(1);
    });

    it('counts off-scale samples in Raw', () => {
      const wild = {
        peer_node_id: 4,
        peer_short_name: 'WILD',
        inbound: [
          { triggered_at: '2026-11-09T00:00:00Z', snr: 15 },
          { triggered_at: '2026-11-09T00:30:00Z', snr: 14 },
          { triggered_at: '2026-11-09T12:00:00Z', snr: -30 },
          { triggered_at: '2026-11-09T18:00:00Z', snr: 2 },
        ],
        outbound: [],
      };
      render(<LinkSNRCharts snrHistory={[wild]} range={rangeFor('7d')} />);
      // bucket means: 14.5, -30, 2 -> two off scale
      expect(screen.getByTestId('chart-link-snr-4')).toHaveTextContent('2 points off the scale.');
      toggleRaw();
      expect(screen.getByTestId('chart-link-snr-4')).toHaveTextContent('3 points off the scale.');
    });

    it('caps the screen-reader table and says how many earlier samples it leaves out', () => {
      render(<LinkSNRCharts snrHistory={[link(1, 'BUSY', 230, '2026-10-20')]} range={rangeFor('90d')} />);
      toggleRaw();
      expect(rows('snr-points-table')).toBe(200);
      expect(screen.getByText('and 31 earlier samples')).toBeInTheDocument();
    });

    it('says so in Raw when a link has no samples in the range', () => {
      render(
        <LinkSNRCharts
          snrHistory={[{ peer_node_id: 2, peer_short_name: 'OLD', inbound: [], outbound: [] }]}
          range={rangeFor('24h')}
        />
      );
      toggleRaw();
      expect(screen.getByTestId('chart-link-snr-2-empty')).toHaveTextContent(/no snr samples/i);
    });
  });
});
