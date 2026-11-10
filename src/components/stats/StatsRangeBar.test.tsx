import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { STATS_PRESET_KEYS, type StatsRangeKey } from '@/lib/stats-range';
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

  describe('keyboard', () => {
    function setup(value: StatsRangeKey = '7d') {
      const onChange = vi.fn();
      render(<StatsRangeBar value={value} options={STATS_PRESET_KEYS} onChange={onChange} />);
      return { onChange, radio: (name: string) => screen.getByRole('radio', { name }) };
    }

    it('has one tab stop: the selected radio', () => {
      const { radio } = setup('30d');
      expect(radio('30d').tabIndex).toBe(0);
      for (const name of ['24h', '7d', '90d']) expect(radio(name).tabIndex).toBe(-1);
    });

    it('arrows move to and select the neighbour and focus it', () => {
      const { onChange, radio } = setup('7d');
      fireEvent.keyDown(radio('7d'), { key: 'ArrowRight' });
      expect(onChange).toHaveBeenLastCalledWith('30d');
      expect(document.activeElement).toBe(radio('30d'));
      fireEvent.keyDown(radio('7d'), { key: 'ArrowLeft' });
      expect(onChange).toHaveBeenLastCalledWith('24h');
    });

    it('wraps at both ends and Home/End jump to the first/last', () => {
      const { onChange, radio } = setup('24h');
      fireEvent.keyDown(radio('24h'), { key: 'ArrowLeft' });
      expect(onChange).toHaveBeenLastCalledWith('90d');
      fireEvent.keyDown(radio('24h'), { key: 'End' });
      expect(onChange).toHaveBeenLastCalledWith('90d');
      fireEvent.keyDown(radio('24h'), { key: 'Home' });
      expect(onChange).toHaveBeenLastCalledWith('24h');
    });

    it('ignores other keys', () => {
      const { onChange, radio } = setup('7d');
      fireEvent.keyDown(radio('7d'), { key: 'a' });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it('can opt out of sticky', () => {
    render(<StatsRangeBar value="7d" options={STATS_PRESET_KEYS} onChange={() => {}} sticky={false} />);
    expect(screen.getByTestId('stats-range-bar').className).not.toContain('sticky');
  });
});
