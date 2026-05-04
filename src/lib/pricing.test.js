import { describe, expect, it } from 'vitest';
import { calcTotal, normalizePricingOptions, PRICING } from './pricing';

describe('pricing helpers', () => {
  it('uses unit price below the package threshold', () => {
    expect(calcTotal(4, 'eventos')).toEqual({ unit: 15, total: 60 });
  });

  it('uses bulk price at the package threshold', () => {
    expect(calcTotal(PRICING.escola.threshold, 'escola')).toEqual({ unit: 10, total: 30 });
  });

  it('calculates totals from editable package options', () => {
    const pricing = normalizePricingOptions({
      vip: { label: 'VIP', shortLabel: 'VIP', unit: 30, bulk: 22, threshold: 2 },
    });

    expect(calcTotal(2, 'vip', pricing)).toEqual({ unit: 22, total: 44 });
  });
});
