import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyManualDiscount, buildCheckoutTotals } from './discounts';
import { DEFAULT_PRICING } from './pricing';

describe('discount helpers property tests', () => {
  it('never returns totals outside the subtotal range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200_000 }),
        fc.integer({ min: 0, max: 200_000 }),
        (subtotalCents, discountCents) => {
          const result = applyManualDiscount(subtotalCents / 100, discountCents / 100);
          expect(result.subtotal).toBeGreaterThanOrEqual(0);
          expect(result.discountAmount).toBeGreaterThanOrEqual(0);
          expect(result.discountAmount).toBeLessThanOrEqual(result.subtotal);
          expect(result.total).toBeGreaterThanOrEqual(0);
          expect(result.total).toBeLessThanOrEqual(result.subtotal);
        }
      )
    );
  });

  it('checkout totals stay internally consistent across package/count combinations', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(DEFAULT_PRICING)),
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 200_000 }),
        (type, count, discountCents) => {
          const totals = buildCheckoutTotals({
            count,
            discountAmount: discountCents / 100,
            pricingOptions: DEFAULT_PRICING,
            type,
          });
          expect(totals.unit).toBeGreaterThanOrEqual(0);
          expect(totals.subtotal).toBeGreaterThanOrEqual(0);
          expect(totals.discountAmount).toBeGreaterThanOrEqual(0);
          expect(totals.discountAmount).toBeLessThanOrEqual(totals.subtotal);
          expect(totals.total).toBeGreaterThanOrEqual(0);
          expect(totals.total).toBeLessThanOrEqual(totals.subtotal);
        }
      )
    );
  });
});
