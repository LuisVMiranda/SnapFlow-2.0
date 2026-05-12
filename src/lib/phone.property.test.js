import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildStoredPhone, splitStoredPhone, validateClientPhone } from './phone';

const digitText = (minLength, maxLength) =>
  fc.array(fc.integer({ min: 0, max: 9 }), { minLength, maxLength }).map((digits) => digits.join(''));

describe('phone property helpers', () => {
  it('preserves explicit international storage through split/build round trips', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9999 }).map(String),
        digitText(6, 11),
        (countryCode, localNumber) => {
          const stored = buildStoredPhone({ countryCode, localNumber });
          expect(splitStoredPhone(stored)).toEqual({
            countryCode,
            localNumber,
            stored,
          });
        }
      )
    );
  });

  it('never validates a number above the 15-digit WhatsApp limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9999 }).map(String),
        digitText(1, 14),
        (countryCode, localNumber) => {
          const result = validateClientPhone({ countryCode, localNumber });
          if (result.valid) {
            expect(result.normalized.length).toBeGreaterThanOrEqual(7);
            expect(result.normalized.length).toBeLessThanOrEqual(15);
          }
        }
      )
    );
  });
});
