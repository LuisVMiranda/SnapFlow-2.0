import { describe, expect, it } from 'vitest';
import { applyManualDiscount, buildCheckoutTotals, parseDiscountDraft, validateDiscountDraft } from './discounts';
import { DEFAULT_PRICING } from './pricing';

describe('discount helpers', () => {
  it('parses valid discount drafts and rejects invalid values', () => {
    expect(parseDiscountDraft('12.4')).toEqual({ valid: true, amount: 12.4, message: '' });
    expect(parseDiscountDraft('')).toEqual({ valid: true, amount: 0, message: '' });
    expect(parseDiscountDraft('abc')).toEqual({
      valid: false,
      amount: 0,
      message: 'Informe um desconto em dinheiro maior que zero.',
    });
    expect(parseDiscountDraft('0')).toEqual({
      valid: false,
      amount: 0,
      message: 'Informe um desconto em dinheiro maior que zero.',
    });
  });

  it('caps the effective discount at the subtotal', () => {
    expect(applyManualDiscount(30, 5)).toEqual({
      subtotal: 30,
      discountAmount: 5,
      total: 25,
    });
    expect(applyManualDiscount(30, 99)).toEqual({
      subtotal: 30,
      discountAmount: 30,
      total: 0,
    });
  });

  it('validates discount drafts against the current subtotal', () => {
    expect(validateDiscountDraft({ enabled: false, subtotal: 30, value: '999' })).toEqual({
      valid: true,
      amount: 0,
      message: '',
    });
    expect(validateDiscountDraft({ enabled: true, subtotal: 30, value: '' })).toEqual({
      valid: false,
      amount: 0,
      message: 'Informe o valor do desconto ou desative a opção.',
    });
    expect(validateDiscountDraft({ enabled: true, subtotal: 30, value: '31' })).toEqual({
      valid: false,
      amount: 31,
      message: 'O desconto não pode ser maior que o subtotal desta venda.',
    });
    expect(validateDiscountDraft({ enabled: true, subtotal: 30, value: '5' })).toEqual({
      valid: true,
      amount: 5,
      message: '',
    });
  });

  it('builds checkout totals with package pricing before discount', () => {
    expect(
      buildCheckoutTotals({
        count: 2,
        discountAmount: 5,
        pricingOptions: DEFAULT_PRICING,
        type: 'eventos',
      })
    ).toEqual({
      unit: 15,
      subtotal: 30,
      discountAmount: 5,
      total: 25,
    });
  });
});
