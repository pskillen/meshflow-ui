import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapMarkerLegend } from './MapMarkerLegend';

const SWATCHES = [{ key: 'router', label: 'ROUTER', color: '#00f' }];

describe('MapMarkerLegend', () => {
  it('renders nothing when there is nothing to show', () => {
    const { container } = render(<MapMarkerLegend showRoleSwatches={false} roleSwatches={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the key as a labelled region and lists the swatches', () => {
    render(<MapMarkerLegend showRoleSwatches roleSwatches={SWATCHES} />);
    const region = screen.getByRole('region', { name: /map marker colours/i });
    expect(region).toHaveTextContent('ROUTER');
  });

  it('is closed by default on phones and opens from the Map key button', async () => {
    const user = userEvent.setup();
    render(<MapMarkerLegend showRoleSwatches roleSwatches={SWATCHES} />);
    const button = screen.getByRole('button', { name: 'Map key' });
    const region = screen.getByRole('region', { name: /map marker colours/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    // Tailwind: hidden below sm, shown from sm up. jsdom has no stylesheet, so assert on the classes.
    expect(region).toHaveClass('hidden', 'sm:block');
    expect(button).toHaveClass('sm:hidden');

    await user.click(button);
    expect(screen.getByRole('button', { name: 'Hide key' })).toHaveAttribute('aria-expanded', 'true');
    expect(region).toHaveClass('block');
    expect(region).not.toHaveClass('hidden');

    await user.click(screen.getByRole('button', { name: 'Hide key' }));
    expect(region).toHaveClass('hidden');
  });
});
