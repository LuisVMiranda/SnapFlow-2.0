import { describe, expect, it } from 'vitest';
import { formatMoney, formatRemainingCountdown } from './formatters';

describe('formatting helpers', () => {
  it('formats Brazilian money display with a non-breaking space', () => {
    expect(formatMoney(42.5)).toBe('R$\u00a042,50');
  });

  it('formats remaining share access time', () => {
    const now = new Date('2026-05-02T10:00:00.000Z').getTime();
    expect(formatRemainingCountdown('2026-05-02T10:03:07.000Z', now)).toBe('3m 07s');
    expect(formatRemainingCountdown('2026-05-02T09:59:59.000Z', now)).toBe('expira agora');
  });
});
