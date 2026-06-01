import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalizeOverlaySettings } from './useOverlaySettings';

describe('normalizeOverlaySettings', () => {
  it('always returns finite clamped values', () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.oneof(fc.double({ noNaN: false }), fc.string(), fc.constant(null)),
          y: fc.oneof(fc.double({ noNaN: false }), fc.string(), fc.constant(undefined)),
          widthRatio: fc.oneof(fc.double({ noNaN: false }), fc.string()),
          opacity: fc.oneof(fc.double({ noNaN: false }), fc.string()),
        }),
        (input) => {
          const settings = normalizeOverlaySettings(input);
          expect(Number.isFinite(settings.x)).toBe(true);
          expect(Number.isFinite(settings.y)).toBe(true);
          expect(Number.isFinite(settings.widthRatio)).toBe(true);
          expect(Number.isFinite(settings.opacity)).toBe(true);
          expect(settings.x).toBeGreaterThanOrEqual(0);
          expect(settings.x).toBeLessThanOrEqual(1);
          expect(settings.y).toBeGreaterThanOrEqual(0);
          expect(settings.y).toBeLessThanOrEqual(1);
          expect(settings.widthRatio).toBeGreaterThanOrEqual(0.05);
          expect(settings.widthRatio).toBeLessThanOrEqual(1.5);
          expect(settings.opacity).toBeGreaterThanOrEqual(0.05);
          expect(settings.opacity).toBeLessThanOrEqual(1);
        }
      )
    );
  });
});
