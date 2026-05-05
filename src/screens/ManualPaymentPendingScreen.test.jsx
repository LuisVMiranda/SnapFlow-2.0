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

    expect(open).toHaveBeenCalledWith('http://localhost:3000/?adminApproval=session_123', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });
});
