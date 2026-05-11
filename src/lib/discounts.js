import { calcTotal } from './pricing';

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function parseDiscountDraft(value) {
  if (value === undefined || value === null) return { valid: true, amount: 0, message: '' };
  const trimmed = String(value).trim();
  if (!trimmed) return { valid: true, amount: 0, message: '' };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      valid: false,
      amount: 0,
      message: 'Informe um desconto em dinheiro maior que zero.',
    };
  }
  return { valid: true, amount: roundMoney(parsed), message: '' };
}

export function applyManualDiscount(subtotal, discountAmount = 0) {
  const normalizedSubtotal = roundMoney(subtotal);
  const normalizedDiscount = roundMoney(Math.max(0, Number(discountAmount) || 0));
  const appliedDiscount = Math.min(normalizedSubtotal, normalizedDiscount);
  return {
    subtotal: normalizedSubtotal,
    discountAmount: appliedDiscount,
    total: roundMoney(normalizedSubtotal - appliedDiscount),
  };
}

export function validateDiscountDraft({ enabled, subtotal, value }) {
  if (!enabled) {
    return { valid: true, amount: 0, message: '' };
  }
  if (value === undefined || value === null || String(value).trim() === '') {
    return {
      valid: false,
      amount: 0,
      message: 'Informe o valor do desconto ou desative a opção.',
    };
  }
  const parsed = parseDiscountDraft(value);
  if (!parsed.valid) return parsed;
  if (parsed.amount > roundMoney(subtotal)) {
    return {
      valid: false,
      amount: parsed.amount,
      message: 'O desconto não pode ser maior que o subtotal desta venda.',
    };
  }
  return parsed;
}

export function buildCheckoutTotals({ count, discountAmount = 0, pricingOptions, type }) {
  const { unit, total: subtotal } = calcTotal(count, type, pricingOptions);
  return {
    unit,
    ...applyManualDiscount(subtotal, discountAmount),
  };
}
