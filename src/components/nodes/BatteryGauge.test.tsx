import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BatteryGauge } from './BatteryGauge';

describe('BatteryGauge', () => {
  it('shows Powered, never 101%, for raw level 101', () => {
    render(<BatteryGauge batteryLevel={101} voltage={4.08} />);
    expect(screen.getByText('4.08V / Powered')).toBeInTheDocument();
    expect(screen.queryByText(/101/)).not.toBeInTheDocument();
  });

  it('shows the percentage for a normal level', () => {
    render(<BatteryGauge batteryLevel={93} voltage={null} />);
    expect(screen.getByText('93%')).toBeInTheDocument();
  });
});
