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
    await userEvent.clear(screen.getByPlaceholderText('Número sem o DDI'));
    await userEvent.type(screen.getByPlaceholderText('Número sem o DDI'), '1122334455');

    expect(screen.getByDisplayValue('54')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1122334455')).toBeInTheDocument();
    expect(screen.getByText(/Número validado para envio: \+54 1122334455/i)).toBeInTheDocument();
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

  it('shows a package upsell before the package threshold', () => {
    render(<SummaryScreen {...buildProps({ count: 4, subtotal: 60, total: 60 })} />);

    expect(screen.getByText(/Adicione 1 foto\(s\) para pagar R\$\s*10,00 por foto no pacote/i)).toBeInTheDocument();
    expect(screen.getByText(/Economia potencial: R\$\s*25,00/i)).toBeInTheDocument();
  });

  it('shows the active package as the best choice after the threshold', () => {
    render(<SummaryScreen {...buildProps({ count: 5, subtotal: 50, total: 50, unit: 10 })} />);

    expect(screen.getByText(/Pacote ativado: R\$\s*10,00 por foto/i)).toBeInTheDocument();
    expect(screen.getByText(/Economia potencial: R\$\s*25,00/i)).toBeInTheDocument();
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

    expect(screen.getByText(/Subtotal atual: R\$\s*30,00\. Total final após desconto: R\$\s*20,00\./i)).toBeInTheDocument();
    expect(screen.getByText(/Desconto concedido pelo fotógrafo/i)).toBeInTheDocument();
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
    expect(screen.getByText(/Desconto concedido pelo fotógrafo/i)).toBeInTheDocument();
    expect(screen.getByText(/Este desconto foi concedido pelo fotógrafo para esta galeria/i)).toBeInTheDocument();
  });

  it('shows client-facing delivery help in shared gallery checkout', () => {
    render(<SummaryScreen {...buildProps({ shareToken: 'share_123' })} />);

    expect(screen.getByText(/suas fotos serão liberadas pelo fotógrafo/i)).toBeInTheDocument();
    expect(screen.queryByText(/por você no painel/i)).not.toBeInTheDocument();
  });

  it('fires Pix and manual payment actions from the checkout buttons', async () => {
    const props = buildProps({ handleGeneratePix: vi.fn(), handleManualPayment: vi.fn() });
    render(<SummaryScreen {...props} />);

    await userEvent.click(screen.getByRole('button', { name: /Gerar QR Code/i }));
    await userEvent.click(screen.getByRole('button', { name: /Pagamento Dinheiro\/Cart/i }));

    expect(props.handleGeneratePix).toHaveBeenCalledTimes(1);
    expect(props.handleManualPayment).toHaveBeenCalledWith('manual');
  });

  it('sends selected overlay draft when generating direct admin checkout actions', async () => {
    const props = buildProps({
      handleGeneratePix: vi.fn(),
      handleManualPayment: vi.fn(),
      overlayAssets: [{ id: 'overlay_1', identifier: 'Formatura' }],
      selectedOverlayAssetId: 'overlay_1',
      selectedOverlaySettings: {
        portrait: { x: 0.2, y: 0.8, widthRatio: 0.35, opacity: 0.8 },
        landscape: { x: 0.7, y: 0.3, widthRatio: 0.45, opacity: 0.9 },
      },
    });
    render(<SummaryScreen {...props} />);

    await userEvent.click(screen.getByRole('button', { name: /Gerar QR Code/i }));
    await userEvent.click(screen.getByRole('button', { name: /Pagamento Dinheiro\/Cart/i }));

    const overlay = {
      assetId: 'overlay_1',
      settings: {
        portrait: { x: 0.2, y: 0.8, widthRatio: 0.35, opacity: 0.8 },
        landscape: { x: 0.7, y: 0.3, widthRatio: 0.45, opacity: 0.9 },
      },
    };
    expect(props.handleGeneratePix).toHaveBeenCalledWith(overlay);
    expect(props.handleManualPayment).toHaveBeenCalledWith('manual', overlay);
  });

  it('denies Stories delivery until the selected overlay has a story profile', async () => {
    const props = buildProps({
      handleCreateShareSession: vi.fn(),
      overlayAssets: [{ id: 'overlay_1', identifier: 'Moldura azul' }],
      selectedOverlayAssetId: 'overlay_1',
      selectedStoryDeliveryEnabled: true,
      setNotice: vi.fn(),
    });
    render(<SummaryScreen {...props} />);

    await userEvent.click(screen.getByRole('button', { name: /Criar link e enviar WhatsApp/i }));

    expect(props.handleCreateShareSession).not.toHaveBeenCalled();
    expect(props.setNotice).toHaveBeenCalledWith(expect.stringContaining('Configure primeiro o overlay para Stories'));
  });

  it('sends Stories delivery flag when the selected overlay has a story profile', async () => {
    const props = buildProps({
      handleCreateShareSession: vi.fn(),
      overlayAssets: [{
        id: 'overlay_1',
        identifier: 'Moldura azul',
        storyConfigured: true,
      }],
      selectedOverlayAssetId: 'overlay_1',
      selectedStoryDeliveryEnabled: true,
    });
    render(<SummaryScreen {...props} />);

    await userEvent.click(screen.getByRole('button', { name: /Criar link e enviar WhatsApp/i }));

    expect(props.handleCreateShareSession).toHaveBeenCalledWith([], {
      assetId: 'overlay_1',
      storyDeliveryEnabled: true,
    });
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
      'Este desconto deixa o pedido gratuito para o cliente. Deseja continuar mesmo assim'
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

    expect(screen.getByText(/Pedido enviado ao fotógrafo/i)).toBeInTheDocument();
    expect(screen.getByText('Aguardando aprovação')).toBeInTheDocument();
    expect(screen.queryByText(/sua confirmação no painel/i)).not.toBeInTheDocument();
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
            whatsappMessage: 'Abra a galeria https://snap.test/s/share_1 com código AB12',
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

  it('confirms and sends selected photo presets when creating a gallery link', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const props = buildProps({
      handleCreateShareSession: vi.fn(),
      photoPresets: [
        { id: 'soft', name: 'Suave', settings: {} },
        { id: 'night', name: 'Noite', settings: {} },
      ],
      selectedPhotoPresetIds: ['soft'],
    });

    render(<SummaryScreen {...props} />);
    await user.click(screen.getByRole('button', { name: /Criar link e enviar WhatsApp/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'Aplicar os presets selecionados nas fotos desta galeria antes de enviar o link'
    );
    expect(props.handleCreateShareSession).toHaveBeenCalledWith(['soft'], { assetId: '' });
  });

  it('lets admin choose an existing overlay while creating a gallery link', async () => {
    const user = userEvent.setup();
    const props = buildProps({
      handleCreateShareSession: vi.fn(),
      overlayAssets: [
        { id: 'overlay_1', identifier: 'Moldura azul' },
        { id: 'overlay_2', identifier: 'Logo festa' },
      ],
    });

    function Wrapper() {
      const [selectedOverlayAssetId, setSelectedOverlayAssetId] = useState('overlay_1');
      return (
        <SummaryScreen
          {...props}
          selectedOverlayAssetId={selectedOverlayAssetId}
          setSelectedOverlayAssetId={setSelectedOverlayAssetId}
        />
      );
    }

    render(<Wrapper />);

    await user.selectOptions(screen.getByLabelText('Overlay inicial da galeria'), 'overlay_2');
    await user.click(screen.getByRole('button', { name: /Criar link e enviar WhatsApp/i }));

    expect(props.handleCreateShareSession).toHaveBeenCalledWith([], { assetId: 'overlay_2' });
  });

  it('saves initial overlay settings from the creation preview modal', async () => {
    const user = userEvent.setup();
    const props = buildProps({
      handleCreateShareSession: vi.fn(),
      overlayAssets: [{ id: 'overlay_1', identifier: 'Moldura azul', url: '/overlay.png' }],
      selectedPhotoItems: [{ id: 'p1', url: '/preview.jpg' }],
    });

    function Wrapper() {
      const [selectedOverlayAssetId, setSelectedOverlayAssetId] = useState('');
      const [selectedOverlaySettings, setSelectedOverlaySettings] = useState({});
      return (
        <SummaryScreen
          {...props}
          selectedOverlayAssetId={selectedOverlayAssetId}
          selectedOverlaySettings={selectedOverlaySettings}
          setSelectedOverlayAssetId={setSelectedOverlayAssetId}
          setSelectedOverlaySettings={setSelectedOverlaySettings}
        />
      );
    }

    render(<Wrapper />);

    await user.click(screen.getByRole('button', { name: /Adicionar overlay/i }));
    expect(screen.getByRole('dialog', { name: /Ajustar overlay da galeria/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Salvar overlay/i }));
    await user.click(screen.getByRole('button', { name: /Criar link e enviar WhatsApp/i }));

    expect(props.handleCreateShareSession).toHaveBeenCalledWith([], {
      assetId: 'overlay_1',
      settings: expect.objectContaining({
        x: 0.5,
        y: 0.5,
        widthRatio: 0.35,
        opacity: 0.75,
        portrait: { x: 0.5, y: 0.5, widthRatio: 0.35, opacity: 0.75 },
        landscape: { x: 0.5, y: 0.5, widthRatio: 0.35, opacity: 0.75 },
      }),
    });
  });
});
