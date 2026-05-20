import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ManualPaymentPendingScreen } from './ManualPaymentPendingScreen';

describe('ManualPaymentPendingScreen', () => {
  it('opens focused admin approval URL in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ManualPaymentPendingScreen
        activeStage="Aguardando aprovação manual"
        clientPhone="11999999999"
        count={2}
        liveOps={{ paymentMethod: 'Dinheiro/Cartão', paymentStatus: 'pending', deliveryStatus: 'idle' }}
        pricingOptions={{ eventos: { label: 'Eventos' } }}
        sessionId="session_123"
        setScreen={vi.fn()}
        total={30}
        type="eventos"
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Abrir aprovação no painel' }));

    expect(open).toHaveBeenCalledWith('http://localhost:3000/adminApproval=session_123', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('shows client-safe pending approval output for shared gallery checkout', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const setScreen = vi.fn();

    render(
      <ManualPaymentPendingScreen
        activeStage="Aguardando aprovação manual no painel"
        clientName="Duduzete"
        clientPhone="21975191926"
        count={4}
        liveOps={{ paymentMethod: 'Dinheiro/Cartão', paymentStatus: 'pending', deliveryStatus: 'idle' }}
        pricingOptions={{ escola: { label: 'Escola / Corp' } }}
        sessionId="session_123"
        setScreen={setScreen}
        shareToken="share_123"
        total={40}
        type="escola"
      />
    );

    expect(screen.getByText('Pedido recebido')).toBeInTheDocument();
    expect(screen.getAllByText(/Aguardando aprovação do fotógrafo/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Pedido enviado ao fotógrafo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir aprovação no painel' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Use a nova aba para aprovar/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Voltar para a galeria' }));

    expect(setScreen).toHaveBeenCalledWith('gallery');
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });
});
