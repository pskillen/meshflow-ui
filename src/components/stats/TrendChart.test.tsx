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
import { statsRangeWindow } from '@/lib/stats-range';
import { markPartialBuckets } from '@/lib/stats-trend';

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

describe('ChartCard', () => {
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
