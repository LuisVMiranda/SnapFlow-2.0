const test = require('node:test');
const assert = require('node:assert/strict');
const { HttpError } = require('../src/errors');
const {
  applyManualDiscount,
  normalizeDiscountAmount,
  normalizeSubtotal,
} = require('../src/services/discounts');

test('normalizeSubtotal accepts non-negative money values', () => {
  assert.equal(normalizeSubtotal(30), 30);
  assert.equal(normalizeSubtotal('12.349'), 12.35);
  assert.equal(normalizeSubtotal('', 18), 18);
});

test('normalizeSubtotal rejects negative and non-numeric values', () => {
  assert.throws(
    () => normalizeSubtotal(-1),
    (error) => error instanceof HttpError && error.code === 'invalid_subtotal_amount'
  );
  assert.throws(
    () => normalizeSubtotal('abc'),
    (error) => error instanceof HttpError && error.code === 'invalid_subtotal_amount'
  );
});

test('normalizeDiscountAmount enforces positive values within the subtotal', () => {
  assert.equal(normalizeDiscountAmount('', 20), 0);
  assert.equal(normalizeDiscountAmount('5.239', 20), 5.24);
  assert.throws(
    () => normalizeDiscountAmount(0, 20),
    (error) => error instanceof HttpError && error.code === 'invalid_discount_amount'
  );
  assert.throws(
    () => normalizeDiscountAmount(-5, 20),
    (error) => error instanceof HttpError && error.code === 'invalid_discount_amount'
  );
  assert.throws(
    () => normalizeDiscountAmount(21, 20),
    (error) => error instanceof HttpError && error.code === 'discount_exceeds_total'
  );
});

test('applyManualDiscount returns a capped total breakdown', () => {
  assert.deepEqual(applyManualDiscount(30, 7.5), {
    subtotal: 30,
    discountAmount: 7.5,
    total: 22.5,
  });
  assert.deepEqual(applyManualDiscount(30, 50), {
    subtotal: 30,
    discountAmount: 30,
    total: 0,
  });
});
