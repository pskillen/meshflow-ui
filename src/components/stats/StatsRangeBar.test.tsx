import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { STATS_PRESET_KEYS } from '@/lib/stats-range';
import { StatsRangeBar } from './StatsRangeBar';

describe('StatsRangeBar', () => {
  it('shows the four presets and no Online (2h) by default', () => {
    render(<StatsRangeBar value="7d" options={STATS_PRESET_KEYS} onChange={() => {}} />);
    const labels = screen.getAllByRole('radio').map((r) => r.textContent);
    expect(labels).toEqual(['24h', '7d', '30d', '90d']);
    expect(screen.queryByText('Online (2h)')).toBeNull();
  });

  it('shows Online (2h) only when allowed', () => {
    render(<StatsRangeBar value="7d" options={['2h', ...STATS_PRESET_KEYS]} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Online (2h)' })).toBeTruthy();
  });

  it('marks the selected range and reports changes', () => {
    const onChange = vi.fn();
    render(<StatsRangeBar value="30d" options={STATS_PRESET_KEYS} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: '30d' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: '7d' }).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('radio', { name: '90d' }));
    expect(onChange).toHaveBeenCalledWith('90d');
  });

  it('renders the title and extras slot, and is sticky by default', () => {
    render(
      <StatsRangeBar value="7d" options={STATS_PRESET_KEYS} onChange={() => {}} title="Stats">
        <span>extra filter</span>
      </StatsRangeBar>
    );
    expect(screen.getByText('Stats')).toBeTruthy();
    expect(screen.getByText('extra filter')).toBeTruthy();
    expect(screen.getByTestId('stats-range-bar').className).toContain('sticky');
  });

  it('can opt out of sticky', () => {
    render(<StatsRangeBar value="7d" options={STATS_PRESET_KEYS} onChange={() => {}} sticky={false} />);
    expect(screen.getByTestId('stats-range-bar').className).not.toContain('sticky');
  });
});
