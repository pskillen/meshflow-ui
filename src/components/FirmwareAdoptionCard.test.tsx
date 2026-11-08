import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatsSnapshot } from '@/lib/models';
import { FirmwareAdoptionCard } from './FirmwareAdoptionCard';

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
    render(<FirmwareAdoptionCard />);
    expect(screen.getByText('No firmware data yet')).toBeInTheDocument();
  });

  it('shows the empty state when rows have no by_type', () => {
    withRows([row(1)]);
    render(<FirmwareAdoptionCard />);
    expect(screen.getByText('No firmware data yet')).toBeInTheDocument();
  });

  it('requests node_firmware for all constellations', () => {
    withRows([]);
    render(<FirmwareAdoptionCard />);
    expect(useStatsSnapshots).toHaveBeenCalledWith(
      expect.objectContaining({ statType: 'node_firmware', constellationId: -1, page_size: 1000 })
    );
  });

  it('renders a breakdown for a single snapshot', () => {
    withRows([row(1, { '2.7': 300, '2.8': 40, unknown: 72 })]);
    render(<FirmwareAdoptionCard />);
    expect(screen.getByTestId('firmware-adoption-card')).toBeInTheDocument();
    expect(screen.getByText('2.7 or earlier')).toBeInTheDocument();
    expect(screen.getByText('2.8+')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('300 (73%)')).toBeInTheDocument();
    expect(screen.getByText('Nodes heard in the last 7 days')).toBeInTheDocument();
  });

  it('shows 2.9+ when a 2.9 key appears', () => {
    withRows([row(2, { '2.7': 1, '2.8': 1, '2.9': 1 }), row(1, { '2.7': 1, '2.8': 1 })]);
    render(<FirmwareAdoptionCard />);
    expect(screen.getByText('2.9+')).toBeInTheDocument();
    expect(screen.queryByText('2.8+')).not.toBeInTheDocument();
  });

  it('shows loading', () => {
    useStatsSnapshots.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<FirmwareAdoptionCard />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows an error', () => {
    useStatsSnapshots.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') });
    render(<FirmwareAdoptionCard />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});
