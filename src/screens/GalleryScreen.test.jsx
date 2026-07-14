import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GalleryScreen } from './GalleryScreen';

const baseProps = {
  activeStage: 'Selecionando fotos',
  allPhotosSelected: false,
  brokenPhotoIds: [],
  clientPhone: '11999999999',
  count: 1,
  hasDiscount: false,
  liveOps: {
    paymentMethod: null,
    paymentStatus: 'draft',
    deliveryStatus: 'idle',
    deliveryError: null,
  },
  markBrokenPhoto: vi.fn(),
  photos: [
    { id: 'photo_1', url: '/preview/1.jpg', thumbUrl: '/thumb/1.jpg' },
    { id: 'photo_2', url: '/preview/2.jpg', thumbUrl: '/thumb/2.jpg' },
  ],
  pricingOptions: {
    eventos: {
      label: 'Eventos',
      shortLabel: 'Eventos',
      unit: 10,
      bulk: 8,
      threshold: 3,
    },
  },
  remaining: 2,
  resetSession: vi.fn(),
  selected: ['photo_1'],
  setScreen: vi.fn(),
  setViewerIndex: vi.fn(),
  shareSessionInfo: {},
  shareToken: 'share_1',
  toggle: vi.fn(),
  toggleAllPhotos: vi.fn(),
  total: 10,
  type: 'eventos',
  unit: 10,
};

describe('GalleryScreen paginated shared galleries', () => {
  it('renders shared gallery while metadata is still loading', () => {
    render(
      <GalleryScreen
        {...baseProps}
        shareSessionInfo={null}
        photoPageCounts={{ loadedCount: 2, selectedCount: 1, selectedLoadedCount: 1, totalCount: 5 }}
        photosPage={{ hasMore: false, nextCursor: null, totalCount: 5 }}
      />
    );

    expect(screen.getByText('Modo de Visualização')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalizar pedido' })).toBeEnabled();
  });

  it('shows loaded counters and loads more shared photos', async () => {
    const user = userEvent.setup();
    const loadMorePhotos = vi.fn();
    render(
      <GalleryScreen
        {...baseProps}
        loadMorePhotos={loadMorePhotos}
        photoPageCounts={{ loadedCount: 2, selectedCount: 1, selectedLoadedCount: 1, totalCount: 5 }}
        photosPage={{ hasMore: true, nextCursor: 'cursor', totalCount: 5 }}
      />
    );

    expect(screen.getByRole('button', { name: 'Selecionar fotos carregadas' })).toBeInTheDocument();
    expect(screen.getByText('1 selecionada(s) • 2 de 5 fotos carregadas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Carregar mais fotos' }));
    expect(loadMorePhotos).toHaveBeenCalledTimes(1);
  });

  it('shows retry feedback when a shared photo page fails', async () => {
    const user = userEvent.setup();
    const loadMorePhotos = vi.fn();
    render(
      <GalleryScreen
        {...baseProps}
        loadMorePhotos={loadMorePhotos}
        photoPageCounts={{ loadedCount: 2, selectedCount: 1, selectedLoadedCount: 1, totalCount: 5 }}
        photoPageError="Não foi possível carregar mais fotos."
        photosPage={{ hasMore: true, nextCursor: 'cursor', totalCount: 5 }}
      />
    );

    expect(screen.getByText('Não foi possível carregar mais fotos.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(loadMorePhotos).toHaveBeenCalledTimes(1);
  });
  it('does not expose manual discount pricing before checkout', () => {
    render(
      <GalleryScreen
        {...baseProps}
        photoPageCounts={{ loadedCount: 2, selectedCount: 1, selectedLoadedCount: 1, totalCount: 5 }}
        photosPage={{ hasMore: false, nextCursor: null, totalCount: 5 }}
        subtotal={10}
        total={10}
      />
    );

    expect(screen.queryByText(/Desconto concedido pelo fotógrafo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Subtotal/i)).not.toBeInTheDocument();
  });

  it('shows a subtle floating package nudge while selecting photos', () => {
    render(
      <GalleryScreen
        {...baseProps}
        photoPageCounts={{ loadedCount: 2, selectedCount: 1, selectedLoadedCount: 1, totalCount: 5 }}
        photosPage={{ hasMore: false, nextCursor: null, totalCount: 5 }}
        subtotal={10}
        total={10}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(/Faltam 2 fotos/);
    expect(screen.getByRole('status')).toHaveTextContent(/para ativar R\$\s*8,00 por foto/);
  });

  it('does not render a second client overlay outside server-processed previews', () => {
    const { container } = render(
      <GalleryScreen
        {...baseProps}
        overlaySettings={{
          enabled: true,
          kind: 'image',
          assetUrl: '/overlay.png',
          portrait: { x: 0.5, y: 0.5, widthRatio: 0.4, opacity: 1 },
        }}
        photoPageCounts={{ loadedCount: 2, selectedCount: 1, selectedLoadedCount: 1, totalCount: 5 }}
        photosPage={{ hasMore: false, nextCursor: null, totalCount: 5 }}
      />
    );

    expect(container.querySelector('.gallery-client-overlay')).toBeNull();
  });

  it('shows purchased files, payment confirmation and the post-payment expiry', () => {
    render(
      <GalleryScreen
        {...baseProps}
        photos={[
          { id: 'photo_1', thumbUrl: '/thumb/1.jpg', purchased: true, selectable: false, downloadUrl: '/download/1' },
          { id: 'photo_2', thumbUrl: '/thumb/2.jpg', selectable: true },
        ]}
        photoPageCounts={{ loadedCount: 2, selectedCount: 0, selectedLoadedCount: 0, totalCount: 2 }}
        photosPage={{ hasMore: false, nextCursor: null, totalCount: 2 }}
        selected={[]}
        shareSessionInfo={{
          expiresAt: '2026-07-21T15:00:00.000Z',
          downloads: { purchasedCount: 1, downloadAllUrl: '/download/all' },
        }}
      />
    );

    expect(screen.getByText('Pagamento confirmado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Baixar' })).toHaveAttribute('href', '/download/1');
    expect(screen.getByRole('link', { name: 'Baixar tudo' })).toHaveAttribute('href', '/download/all');
    expect(screen.getByText(/Downloads disponíveis até/i)).toBeInTheDocument();
  });
});
