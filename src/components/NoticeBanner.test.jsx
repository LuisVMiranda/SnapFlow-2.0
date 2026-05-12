import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NoticeBanner } from './NoticeBanner';

describe('NoticeBanner', () => {
  it('renders a dismissible admin notification', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<NoticeBanner notice={{ message: 'Pix confirmado pelo Mercado Pago.', tone: 'success' }} onClose={onClose} />);

    expect(screen.getByRole('status')).toHaveTextContent('Pix confirmado pelo Mercado Pago.');
    await user.click(screen.getByRole('button', { name: 'Fechar notificação' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
