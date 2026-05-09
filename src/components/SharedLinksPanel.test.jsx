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
        clientName: 'Ana Cliente',
        phone: '11999999999',
        total: 20,
        accessCode: '1234',
        expiresAt: '2026-05-02T12:00:00.000Z',
        link: 'https://snap.test/s/old-token',
        galleryName: 'Galeria Família',
        galleryDescription: 'Escolha final do aniversário',
        sales: {
          soldPhotoCount: 0,
          soldOrderCount: 0,
          soldAmount: 0,
          lastSoldAt: null,
        },
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
  it('shows gallery metadata, sales summary and delete actions for expired galleries', () => {
    render(<SharedLinksPanel {...baseProps} />);

    expect(screen.getByText('Galeria Família')).toBeInTheDocument();
    expect(screen.getByText('Escolha final do aniversário')).toBeInTheDocument();
    expect(screen.getByText(/código 1234/i)).toBeInTheDocument();
    expect(screen.getByText('Cliente: Ana Cliente')).toBeInTheDocument();
    expect(screen.getByText(/0 foto\(s\) vendidas até agora em 0 pedido\(s\)/i)).toBeInTheDocument();
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
    expect(screen.getAllByText(/0 foto\(s\) vendidas até agora em 0 pedido\(s\)/i).length).toBeGreaterThan(1);
    expect(screen.getByText(/Este nome alimenta o parâmetro \{name\}/i)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Nome da galeria'));
    await user.type(screen.getByLabelText('Nome da galeria'), 'Casamento Centro');
    await user.clear(screen.getByLabelText('Descrição da galeria'));
    await user.type(screen.getByLabelText('Descrição da galeria'), 'Entrega revisada');
    await user.clear(screen.getByLabelText('Código de acesso'));
    await user.type(screen.getByLabelText('Código de acesso'), 'ab12');
    await user.clear(screen.getByLabelText('Cliente'));
    await user.type(screen.getByLabelText('Cliente'), 'Bruna Compradora');
    await user.type(screen.getByLabelText('Reabrir por minutos'), '20');
    await user.click(screen.getByRole('button', { name: 'Salvar galeria' }));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"accessCode":"AB12"'),
      })
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token',
      expect.objectContaining({
        body: expect.stringContaining('"clientName":"Bruna Compradora"'),
      })
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token',
      expect.objectContaining({
        body: expect.stringContaining('"galleryName":"Casamento Centro"'),
      })
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token',
      expect.objectContaining({
        body: expect.stringContaining('"galleryDescription":"Entrega revisada"'),
      })
    );
    await waitFor(() => expect(baseProps.fetchDashboard).toHaveBeenCalled());
  });

  it('loads scoped photo previews when viewing a gallery', async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      token: 'old-token',
      photos: [{ id: 'photo_1', url: '/api/media/photo_1/preview', thumbUrl: '/api/media/photo_1/thumb' }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    render(
      <SharedLinksPanel
        {...baseProps}
        withAdminMediaToken={(url) => `${url}?admin_token=admin123`}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Ver/Editar' }));

    const preview = await screen.findByAltText('Foto 1');
    expect(preview).toHaveAttribute('src', '/api/media/photo_1/thumb?admin_token=admin123');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token',
      expect.objectContaining({ headers: baseProps.adminHeaders() })
    );
  });

  it('uploads and removes photos inside the selected gallery only', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    globalThis.fetch = vi.fn(async (url, options = {}) => {
      if (String(url).endsWith('/photos') && options.method === 'POST') {
        return new Response(JSON.stringify({
          token: 'old-token',
          photos: [{ id: 'photo_2', url: '/api/media/photo_2/preview', thumbUrl: '/api/media/photo_2/thumb' }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (String(url).endsWith('/photos/photo_2') && options.method === 'DELETE') {
        return new Response(JSON.stringify({ success: true, photoId: 'photo_2' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        token: 'old-token',
        photos: [{ id: 'photo_2', url: '/api/media/photo_2/preview', thumbUrl: '/api/media/photo_2/thumb' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    render(<SharedLinksPanel {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Ver/Editar' }));
    await screen.findByAltText('Foto 1');

    await user.upload(
      screen.getByLabelText('Adicionar fotos'),
      new File(['fake'], 'foto.jpg', { type: 'image/jpeg' })
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token/photos',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
    );

    await user.click(await screen.findByRole('button', { name: 'Remover' }));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token/photos/photo_2',
      expect.objectContaining({ method: 'DELETE' })
    );
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

  it('shows non-zero sales metadata in gallery lists', () => {
    render(
      <SharedLinksPanel
        {...baseProps}
        dashData={{
          shareRecent: [{
            ...baseProps.dashData.shareRecent[0],
            sales: {
              soldPhotoCount: 3,
              soldOrderCount: 2,
              soldAmount: 45,
              lastSoldAt: '2026-05-08T10:00:00.000Z',
            },
          }],
        }}
      />
    );

    expect(screen.getByText(/3 foto\(s\) vendidas até agora em 2 pedido\(s\) - R\$\s*45,00/i)).toBeInTheDocument();
  });
});
