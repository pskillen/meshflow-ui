import { cloneElement, isValidElement, type ReactElement } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

import { TrendChart } from '@/components/stats/TrendChart';
import { ChartCard } from '@/components/stats/ChartCard';
import { statsRangeBucket, statsRangeWindow } from '@/lib/stats-range';
import { buildBucketGrid, evenTrendTicks, markPartialBuckets } from '@/lib/stats-trend';

const NOW = new Date('2026-11-09T14:30:00Z');
const series = [{ key: 'v', label: 'Packets', color: 'hsl(var(--chart-1))' }];

function rowsFor(range: '7d' | '30d') {
  const w = statsRangeWindow(range, NOW);
  const step = range === '7d' ? 6 * 3_600_000 : 86_400_000;
  const rows = [];
  for (let t = w.start.getTime(); t <= w.lastBucketStart.getTime(); t += step) rows.push({ timestamp: t, v: 5 });
  return { w, rows: markPartialBuckets(rows, w, range === '7d' ? '6h' : 'daily') };
}

describe('TrendChart', () => {
  it('renders bars, with the in-progress bucket drawn as a faded dashed rectangle', () => {
    const { w, rows } = rowsFor('30d');
    const { container } = render(<TrendChart kind="bar" rows={rows} series={series} window={w} bucket="daily" />);
    const bars = container.querySelectorAll('.recharts-bar-rectangle path, .recharts-bar-rectangle rect');
    expect(bars.length).toBe(31);
    const partial = Array.from(bars).filter((b) => b.getAttribute('stroke-dasharray') === '3 2');
    expect(partial).toHaveLength(1);
    expect(partial[0]?.getAttribute('fill-opacity')).toBe('0.4');
  });

  it('draws a line plus a dashed continuation for the partial bucket', () => {
    const { w, rows } = rowsFor('7d');
    const { container } = render(<TrendChart kind="line" rows={rows} series={series} window={w} bucket="6h" />);
    const curves = container.querySelectorAll('.recharts-line-curve');
    expect(curves).toHaveLength(2);
    expect(Array.from(curves).some((c) => c.getAttribute('stroke-dasharray') === '4 3')).toBe(true);
  });

  it('draws a series dashed when asked, and hides the legend when asked', () => {
    const { w, rows } = rowsFor('30d');
    const two = [...series, { key: 'v2', label: 'Other', color: 'hsl(var(--chart-2))', dashed: true }];
    const both = rows.map((r) => ({ ...r, v2: 3 }));
    const { container, rerender } = render(
      <TrendChart kind="line" rows={both} series={two} window={w} bucket="daily" />
    );
    const dashed = Array.from(container.querySelectorAll('.recharts-line-curve')).filter(
      (c) => c.getAttribute('stroke-dasharray') === '5 3'
    );
    expect(dashed).toHaveLength(1);
    expect(container.querySelector('.recharts-legend-wrapper')).not.toBeNull();
    rerender(<TrendChart kind="line" rows={both} series={two} window={w} bucket="daily" legend={false} />);
    expect(container.querySelector('.recharts-legend-wrapper')).toBeNull();
  });

  it('puts every bucket of the window on the x axis even when data is missing', () => {
    const w = statsRangeWindow('90d', NOW);
    const { container } = render(
      <TrendChart
        kind="bar"
        rows={[{ timestamp: w.start.getTime(), v: 3 }]}
        series={series}
        window={w}
        bucket="daily"
      />
    );
    // One slot per bucket: the axis spans the whole 90 days (91 UTC days with the one in progress), not the one row.
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(91);
  });
});

describe('TrendChart accessibility and ticks', () => {
  it('names the chart from its data and follows it with a table of every bucket', () => {
    const { w, rows } = rowsFor('30d');
    const { getByTestId } = render(
      <TrendChart
        kind="bar"
        rows={rows}
        series={series}
        window={w}
        bucket="daily"
        label="Packet volume, last 30 days"
        headline="155"
      />
    );
    const name = getByTestId('trend-chart').getAttribute('aria-label') ?? '';
    expect(name).toContain('Packet volume, last 30 days.');
    expect(name).toContain('One value per UTC day.');
    expect(name).toContain('155.');
    expect(name).toContain('Latest, Mon 9 Nov (UTC day): Packets 5.');
    expect(name).toContain('The last bucket is in progress.');
    const table = getByTestId('trend-chart-table');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(31);
    expect(table.querySelector('tbody tr:last-child')).toHaveTextContent('Mon 9 Nov (UTC day) (partial)5');
  });

  it('points aria-describedby at the card headline', () => {
    const { w, rows } = rowsFor('30d');
    const { getByTestId } = render(
      <ChartCard title="Packet volume" headline="155" data-testid="c">
        <TrendChart kind="bar" rows={rows} series={series} window={w} bucket="daily" />
      </ChartCard>
    );
    const id = getByTestId('trend-chart').getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).toHaveTextContent('155');
  });

  it('draws evenly spaced x ticks at 24h, 7d and 90d', () => {
    for (const range of ['24h', '7d', '30d', '90d'] as const) {
      const w = statsRangeWindow(range, NOW);
      const bucket = statsRangeBucket(range);
      const ts = buildBucketGrid(w, bucket);
      const ticks = evenTrendTicks(ts);
      expect(ticks.length).toBeGreaterThanOrEqual(4);
      expect(ticks.length).toBeLessThanOrEqual(7);
      expect(new Set(ticks.slice(1).map((t, i) => t - ticks[i]!)).size).toBe(1);
      expect(ticks[0]).toBe(ts[0]);
    }
    const { container } = render(
      <TrendChart
        kind="bar"
        rows={[]}
        series={series}
        window={statsRangeWindow('24h', NOW)}
        bucket="hourly"
      />
    );
    expect(container.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick')).toHaveLength(6);
  });
});

describe('ChartCard', () => {
  it('titles the card with a heading', () => {
    const { getByRole } = render(
      <ChartCard title="Online nodes">
        <div />
      </ChartCard>
    );
    expect(getByRole('heading', { level: 3, name: 'Online nodes' })).toBeInTheDocument();
  });

  it('shows title, headline, measure pill and slot', () => {
    const { getByText, getByTestId } = render(
      <ChartCard title="Packet volume" headline="16,867" measure="Packets per 6-hour bucket" data-testid="c">
        <div>slot</div>
      </ChartCard>
    );
    expect(getByText('Packet volume')).toBeInTheDocument();
    expect(getByTestId('c-headline')).toHaveTextContent('16,867');
    expect(getByTestId('c-measure')).toHaveTextContent('Packets per 6-hour bucket');
    expect(getByText('slot')).toBeInTheDocument();
  });
});
