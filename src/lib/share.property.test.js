import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalizeShareCode } from './share';

describe('normalizeShareCode properties', () => {
  it('keeps output uppercase alphanumeric, bounded, and idempotent', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const normalized = normalizeShareCode(value);
        expect(normalized.length).toBeLessThanOrEqual(4);
        expect(normalized).toMatch(/^[A-Z0-9]*$/);
        expect(normalizeShareCode(normalized)).toBe(normalized);
      })
    );
  });
});
