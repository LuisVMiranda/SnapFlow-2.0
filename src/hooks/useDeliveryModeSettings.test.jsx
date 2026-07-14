import { describe, expect, it } from 'vitest';
import { normalizeDeliveryModeSettings } from './useDeliveryModeSettings';

describe('normalizeDeliveryModeSettings', () => {
  it('uses the seven-day download baseline for new installations', () => {
    expect(normalizeDeliveryModeSettings()).toEqual({
      defaultDeliveryMode: 'download',
      defaultPostPaymentAccessDays: 7,
      defaultSendOriginalsViaWhatsapp: false,
    });
  });

  it('keeps legacy WhatsApp settings enabled while normalizing future saves to both', () => {
    expect(normalizeDeliveryModeSettings({ defaultDeliveryMode: 'whatsapp' })).toEqual({
      defaultDeliveryMode: 'both',
      defaultPostPaymentAccessDays: 7,
      defaultSendOriginalsViaWhatsapp: true,
    });
  });
});
