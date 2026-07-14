import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeliveryModeSettingsPanel } from './DeliveryModeSettingsPanel';

describe('DeliveryModeSettingsPanel', () => {
  it('saves the global gallery policy in one consolidated request', async () => {
    const onSave = vi.fn();
    render(
      <DeliveryModeSettingsPanel
        onSave={onSave}
        settings={{
          defaultDeliveryMode: 'download',
          defaultPostPaymentAccessDays: 7,
          defaultSendOriginalsViaWhatsapp: false,
        }}
      />
    );

    await userEvent.click(screen.getByLabelText('Enviar também os originais pelo WhatsApp'));
    const days = screen.getByRole('spinbutton', { name: /Acesso para download após o pagamento/i });
    fireEvent.change(days, { target: { value: '30' } });
    fireEvent.blur(days);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar entrega' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      defaultDeliveryMode: 'both',
      defaultPostPaymentAccessDays: 30,
      defaultSendOriginalsViaWhatsapp: true,
    });
  });
});
