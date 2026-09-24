import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ApiAccessPage } from '@/pages/user/ApiAccessPage';

const getM2MKeys = vi.fn();
const getM2MTerms = vi.fn();
const createM2MKey = vi.fn();
const revokeM2MKey = vi.fn();

vi.mock('@/hooks/api/useApi', () => ({
  useMeshflowApi: () => ({
    getM2MKeys,
    getM2MTerms,
    createM2MKey,
    revokeM2MKey,
    acceptM2MTerms: vi.fn(),
  }),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ApiAccessPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ApiAccessPage', () => {
  it('explains how to request access when the list is forbidden', async () => {
    getM2MKeys.mockRejectedValue({ response: { status: 403 } });
    renderPage();
    expect(await screen.findByText(/add you to the m2m_api group/i)).toBeInTheDocument();
  });

  it('requires the terms checkbox before creating a key and shows the secret once', async () => {
    getM2MKeys.mockResolvedValue([]);
    getM2MTerms.mockResolvedValue({ version: '1', grace_days: 90, licence: 'CC BY-NC 4.0', text: 'Be nice' });
    createM2MKey.mockResolvedValue({
      id: '1',
      name: 'dash',
      prefix: 'abcd1234',
      key: 'mfk_abcd1234_secret',
      intended_use: 'site',
      created_at: '',
      last_used_at: null,
      revoked_at: null,
      terms_version: '1',
      terms_action_required: false,
      requests_today: 0,
      requests_30d: 0,
    });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('button', { name: 'Create key' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    await user.type(screen.getByLabelText('Name'), 'dash');
    await user.type(screen.getByLabelText('Intended use'), 'site');
    await user.click(screen.getByRole('button', { name: 'Create key' }));
    expect(await screen.findByTestId('m2m-secret')).toHaveTextContent('mfk_abcd1234_secret');
  });

  it('revokes a key', async () => {
    getM2MKeys.mockResolvedValue([
      {
        id: '1',
        name: 'dash',
        prefix: 'abcd1234',
        intended_use: 'site',
        created_at: '',
        last_used_at: null,
        revoked_at: null,
        terms_version: '1',
        terms_action_required: true,
        requests_today: 1,
        requests_30d: 2,
      },
    ]);
    getM2MTerms.mockResolvedValue({ version: '2', grace_days: 90, licence: 'CC BY-NC 4.0', text: 'Be nice' });
    revokeM2MKey.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText(/Terms need re-acceptance/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(revokeM2MKey).toHaveBeenCalledWith('1');
  });
});
