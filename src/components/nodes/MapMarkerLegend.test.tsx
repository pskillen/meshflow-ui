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
    const region = screen.getByRole('region', { name: /map key/i });
    expect(region).toHaveTextContent('ROUTER');
  });

  it('is closed by default on phones and opens from the Map key button', async () => {
    const user = userEvent.setup();
    render(<MapMarkerLegend showRoleSwatches roleSwatches={SWATCHES} />);
    const button = screen.getByRole('button', { name: 'Map key' });
    const region = screen.getByRole('region', { name: /map key/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    // Tailwind: hidden below sm, shown from sm up. jsdom has no stylesheet, so assert on the classes.
    expect(region).toHaveClass('hidden', 'sm:block');
    expect(button).toHaveClass('sm:hidden');

    await user.click(button);
    expect(screen.getByRole('button', { name: 'Map key' })).toHaveAttribute('aria-expanded', 'true');
    expect(region).toHaveClass('block');
    expect(region).not.toHaveClass('hidden');

    await user.click(screen.getByRole('button', { name: 'Map key' }));
    expect(region).toHaveClass('hidden');
  });

  it('keeps one accessible name for the button and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<MapMarkerLegend showRoleSwatches roleSwatches={SWATCHES} />);
    const button = screen.getByRole('button', { name: 'Map key' });
    await user.click(button);
    expect(button).toHaveAccessibleName('Map key');
    expect(button).toHaveClass('min-h-8');
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('region', { name: 'Map key' })).toHaveClass('hidden');
    expect(button).toHaveFocus();
  });
});
