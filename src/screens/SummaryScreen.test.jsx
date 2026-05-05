import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SummaryScreen } from './SummaryScreen';

const baseProps = {
  activeStage: 'Conferindo valor',
  clientName: '',
  clientPhone: '11999999999',
  count: 2,
  handleCreateShareSession: vi.fn(),
  handleExtendShareSession: vi.fn(),
  handleGeneratePix: vi.fn(),
  handleManualPayment: vi.fn(),
  handleRevokeShareSession: vi.fn(),
  isGeneratingPix: false,
  liveOps: {
    paymentStatus: 'draft',
    deliveryStatus: 'idle',
    deliveryError: null,
    paymentMethod: null,
  },
  noticeBanner: null,
  resetSession: vi.fn(),
  selectedPhotoItems: [{ id: 'p1' }, { id: 'p2' }],
  setClientName: vi.fn(),
  setClientPhone: vi.fn(),
  setScreen: vi.fn(),
  setShareDurationMinutes: vi.fn(),
  shareAccess: null,
  shareActionLoading: false,
  shareDurationMinutes: 30,
  shareToken: '',
  total: 30,
  type: 'eventos',
  unit: 15,
};

describe('SummaryScreen', () => {
  it('lets the photographer type the client name for WhatsApp templates', async () => {
    const props = { ...baseProps, setClientName: vi.fn() };
    render(<SummaryScreen {...props} />);

    await userEvent.type(screen.getByPlaceholderText('Nome de quem vai acessar e pagar'), 'Ana Cliente');

    expect(props.setClientName).toHaveBeenCalled();
    expect(screen.getByText(/\{name\}/)).toBeInTheDocument();
  });

  it('fires Pix and manual payment actions from the checkout buttons', async () => {
    const props = { ...baseProps, handleGeneratePix: vi.fn(), handleManualPayment: vi.fn() };
    render(<SummaryScreen {...props} />);

    await userEvent.click(screen.getByRole('button', { name: 'Gerar QR Code' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pagamento Dinheiro/Cartão' }));

    expect(props.handleGeneratePix).toHaveBeenCalledTimes(1);
    expect(props.handleManualPayment).toHaveBeenCalledWith('manual');
  });

  it('opens a manual WhatsApp link when backend sending needs fallback', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <SummaryScreen
        {...baseProps}
        shareAccess={{
          code: 'AB12',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          link: 'https://snap.test/s/share_1',
          whatsappMessage: 'Abra a galeria https://snap.test/s/share_1 com codigo AB12',
        }}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Abrir WhatsApp manual/i }));

    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/5511999999999?text='),
      '_blank',
      'noopener,noreferrer'
    );
    open.mockRestore();
  });
});
