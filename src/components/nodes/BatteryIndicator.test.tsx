import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BatteryIndicator } from './NodeCard';

describe('BatteryIndicator', () => {
  it('shows Powered for raw 101', () => {
    render(<BatteryIndicator level={101} />);
    expect(screen.getByText('Powered')).toBeTruthy();
    expect(screen.queryByText('100%')).toBeNull();
  });
  it('shows 0% as a real reading', () => {
    render(<BatteryIndicator level={0} />);
    expect(screen.getByText('0%')).toBeTruthy();
  });
  it('shows the percentage otherwise', () => {
    render(<BatteryIndicator level={72} />);
    expect(screen.getByText('72%')).toBeTruthy();
  });
});
