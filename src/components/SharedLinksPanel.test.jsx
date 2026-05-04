import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharedLinksPanel } from './SharedLinksPanel';

const pricingOptions = {
  eventos: {
    label: 'Pacote 5+ fotos',
    shortLabel: 'Eventos',
    description: 'R$ 15 por foto.',
    unit: 15,
    bulk: 10,
    threshold: 5,
  },
};

const baseProps = {
  adminHeaders: vi.fn(() => ({ Authorization: 'Bearer admin123' })),
  adminJsonHeaders: vi.fn(() => ({ Authorization: 'Bearer admin123', 'Content-Type': 'application/json' })),
  dashData: {
    shareRecent: [
      {
        token: 'old-token',
        status: 'expired',
        packageType: 'eventos',
        photoCount: 2,
        phone: '11999999999',
        total: 20,
        accessCode: '1234',
        expiresAt: '2026-05-02T12:00:00.000Z',
        link: 'https://snap.test/s/old-token',
      },
    ],
  },
  fetchDashboard: vi.fn(),
  pricingOptions,
  setNotice: vi.fn(),
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('SharedLinksPanel', () => {
  it('shows access code plus recreate and delete actions for expired galleries', () => {
    render(<SharedLinksPanel {...baseProps} />);

    expect(screen.getByText(/código 1234/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recriar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deletar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revogar' })).not.toBeInTheDocument();
  });

  it('opens an inline editor and saves gallery metadata', async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    render(<SharedLinksPanel {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Ver/Editar' }));
    await user.clear(screen.getByLabelText('Código de acesso'));
    await user.type(screen.getByLabelText('Código de acesso'), 'ab12');
    await user.type(screen.getByLabelText('Reabrir por minutos'), '20');
    await user.click(screen.getByRole('button', { name: 'Salvar galeria' }));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"accessCode":"AB12"'),
      })
    );
    await waitFor(() => expect(baseProps.fetchDashboard).toHaveBeenCalled());
  });

  it('asks for Portuguese confirmation before soft-deleting a gallery', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    render(<SharedLinksPanel {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Deletar' }));

    expect(window.confirm).toHaveBeenCalledWith(
      'Deseja deletar esta galeria da lista? Os arquivos continuarão sob a política de retenção.'
    );
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/share-sessions/old-token', expect.objectContaining({ method: 'DELETE' }));
    await waitFor(() => expect(baseProps.fetchDashboard).toHaveBeenCalled());
  });
});
