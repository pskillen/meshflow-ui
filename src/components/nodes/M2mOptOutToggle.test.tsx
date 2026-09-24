import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { M2mOptOutToggle } from '@/components/nodes/M2mOptOutToggle';

const patchM2mOptOut = vi.fn();

vi.mock('@/hooks/api/useApi', () => ({
  useMeshflowApi: () => ({ patchM2mOptOut }),
}));

function renderToggle(editable = true) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <M2mOptOutToggle internalId="node-1" optedOut={false} editable={editable} />
    </QueryClientProvider>
  );
}

describe('M2mOptOutToggle', () => {
  it('is hidden when the flag is not editable', () => {
    renderToggle(false);
    expect(screen.queryByLabelText('Exclude from public data API')).not.toBeInTheDocument();
  });

  it('patches on change and rolls back when the request fails', async () => {
    patchM2mOptOut.mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    renderToggle();
    const toggle = screen.getByLabelText('Exclude from public data API');
    await user.click(toggle);
    expect(patchM2mOptOut).toHaveBeenCalledWith('node-1', true);
    expect(await screen.findByText(/Could not update/i)).toBeInTheDocument();
    expect(toggle).toHaveAttribute('data-state', 'unchecked');
  });
});
