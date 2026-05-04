import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PixScreen } from './PixScreen';

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
  activeStage: 'Aguardando confirmação do pagamento',
  clientPhone: '11999999999',
  count: 2,
  liveOps: {
    paymentStatus: 'pending',
    deliveryStatus: 'idle',
    deliveryError: null,
    paymentMethod: 'PIX',
  },
  noticeBanner: null,
  pixCopyPaste: 'pix-copia-e-cola',
  pricingOptions,
  qrCodeBase64: '',
  setNotice: vi.fn(),
  setPixCopyPaste: vi.fn(),
  setQrCodeBase64: vi.fn(),
  setScreen: vi.fn(),
  shareToken: '',
  total: 30,
  type: 'eventos',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PixScreen', () => {
  it('shows and copies the configured WhatsApp payment message for admin Pix flows', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const setNotice = vi.fn();

    render(
      <PixScreen
        {...baseProps}
        pixWhatsAppMessage="Pagamento pendente: Abrir pedido: https://snap.test/pedido"
        setNotice={setNotice}
      />
    );

    expect(screen.getByText('Mensagem WhatsApp de cobrança')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copiar mensagem' }));

    expect(writeText).toHaveBeenCalledWith('Pagamento pendente: Abrir pedido: https://snap.test/pedido');
    expect(setNotice).toHaveBeenCalledWith('Mensagem de cobrança copiada.');
  });
});
