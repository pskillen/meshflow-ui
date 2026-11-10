import { cloneElement, isValidElement, type ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

type Params = Record<string, unknown>;
const state = vi.hoisted(() => ({ truncate: false }));
const calls: { types: readonly string[]; params: Params }[] = [];

function snap(stat: string, iso: string, count: number, extra: Record<string, unknown> = {}) {
  return { id: 1, recorded_at: iso, stat_type: stat, constellation_id: null, value: { count, ...extra } };
}

vi.mock('@/hooks/api/useStatsSnapshots', () => ({
  useStatsSnapshotsForTypesSuspense: (types: readonly string[], params: Params) => {
    calls.push({ types, params });
    const day = '2026-11-08T00:00:00Z';
    return Object.fromEntries(
      types.map((t) => {
        const rows = [
          snap(t, day, 10, {
            by_type: { text_message: 4, position: 6 },
            ...(params.bucket ? { samples: 24 } : {}),
          }),
        ];
        return [t, { count: state.truncate ? rows.length + 500 : rows.length, next: null, previous: null, results: rows }];
      })
    );
  },
}));

import { MeshStatsSection } from '@/components/MeshStatsSection';
import { StatsRangeBar } from '@/components/stats/StatsRangeBar';
import { useStatsRange } from '@/hooks/useStatsRange';
import type { MeshStatsProtocolScope } from '@/lib/stats-snapshot-types';

function Harness({ scope }: { scope: MeshStatsProtocolScope }) {
  const range = useStatsRange({ area: 'dashboards' });
  return (
    <>
      <StatsRangeBar value={range.key} options={range.options} onChange={range.setRange} />
      <MeshStatsSection protocolScope={scope} range={range} />
    </>
  );
}

function renderSection(scope: MeshStatsProtocolScope = 'meshtastic', url = '/') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Harness scope={scope} />
    </MemoryRouter>
  );
}

const lastParamsFor = (type: string) => [...calls].reverse().find((c) => c.types.includes(type))!.params;

describe('MeshStatsSection', () => {
  beforeEach(() => {
    calls.length = 0;
    state.truncate = false;
    window.sessionStorage.clear();
  });

  it('defaults to 7d and sends hourly rows (no bucket) for the 6h chart', () => {
    renderSection();
    expect(screen.getByRole('radio', { name: '7d' })).toHaveAttribute('aria-checked', 'true');
    const p = lastParamsFor('online_nodes');
    expect(p.bucket).toBeUndefined();
    expect(p.constellationId).toBe(-1);
    expect(screen.getByText('Over the last 7 days')).toBeInTheDocument();
  });

  it('changing the bar changes the requested window', () => {
    renderSection();
    const span7 = () => {
      const p = lastParamsFor('online_nodes');
      return (p.recordedAtBefore as Date).getTime() - (p.recordedAtAfter as Date).getTime();
    };
    const before = span7();
    fireEvent.click(screen.getByRole('radio', { name: '24h' }));
    expect(span7()).toBeLessThan(before);
    expect(span7()).toBe(24 * 3_600_000);
  });

  it.each(['30d', '90d'])('%s asks for daily rollups and always sends recorded_at_after', (key) => {
    renderSection('both', `/?range=${key}`);
    for (const type of ['online_nodes', 'new_nodes', 'packet_volume']) {
      const p = lastParamsFor(type);
      expect(p.bucket).toBe('1d');
      expect(p.recordedAtAfter).toBeInstanceOf(Date);
      expect((p.recordedAtAfter as Date).getTime() % 86_400_000).toBe(0);
    }
  });

  it('shows a headline and a measure pill on each chart', () => {
    renderSection('meshtastic', '/?range=30d');
    expect(screen.getByTestId('chart-online_nodes-headline')).toHaveTextContent('avg 10');
    expect(screen.getByTestId('chart-new_nodes-headline')).toHaveTextContent('10');
    expect(screen.getByTestId('chart-packet_volume-measure')).toHaveTextContent('Packets per UTC day');
    expect(screen.getByTestId('chart-online_nodes-measure')).toHaveTextContent('daily mean');
  });

  it('marks the headline partial when the API returned only part of the range', () => {
    state.truncate = true;
    renderSection('meshtastic', '/?range=30d');
    expect(screen.getByTestId('chart-new_nodes-headline')).toHaveTextContent('10 (partial)');
    expect(screen.getByTestId('chart-packet_volume-headline')).toHaveTextContent('(partial)');
  });

  it('titles each chart with a heading', () => {
    renderSection();
    for (const name of ['Online nodes', 'New nodes', 'Packet volume']) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument();
    }
  });

  it('keeps the Total / By type toggle on single-protocol dashboards', () => {
    renderSection('meshtastic');
    expect(screen.getByTestId('chart-packet_volume-measure')).not.toHaveTextContent('by packet type');
    fireEvent.click(screen.getByRole('radio', { name: 'Packets by type' }));
    expect(screen.getByTestId('chart-packet_volume-measure')).toHaveTextContent('by packet type');
  });

  it('has no by-type toggle when both protocols are overlaid', () => {
    renderSection('both');
    expect(screen.queryByRole('radio', { name: 'Packets by type' })).toBeNull();
  });

  it('draws Online nodes as a line and the other two as bars', () => {
    renderSection();
    const kinds = screen.getAllByTestId('trend-chart').map((c) => c.getAttribute('data-kind'));
    expect(kinds).toEqual(['line', 'bar', 'bar']);
  });
});
