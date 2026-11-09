import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MeshStatsSection } from '@/components/MeshStatsSection';

const HOUR = 3600_000;
const spans: number[] = [];

type Props = { dateRange: { startDate: Date; endDate: Date } };
const record = ({ dateRange }: Props) => {
  spans.push(dateRange.endDate.getTime() - dateRange.startDate.getTime());
  return null;
};

vi.mock('@/components/OnlineNodesChart', () => ({ OnlineNodesChart: (p: Props) => record(p) }));
vi.mock('@/components/PacketStatsChartFromSnapshots', () => ({
  PacketStatsChartFromSnapshots: (p: Props) => record(p),
}));

const lastSpan = () => spans[spans.length - 1];

function renderSection() {
  render(
    <MemoryRouter>
      <MeshStatsSection />
    </MemoryRouter>
  );
}

describe('MeshStatsSection time range', () => {
  beforeEach(() => {
    spans.length = 0;
  });

  it('starts on a 48 hour window (not "today")', () => {
    renderSection();
    expect(lastSpan()).toBe(48 * HOUR);
  });

  it('gives the same window after re-selecting Last 2 days as on load', () => {
    renderSection();
    fireEvent.click(screen.getByRole('radio', { name: 'Last 7 days' }));
    expect(lastSpan()).toBe(7 * 24 * HOUR);
    fireEvent.click(screen.getByRole('radio', { name: 'Last 2 days' }));
    expect(lastSpan()).toBe(48 * HOUR);
  });
});
