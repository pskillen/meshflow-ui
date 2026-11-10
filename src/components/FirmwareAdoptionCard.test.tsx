import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatsSnapshot } from '@/lib/models';
import { FirmwareAdoptionCard } from './FirmwareAdoptionCard';
import { STATS_RANGES, statsRangeWindow, type StatsRangeKey } from '@/lib/stats-range';
import type { StatsRange } from '@/hooks/useStatsRange';

const NOW = new Date('2026-11-09T10:30:00Z');

function rangeFor(key: StatsRangeKey): StatsRange {
  const def = STATS_RANGES[key];
  return {
    key,
    def,
    label: def.label,
    longLabel: def.longLabel,
    bucket: def.bucket,
    bucketLabel: def.bucketLabel,
    window: statsRangeWindow(key, NOW),
    options: [key],
    setRange: () => {},
  };
}

const useStatsSnapshots = vi.fn();
vi.mock('@/hooks/api/useStatsSnapshots', () => ({
  useStatsSnapshots: (...args: unknown[]) => useStatsSnapshots(...args),
}));

function row(day: number, by_type?: Record<string, number>): StatsSnapshot {
  return {
    id: day,
    recorded_at: `2026-11-${String(day).padStart(2, '0')}T00:00:00Z`,
    stat_type: 'node_firmware',
    constellation_id: null,
    value: { count: 0, window_hours: 168, ...(by_type ? { by_type } : {}) },
  };
}

function globalRow(id: number, day: number, by_type: Record<string, number>, constellation_id: number | null) {
  return { ...row(day, by_type), id, constellation_id };
}

function breakdown() {
  return within(screen.getByRole('list', { name: 'Firmware breakdown' }));
}

function withRows(rows: StatsSnapshot[]) {
  useStatsSnapshots.mockReturnValue({
    data: { count: rows.length, next: null, previous: null, results: rows },
    isLoading: false,
    error: null,
  });
}

