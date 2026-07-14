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
        subtotal: 20,
        discountAmount: 0,
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
    expect(screen.getAllByText(/0 foto\(s\) vendidas até agora/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Este nome alimenta o parâmetro {name} nos modelos de WhatsApp.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Nome da galeria'));
    await user.type(screen.getByLabelText('Nome da galeria'), 'Casamento Centro');
    await user.clear(screen.getByLabelText('Descrição da galeria'));
    await user.type(screen.getByLabelText('Descrição da galeria'), 'Entrega revisada');
    await user.clear(screen.getByLabelText('Código de acesso'));
    await user.type(screen.getByLabelText('Código de acesso'), 'ab12');
    await user.clear(screen.getByLabelText('Cliente'));
    await user.type(screen.getByLabelText('Cliente'), 'Bruna Compradora');
    await user.clear(screen.getByLabelText('Subtotal base'));
    await user.type(screen.getByLabelText('Subtotal base'), '42');
    await user.clear(screen.getByLabelText('Desconto manual'));
    await user.type(screen.getByLabelText('Desconto manual'), '5');
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
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token',
      expect.objectContaining({
        body: expect.stringContaining('"subtotal":42'),
      })
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token',
      expect.objectContaining({
        body: expect.stringContaining('"discountAmount":5'),
      })
    );
    await waitFor(() => expect(baseProps.fetchDashboard).toHaveBeenCalled());
  });

  it('normalizes a legacy WhatsApp gallery to download plus WhatsApp originals when saved', async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ photos: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    render(<SharedLinksPanel {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Ver/Editar' }));

    expect(screen.getByLabelText('Enviar também os originais pelo WhatsApp')).toBeChecked();
    expect(screen.getByRole('spinbutton', { name: /Acesso para download após o pagamento/i })).toHaveValue(7);
    await user.clear(screen.getByLabelText('Desconto manual'));
    await user.click(screen.getByRole('button', { name: 'Salvar galeria' }));

    await waitFor(() => expect(globalThis.fetch.mock.calls.some(([url, options]) => (
      url === '/api/admin/share-sessions/old-token' && options?.method === 'PATCH'
    ))).toBe(true));
    const saveCall = globalThis.fetch.mock.calls.find(([url, options]) => (
      url === '/api/admin/share-sessions/old-token' && options?.method === 'PATCH'
    ));
    const body = JSON.parse(saveCall[1].body);
    expect(body.sendOriginalsViaWhatsapp).toBe(true);
    expect(body.postPaymentAccessDays).toBe(7);
  });

  it('extends an approved gallery download window by seven days', async () => {
    const user = userEvent.setup();
    const paidShare = {
      ...baseProps.dashData.shareRecent[0],
      status: 'opened',
      expiresAt: '2026-07-21T15:00:00.000Z',
      sales: { soldPhotoCount: 1, soldOrderCount: 1, soldAmount: 20 },
    };
    globalThis.fetch = vi.fn(async (url) => new Response(JSON.stringify(
      String(url).endsWith('/extend')
        ? { ...paidShare, expiresAt: '2026-07-28T15:00:00.000Z' }
        : { photos: [], sales: paidShare.sales }
    ), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    render(<SharedLinksPanel {...baseProps} dashData={{ shareRecent: [paidShare] }} />);
    await user.click(screen.getByRole('button', { name: 'Ver/Editar' }));
    await user.click(screen.getByRole('button', { name: 'Estender por 7 dias' }));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token/extend',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ days: 7 }) })
    );
  });

  it('lets the admin remove a gallery discount by leaving the field blank', async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    render(
      <SharedLinksPanel
        {...baseProps}
        dashData={{
          shareRecent: [{
            ...baseProps.dashData.shareRecent[0],
            subtotal: 20,
            discountAmount: 4,
            total: 16,
          }],
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Ver/Editar' }));
    await user.clear(screen.getByLabelText('Desconto manual'));
    await user.click(screen.getByRole('button', { name: 'Salvar galeria' }));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token',
      expect.objectContaining({
        body: expect.stringContaining('"discountAmount":""'),
      })
    );
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
        withAdminMediaToken={(url) => `${url}admin_token=admin123`}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Ver/Editar' }));

    const preview = await screen.findByAltText('Foto 1');
    expect(preview).toHaveAttribute('src', '/api/media/photo_1/thumbadmin_token=admin123');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token',
      expect.objectContaining({ headers: baseProps.adminHeaders() })
    );
  });

  it('loads additional admin gallery photos without replacing existing previews', async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url) === '/api/admin/share-sessions/old-token/photos?cursor=cursor-1&limit=40') {
        return new Response(JSON.stringify({
          photos: [{ id: 'photo_2', url: '/api/media/photo_2/preview', thumbUrl: '/api/media/photo_2/thumb' }],
          photosPage: { hasMore: false, nextCursor: null, totalCount: 2, limit: 40 },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        token: 'old-token',
        photos: [{ id: 'photo_1', url: '/api/media/photo_1/preview', thumbUrl: '/api/media/photo_1/thumb' }],
        photosPage: { hasMore: true, nextCursor: 'cursor-1', totalCount: 2, limit: 40 },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    render(<SharedLinksPanel {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Ver/Editar' }));
    expect(await screen.findByAltText('Foto 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Carregar mais fotos' }));
    expect(await screen.findByAltText('Foto 2')).toBeInTheDocument();
    expect(screen.getByAltText('Foto 1')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token/photos?cursor=cursor-1&limit=40',
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
      'Deseja deletar esta galeria da lista Os arquivos continuarão sob a política de retenção.'
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

  it('reapplies and can undo gallery photo presets from the editor', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    globalThis.fetch = vi.fn(async (url, options = {}) => {
      if (String(url).endsWith('/photo-presets') && options.method === 'POST') {
        return new Response(JSON.stringify({ changedPhotoCount: 2 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (String(url).endsWith('/photo-presets/undo')) {
        return new Response(JSON.stringify({ changedPhotoCount: 2 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        token: 'old-token',
        photoPresetIds: [],
        photoPresetSnapshot: [],
        photos: [{ id: 'photo_1', url: '/api/media/photo_1/preview', thumbUrl: '/api/media/photo_1/thumb' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    render(
      <SharedLinksPanel
        {...baseProps}
        photoPresets={[{ id: 'soft', name: 'Suave', settings: { brightness: 1.1 } }]}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Ver/Editar' }));
    await user.click(await screen.findByLabelText('Suave'));

    expect(await screen.findByAltText('Prévia da primeira foto da galeria')).toHaveAttribute(
      'src',
      '/api/media/photo_1/preview'
    );

    await user.click(screen.getByRole('button', { name: 'Reaplicar preset' }));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token/photo-presets',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"presetIds":["soft"]'),
      })
    );

    await user.click(screen.getByRole('button', { name: 'Desfazer reaplicação' }));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token/photo-presets/undo',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it("assigns and clears a reusable watermark asset from the gallery editor", async () => {
    const user = userEvent.setup();
    let isAssigned = false;
    const asset = {
      id: 'asset_1',
      name: 'Brand X',
      url: '/api/admin/watermark-assets/asset_1/file?admin_token=admin123',
      width: 120,
      height: 80,
      sizeBytes: 4096,
    };
    globalThis.fetch = vi.fn(async (url, options = {}) => {
      if (String(url).endsWith('/watermark') && options.method === 'PATCH') {
        isAssigned = true;
        return new Response(JSON.stringify({
          changedPhotoCount: 2,
          share: { watermarkAssetId: 'asset_1', watermarkSettings: { width: 320, height: 140, opacity: 0.55, instances: 1 } },
          watermarkAsset: asset,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (String(url).endsWith('/watermark') && options.method === 'DELETE') {
        isAssigned = false;
        return new Response(JSON.stringify({ changedPhotoCount: 2, watermarkSettings: { width: 420, height: 140, opacity: 0.55, instances: 1 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        token: 'old-token',
        watermarkAsset: isAssigned ? asset : null,
        watermarkAssetId: isAssigned ? 'asset_1' : '',
        watermarkSettings: isAssigned ? { width: 320, height: 140, opacity: 0.55, instances: 1 } : { width: 420, height: 140, opacity: 0.55, instances: 1 },
        photos: [{ id: 'photo_1', url: '/api/media/photo_1/preview', thumbUrl: '/api/media/photo_1/thumb' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    render(
      <SharedLinksPanel
        {...baseProps}
        watermarkAssets={[asset]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Ver/Editar' }));
    await user.selectOptions(await screen.findByLabelText('Imagem da marca'), 'asset_1');
    await user.clear(screen.getByDisplayValue('420'));
    await user.type(screen.getByLabelText("Largura da marca d'água"), '320');
    await user.click(screen.getByRole('button', { name: 'Aplicar marca' }));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token/watermark',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"assetId":"asset_1"'),
      })
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token/watermark',
      expect.objectContaining({
        body: expect.stringContaining('"width":320'),
      })
    );

    await waitFor(() => expect(screen.getByText('Ativa agora: Brand X')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Usar Plan B' }));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/share-sessions/old-token/watermark',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('allows enabling Stories when active overlay has no story profile', async () => {
    const user = userEvent.setup();
    const setNotice = vi.fn();
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      token: 'old-token',
      overlayAssetId: 'overlay_1',
      overlayEnabled: true,
      overlayAsset: { id: 'overlay_1', identifier: 'Logo', url: '/overlay.png', storyConfigured: false },
      photos: [{ id: 'photo_1', url: '/api/media/photo_1/preview', thumbUrl: '/api/media/photo_1/thumb' }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    render(
      <SharedLinksPanel
        {...baseProps}
        overlayAssets={[{ id: 'overlay_1', identifier: 'Logo', url: '/overlay.png', storyConfigured: false }]}
        setNotice={setNotice}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Ver/Editar' }));
    const storiesToggle = await screen.findByLabelText(/Ativar Stories na galeria/i);
    await user.click(storiesToggle);

    expect(storiesToggle).toBeChecked();
    expect(setNotice).not.toHaveBeenCalled();
  });
});
