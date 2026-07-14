import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GalleryDeliveryControl } from './GalleryDeliveryControl';

describe('GalleryDeliveryControl', () => {
  it('keeps the compact toggle inline and maps it to both delivery channels', async () => {
    const onModeChange = vi.fn();
    render(<GalleryDeliveryControl mode="download" onModeChange={onModeChange} />);

    const toggle = screen.getByLabelText('Enviar também os originais pelo WhatsApp');
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);

    expect(onModeChange).toHaveBeenCalledWith('both');
  });

  it('accepts a per-gallery post-payment access override', async () => {
    const onAccessDaysChange = vi.fn();
    render(<GalleryDeliveryControl mode="download" onAccessDaysChange={onAccessDaysChange} postPaymentAccessDays={7} />);

    const input = screen.getByRole('spinbutton', { name: /Acesso para download após o pagamento/i });
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.blur(input);

    expect(onAccessDaysChange).toHaveBeenLastCalledWith(30);
  });
});
