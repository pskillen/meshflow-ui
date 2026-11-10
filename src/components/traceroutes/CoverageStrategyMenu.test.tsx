import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CoverageStrategyMenu, strategyMenuSummary } from './CoverageStrategyMenu';
import { createCoverageStrategiesAllSelected } from '@/lib/traceroute-strategy';

describe('strategyMenuSummary', () => {
  it('says All, None, a single label, or a count', () => {
    const all = createCoverageStrategiesAllSelected();
    expect(strategyMenuSummary(all)).toBe('All');
    expect(strategyMenuSummary({ intra_zone: false, dx_across: false, dx_same_side: false, legacy: false })).toBe(
      'None'
    );
    expect(strategyMenuSummary({ ...all, dx_across: false, dx_same_side: false, legacy: false })).toBe('Intra-zone');
    expect(strategyMenuSummary({ ...all, legacy: false })).toBe('3 of 4');
  });
});

describe('CoverageStrategyMenu', () => {
  it('is collapsed to "Strategies: All" and opens a checkbox per strategy', () => {
    const onChange = vi.fn();
    render(<CoverageStrategyMenu value={createCoverageStrategiesAllSelected()} onChange={onChange} />);
    const button = screen.getByTestId('coverage-strategy-menu');
    expect(button).toHaveTextContent('Strategies:');
    expect(button).toHaveTextContent('All');
    expect(screen.queryByRole('menuitemcheckbox')).not.toBeInTheDocument();

    fireEvent.keyDown(button, { key: 'Enter' });
    const items = screen.getAllByRole('menuitemcheckbox');
    expect(items.map((i) => i.textContent)).toEqual(['Intra-zone', 'DX across', 'DX same side', 'Legacy']);

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Legacy' }));
    expect(onChange).toHaveBeenCalledWith({ ...createCoverageStrategiesAllSelected(), legacy: false });
  });
});
