import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StatsRange } from '@/hooks/useStatsRange';
import { STATS_RANGES, statsRangeWindow, type StatsPresetKey } from '@/lib/stats-range';

const sent = vi.hoisted(() => vi.fn());
const received = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/api/usePacketStats', () => ({
  usePacketStatsSuspense: sent,
  useReceivedPacketStatsSuspense: received,
}));

import { NodePacketTypeCard } from './NodePacketTypeCard';
import { PacketTypeChart } from '@/components/PacketTypeChart';
import { ReceivedPacketTypeChart } from '@/components/ReceivedPacketTypeChart';

const NOW = new Date('2026-11-10T09:37:00Z');
const HOUR = 3_600_000;

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

/** What the API returns: one interval per hour or per day, covering the whole query. */
function responseFor(params: { startDate: Date; endDate: Date; intervalType: string }) {
  const step = params.intervalType === 'day' ? 24 * HOUR : HOUR;
  const intervals = [];
  for (let t = params.startDate.getTime(); t < params.endDate.getTime(); t += step) {
    intervals.push({
      start_date: new Date(t).toISOString(),
      end_date: new Date(t + step).toISOString(),
      packets: 3,
      packet_types: [
        { packet_type: 'position', count: 2 },
        { packet_type: 'text_message', count: 1 },
      ],
    });
  }
  return { stats: { start_date: '', end_date: '', intervals, summary: {} } };
}

beforeEach(() => {
  sent.mockReset();
  received.mockReset();
});

describe('NodePacketTypeCard bucket count follows the range', () => {
  const cases: Array<[StatsPresetKey, 'hour' | 'day', number]> = [
    ['24h', 'hour', 24],
    ['7d', 'hour', 29],
    ['30d', 'day', 31],
    ['90d', 'day', 91],
  ];
  it.each(cases)('%s: asks for %s intervals and draws at most %i bars', (key, intervalType, maxBars) => {
    const range = rangeFor(key);
    sent.mockImplementation(responseFor);
    render(<NodePacketTypeCard nodeId={7} range={range} direction="sent" />);
    expect(sent.mock.calls[0]![0]).toMatchObject({ nodeId: 7, interval: 1, intervalType });
    const bars = screen.getByTestId('trend-chart-table').querySelectorAll('tbody tr');
    expect(bars.length).toBeLessThanOrEqual(maxBars);
    expect(bars.length).toBeGreaterThanOrEqual(maxBars - 1);
  });
});

describe('NodePacketTypeCard query and look', () => {
  it('starts at the window start and ends at least at now, so the newest hour is asked for', () => {
    const range = rangeFor('7d');
    sent.mockImplementation(responseFor);
    render(<NodePacketTypeCard nodeId={7} range={range} direction="sent" />);
    const params = sent.mock.calls[0]![0];
    expect(params.startDate.getTime()).toBe(range.window.start.getTime());
    expect(params.endDate.getTime()).toBeGreaterThanOrEqual(NOW.getTime());
  });

  it('is a stacked bar chart by packet type, with the old colours', () => {
    const range = rangeFor('24h');
    sent.mockImplementation(responseFor);
    const { container } = render(<NodePacketTypeCard nodeId={7} range={range} direction="sent" />);
    expect(screen.getByTestId('trend-chart').getAttribute('data-kind')).toBe('bar');
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toContain('--color-text_message: #3b82f6');
    expect(style).toContain('--color-environment_metrics: #ef4444');
    expect(screen.getByTestId('chart-node-packets-sent-headline').textContent).toMatch(/^\d+ packets$/);
  });

  it('sent and received use their own hooks and titles', () => {
    const range = rangeFor('24h');
    sent.mockImplementation(responseFor);
    received.mockImplementation(responseFor);
    render(
      <>
        <PacketTypeChart nodeId={1} range={range} />
        <ReceivedPacketTypeChart nodeId={1} range={range} />
      </>
    );
    expect(screen.getByText('Sent packets')).toBeTruthy();
    expect(screen.getByText('Heard packets')).toBeTruthy();
    expect(sent).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledTimes(1);
  });

  it('says so when there are no packets', () => {
    const range = rangeFor('30d');
    received.mockReturnValue({ stats: { intervals: [] } });
    render(<NodePacketTypeCard nodeId={1} range={range} direction="received" />);
    expect(screen.getByTestId('chart-node-packets-received-empty').textContent).toContain('last 30 days');
  });
});
