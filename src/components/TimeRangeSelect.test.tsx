import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TimeRangeSelect } from '@/components/TimeRangeSelect';

const HOUR = 3600_000;
const OPTIONS = [
  { key: '2d', label: 'Last 2 days' },
  { key: '7d', label: 'Last 7 days' },
];

describe('TimeRangeSelect', () => {
  it('passes the shared preset window to onChange, exactly N x 24h', () => {
    const onChange = vi.fn();
    render(<TimeRangeSelect options={OPTIONS} value="2d" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Last 7 days' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const [key, range] = onChange.mock.calls[0];
    expect(key).toBe('7d');
    expect(range.endDate.getTime() - range.startDate.getTime()).toBe(7 * 24 * HOUR);
  });
});