describe('FirmwareAdoptionCard', () => {
  beforeEach(() => useStatsSnapshots.mockReset());

  it('shows the empty state with no rows', () => {
    withRows([]);
    render(<FirmwareAdoptionCard range={rangeFor('7d')} />);
    expect(screen.getByText('No firmware data yet')).toBeInTheDocument();
  });

  it('shows the empty state when rows have no by_type', () => {
    withRows([row(1)]);
    render(<FirmwareAdoptionCard range={rangeFor('7d')} />);
    expect(screen.getByText('No firmware data yet')).toBeInTheDocument();
  });

  it('requests node_firmware for all constellations', () => {
    withRows([]);
    render(<FirmwareAdoptionCard range={rangeFor('7d')} />);
    expect(useStatsSnapshots).toHaveBeenCalledWith(
      expect.objectContaining({ statType: 'node_firmware', constellationId: -1, page_size: 1000 })
    );
  });

  it('renders a breakdown for a single snapshot', () => {
    withRows([row(1, { '2.7': 300, '2.8': 40, unknown: 72 })]);
    render(<FirmwareAdoptionCard range={rangeFor('7d')} />);
    expect(screen.getByTestId('firmware-adoption-card')).toBeInTheDocument();
    expect(breakdown().getByText('2.7 or earlier')).toBeInTheDocument();
    expect(breakdown().getByText('2.8+')).toBeInTheDocument();
    expect(breakdown().getByText('Unknown')).toBeInTheDocument();
    expect(breakdown().getByText('300 · 73%')).toBeInTheDocument();
    expect(screen.getByText(/Split: nodes heard in the last 7d/)).toBeInTheDocument();
  });

  it('shows 2.9+ when a 2.9 key appears', () => {
    withRows([row(2, { '2.7': 1, '2.8': 1, '2.9': 1 }), row(1, { '2.7': 1, '2.8': 1 })]);
    render(<FirmwareAdoptionCard range={rangeFor('7d')} />);
    expect(breakdown().getByText('2.9+')).toBeInTheDocument();
    expect(breakdown().queryByText('2.8+')).not.toBeInTheDocument();
  });

  it('ignores per-constellation rows and uses only the global snapshot', () => {
    withRows([globalRow(1, 1, { '2.7': 10, '2.8': 10 }, null), globalRow(2, 2, { '2.7': 500, '2.9': 500 }, 3)]);
    render(<FirmwareAdoptionCard range={rangeFor('7d')} />);
    expect(breakdown().getAllByText('10 · 50%')).toHaveLength(2);
    expect(screen.queryByText(/500/)).not.toBeInTheDocument();
    expect(breakdown().queryByText('2.9+')).not.toBeInTheDocument();
  });

  it('shows the empty state when the newest row is all zeros', () => {
    withRows([row(1, { '2.7': 0, '2.8': 0, unknown: 0 })]);
    render(<FirmwareAdoptionCard range={rangeFor('7d')} />);
    expect(screen.getByText('No firmware data yet')).toBeInTheDocument();
  });

  it('shows <1% for tiny slices', () => {
    withRows([row(1, { '2.7': 1000, '2.8': 1 })]);
    render(<FirmwareAdoptionCard range={rangeFor('7d')} />);
    expect(breakdown().getByText('1 · <1%')).toBeInTheDocument();
  });

  it('makes the note follow the highest generation', () => {
    withRows([row(1, { '2.7': 1, '2.8': 1, '2.9': 1 })]);
    render(<FirmwareAdoptionCard range={rangeFor('7d')} />);
    expect(screen.getByText(/^2\.9\+ means that generation or later was identified/)).toBeInTheDocument();
    expect(screen.queryByText(/2\.8\+ means/)).not.toBeInTheDocument();
  });

  it('keeps the split on the latest snapshot and the trend on the range', () => {
    withRows([row(9, { '2.7': 5, '2.8': 5 }), row(8, { '2.7': 6, '2.8': 4 }), row(1, { '2.7': 9, '2.8': 1 })]);
    render(<FirmwareAdoptionCard range={rangeFor('24h')} />);
    expect(breakdown().getAllByText('5 · 50%')[0]).toBeInTheDocument();
    expect(screen.getByTestId('firmware-adoption-card-headline')).toHaveTextContent('10 nodes');
    expect(screen.getByText(/Only 2 daily snapshots in this range/)).toBeInTheDocument();
  });

  it('reaches back to the range start on long ranges and three days on short ones', () => {
    withRows([row(9, { '2.7': 5 })]);
    const { unmount } = render(<FirmwareAdoptionCard range={rangeFor('90d')} />);
    const long = useStatsSnapshots.mock.calls.at(-1)![0] as { recordedAtAfter: Date; recordedAtBefore: Date };
    expect(long.recordedAtAfter.getTime()).toBe(statsRangeWindow('90d', NOW).start.getTime());
    unmount();
    render(<FirmwareAdoptionCard range={rangeFor('24h')} />);
    const short = useStatsSnapshots.mock.calls.at(-1)![0] as { recordedAtAfter: Date; recordedAtBefore: Date };
    expect(short.recordedAtBefore.getTime() - short.recordedAtAfter.getTime()).toBe(3 * 24 * 3600 * 1000);
  });

  it('draws the split bar for wide screens and a counts list for all', () => {
    withRows([row(1, { '2.7': 3, unknown: 1 })]);
    render(<FirmwareAdoptionCard range={rangeFor('7d')} />);
    expect(screen.getByTestId('firmware-split-bar')).toHaveClass('hidden', 'md:flex');
    expect(screen.getByRole('list', { name: 'Firmware breakdown' })).toBeInTheDocument();
  });

  it('shows loading', () => {
    useStatsSnapshots.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<FirmwareAdoptionCard range={rangeFor('7d')} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows an error', () => {
    useStatsSnapshots.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') });
    render(<FirmwareAdoptionCard range={rangeFor('7d')} />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});
