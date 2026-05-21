import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PendingManualApprovalPrompt } from './PendingManualApprovalPrompt';

describe('PendingManualApprovalPrompt', () => {
  it('renders the first pending manual session with quick actions', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onOpenApproval = vi.fn();

    render(
      <PendingManualApprovalPrompt
        onApprove={onApprove}
        onOpenApproval={onOpenApproval}
        sessions={[
          { amount: 45, clientName: 'Dudis', id: 'manual_1', phone: '+55 21 97519-1926', photoCount: 3 },
          { amount: 30, clientName: 'Bia', id: 'manual_2', photoCount: 2 },
        ]}
      />
    );

    expect(screen.getByText('Pagamento em dinheiro/cartão pendente')).toBeInTheDocument();
    expect(screen.getByText(/Dudis/)).toBeInTheDocument();
    expect(screen.getByText('Mais 1 pedido(s) aguardando em Vendas.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Liberar fotos/i }));
    await user.click(screen.getByRole('button', { name: /Abrir aprovação/i }));

    expect(onApprove).toHaveBeenCalledWith('manual_1');
    expect(onOpenApproval).toHaveBeenCalledWith('manual_1');
  });

  it('does not render when there is no pending session', () => {
    const { container } = render(<PendingManualApprovalPrompt sessions={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
