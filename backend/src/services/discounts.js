const { HttpError } = require('../errors');

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function invalidSubtotalError() {
  return new HttpError(
    400,
    'Subtotal inválido. Revise o valor calculado da venda e tente novamente.',
    'invalid_subtotal_amount'
  );
}

function invalidDiscountError() {
  return new HttpError(
    400,
    'Desconto inválido. Informe um valor em dinheiro maior que zero.',
    'invalid_discount_amount'
  );
}

function normalizeSubtotal(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return roundMoney(fallback);

  let parsed;
  try {
    parsed = Number(value);
  } catch {
    parsed = Number.NaN;
  }

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw invalidSubtotalError();
  }

  const rounded = roundMoney(parsed);
  if (!Number.isFinite(rounded) || rounded < 0) {
    throw invalidSubtotalError();
  }

  return rounded;
}

function normalizeDiscountAmount(value, subtotal) {
  if (value === undefined || value === null || value === '') return 0;

  let parsed;
  try {
    parsed = Number(value);
  } catch {
    parsed = Number.NaN;
  }

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw invalidDiscountError();
  }

  const normalizedSubtotal = normalizeSubtotal(subtotal);
  const normalizedDiscount = roundMoney(parsed);
  if (!Number.isFinite(normalizedDiscount) || normalizedDiscount <= 0) {
    throw invalidDiscountError();
  }
  if (normalizedDiscount > normalizedSubtotal) {
    throw new HttpError(
      400,
      'O desconto não pode ser maior que o subtotal desta venda. Revise a quantidade de fotos ou reduza o desconto.',
      'discount_exceeds_total',
      { subtotal: normalizedSubtotal }
    );
  }
  return normalizedDiscount;
}

function applyManualDiscount(subtotal, discountAmount = 0) {
  const normalizedSubtotal = normalizeSubtotal(subtotal);
  const normalizedDiscount = roundMoney(Math.max(0, Number(discountAmount) || 0));
  const appliedDiscount = Math.min(normalizedSubtotal, normalizedDiscount);
  return {
    subtotal: normalizedSubtotal,
    discountAmount: appliedDiscount,
    total: roundMoney(normalizedSubtotal - appliedDiscount),
  };
}

module.exports = {
  applyManualDiscount,
  normalizeDiscountAmount,
  normalizeSubtotal,
  roundMoney,
};
