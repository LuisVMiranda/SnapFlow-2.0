const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { HttpError } = require('../src/errors');
const {
  applyManualDiscount,
  normalizeDiscountAmount,
  normalizeSubtotal,
} = require('../src/services/discounts');

test('manual discount math always stays within subtotal bounds', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 500_000 }),
      fc.integer({ min: 0, max: 500_000 }),
      (subtotalCents, discountCents) => {
        const result = applyManualDiscount(subtotalCents / 100, discountCents / 100);
        assert.ok(result.subtotal >= 0);
        assert.ok(result.discountAmount >= 0);
        assert.ok(result.discountAmount <= result.subtotal);
        assert.ok(result.total >= 0);
        assert.ok(result.total <= result.subtotal);
      }
    )
  );
});

test('normalizeSubtotal never crashes on arbitrary invalid inputs', () => {
  fc.assert(
    fc.property(fc.anything(), (value) => {
      try {
        const subtotal = normalizeSubtotal(value, 10);
        assert.ok(Number.isFinite(subtotal));
        assert.ok(subtotal >= 0);
      } catch (error) {
        assert.ok(error instanceof HttpError);
        assert.equal(error.code, 'invalid_subtotal_amount');
      }
    })
  );
});

test('normalizeDiscountAmount accepts only valid values up to the subtotal', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 500_000 }),
      fc.integer({ min: 0, max: 500_000 }),
      (subtotalCents, discountCents) => {
        const subtotal = subtotalCents / 100;
        const validDiscount = Math.min(subtotal, discountCents / 100);
        if (validDiscount === 0) {
          assert.equal(normalizeDiscountAmount('', subtotal), 0);
          return;
        }
        const normalized = normalizeDiscountAmount(validDiscount, subtotal);
        assert.ok(normalized > 0);
        assert.ok(normalized <= subtotal);
      }
    )
  );
});
