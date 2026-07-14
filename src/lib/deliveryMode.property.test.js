import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  deliveryModeForOriginals,
  normalizePostPaymentAccessDays,
  sendsOriginalsViaWhatsapp,
} from './deliveryMode';

describe('gallery delivery normalization properties', () => {
  it('always returns an access window inside the supported range', () => {
    fc.assert(fc.property(fc.anything(), (value) => {
      const normalized = normalizePostPaymentAccessDays(value);
      expect(Number.isInteger(normalized)).toBe(true);
      expect(normalized).toBeGreaterThanOrEqual(1);
      expect(normalized).toBeLessThanOrEqual(365);
    }));
  });

  it('round-trips the WhatsApp originals toggle through delivery modes', () => {
    fc.assert(fc.property(fc.boolean(), (enabled) => {
      expect(sendsOriginalsViaWhatsapp(deliveryModeForOriginals(enabled))).toBe(enabled);
    }));
  });
});
