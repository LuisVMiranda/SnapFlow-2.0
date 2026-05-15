import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SummaryScreen } from './SummaryScreen';

function buildProps(overrides = {}) {
  return {
    activeStage: 'Conferindo valor',
    clientName: '',
    clientEmail: '',
    clientPhone: '11999999999',
    count: 2,
    discountAmount: 0,
    discountValidation: { valid: true, amount: 0, message: '' },
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
    manualDiscountDraft: '',
    manualDiscountEnabled: false,
    noticeBanner: null,
    resetSession: vi.fn(),
    selectedPhotoItems: [{ id: 'p1' }, { id: 'p2' }],
    setClientEmail: vi.fn(),
    setClientName: vi.fn(),
    setClientPhone: vi.fn(),
    setManualDiscountDraft: vi.fn(),
    setManualDiscountEnabled: vi.fn(),
    setScreen: vi.fn(),
    setShareDurationMinutes: vi.fn(),
    shareAccess: null,
    shareActionLoading: false,
    shareDurationMinutes: 30,
    shareToken: '',
    subtotal: 30,
    total: 30,
    type: 'eventos',
    unit: 15,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SummaryScreen', () => {
  it('lets the client name be typed without exposing template internals in checkout', async () => {
    const props = buildProps({ setClientName: vi.fn() });
    render(<SummaryScreen {...props} />);

    await userEvent.type(screen.getByPlaceholderText('Nome de quem vai acessar e pagar'), 'Ana Cliente');

    expect(props.setClientName).toHaveBeenCalled();
    expect(screen.queryByText(/\{name\}/)).not.toBeInTheDocument();
    expect(screen.queryByText(/modelos de WhatsApp/i)).not.toBeInTheDocument();
  });

  it('keeps Brazil as the default DDI and lets the admin edit it', async () => {
    const props = buildProps();
    function Wrapper() {
      const [phone, setPhone] = useState(props.clientPhone);
      return <SummaryScreen {...props} clientPhone={phone} setClientPhone={setPhone} />;
    }

    render(<Wrapper />);

    expect(screen.getByDisplayValue('55')).toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText('55'));
    await userEvent.type(screen.getByPlaceholderText('55'), '54');
    await userEvent.clear(screen.getByPlaceholderText('Numero sem o DDI'));
    await userEvent.type(screen.getByPlaceholderText('Numero sem o DDI'), '1122334455');

    expect(screen.getByDisplayValue('54')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1122334455')).toBeInTheDocument();
    expect(screen.getByText(/Numero validado para envio: \+54 1122334455/i)).toBeInTheDocument();
  });

  it('accepts an optional client email for manual checkout actions', async () => {
    const props = buildProps({
      clientEmail: 'ana@cliente.com',
      setClientEmail: vi.fn(),
      handleManualPayment: vi.fn(),
    });
    render(<SummaryScreen {...props} />);

    await userEvent.click(screen.getByRole('button', { name: /Pagamento Dinheiro\/Cart/i }));

    expect(screen.getByDisplayValue('ana@cliente.com')).toBeInTheDocument();
    expect(props.handleManualPayment).toHaveBeenCalledWith('manual');
  });

  it('shows discount controls only for direct admin sales', () => {
    render(<SummaryScreen {...buildProps()} />);

    expect(screen.getByText(/Aplicar desconto manual nesta venda/i)).toBeInTheDocument();
    expect(screen.getByText(/Ative apenas quando quiser reduzir manualmente/i)).toBeInTheDocument();
  });

  it('applies manual discount even before the package minimum', () => {
    render(
      <SummaryScreen
        {...buildProps({
          discountAmount: 10,
          discountValidation: { valid: true, amount: 10, message: '' },
          manualDiscountDraft: '10',
          manualDiscountEnabled: true,
          subtotal: 30,
          total: 20,
        })}
      />
    );

    expect(screen.getByText(/Subtotal atual: R\$\s*30,00\. Total final apos desconto: R\$\s*20,00\./i)).toBeInTheDocument();
    expect(screen.getByText(/Desconto concedido pelo fotografo/i)).toBeInTheDocument();
  });

  it('keeps gallery discount read-only for clients and shows the granted discount', () => {
    render(
      <SummaryScreen
        {...buildProps({
          shareToken: 'share_123',
          discountAmount: 10,
          subtotal: 30,
          total: 20,
        })}
      />
    );

    expect(screen.queryByText(/Aplicar desconto manual nesta venda/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Desconto concedido pelo fotografo/i)).toBeInTheDocument();
    expect(screen.getByText(/Este desconto foi concedido pelo fotografo para esta galeria/i)).toBeInTheDocument();
  });

  it('shows client-facing delivery help in shared gallery checkout', () => {
    render(<SummaryScreen {...buildProps({ shareToken: 'share_123' })} />);

    expect(screen.getByText(/suas fotos serao liberadas pelo fotografo/i)).toBeInTheDocument();
    expect(screen.queryByText(/por voce no painel/i)).not.toBeInTheDocument();
  });

  it('fires Pix and manual payment actions from the checkout buttons', async () => {
    const props = buildProps({ handleGeneratePix: vi.fn(), handleManualPayment: vi.fn() });
    render(<SummaryScreen {...props} />);

    await userEvent.click(screen.getByRole('button', { name: /Gerar QR Code/i }));
    await userEvent.click(screen.getByRole('button', { name: /Pagamento Dinheiro\/Cart/i }));

    expect(props.handleGeneratePix).toHaveBeenCalledTimes(1);
    expect(props.handleManualPayment).toHaveBeenCalledWith('manual');
  });

  it('asks for confirmation before creating a free order', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const props = buildProps({
      discountAmount: 30,
      manualDiscountEnabled: true,
      handleGeneratePix: vi.fn(),
      subtotal: 30,
      total: 0,
    });
    render(<SummaryScreen {...props} />);

    await userEvent.click(screen.getByRole('button', { name: /Gerar QR Code/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'Este desconto deixa o pedido gratuito para o cliente. Deseja continuar mesmo assim?'
    );
    expect(props.handleGeneratePix).not.toHaveBeenCalled();
  });

  it('uses client-safe manual payment notice in shared gallery checkout', () => {
    render(
      <SummaryScreen
        {...buildProps({
          activeStage: 'Conferindo pedido',
          liveOps: {
            paymentStatus: 'pending',
            deliveryStatus: 'idle',
            deliveryError: null,
            paymentMethod: 'Dinheiro/Cartão',
          },
          shareToken: 'share_123',
        })}
      />
    );

    expect(screen.getByText(/Pedido enviado ao fotografo/i)).toBeInTheDocument();
    expect(screen.getByText('Aguardando aprovação')).toBeInTheDocument();
    expect(screen.queryByText(/sua confirmacao no painel/i)).not.toBeInTheDocument();
  });

  it('opens a manual WhatsApp link when backend sending needs fallback', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <SummaryScreen
        {...buildProps({
          shareAccess: {
            code: 'AB12',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            link: 'https://snap.test/s/share_1',
            whatsappMessage: 'Abra a galeria https://snap.test/s/share_1 com codigo AB12',
          },
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Abrir WhatsApp manual/i }));

    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/5511999999999?text='),
      '_blank',
      'noopener,noreferrer'
    );
  });
});
