import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MAX_PRESETS_PER_GALLERY,
  PHOTO_PRESET_BOUNDS,
  buildPresetFilter,
  mergePresetIds,
  normalizePhotoPresetIds,
  normalizePhotoPresetSettings,
  resolvePresetStack,
} from './photoPresets';

describe('photo preset properties', () => {
  it('normalizes arbitrary settings inside supported slider ranges', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.constantFrom(...Object.keys(PHOTO_PRESET_BOUNDS)), fc.anything()), (input) => {
        const normalized = normalizePhotoPresetSettings(input);
        for (const [key, bounds] of Object.entries(PHOTO_PRESET_BOUNDS)) {
          expect(normalized[key]).toBeGreaterThanOrEqual(bounds.min);
          expect(normalized[key]).toBeLessThanOrEqual(bounds.max);
          expect(Number.isFinite(normalized[key])).toBe(true);
        }
      })
    );
  });

  it('keeps visible slider labels in Brazilian Portuguese with accents', () => {
    expect(PHOTO_PRESET_BOUNDS.exposure.label).toBe('Exposição');
    expect(PHOTO_PRESET_BOUNDS.saturation.label).toBe('Saturação');
    expect(PHOTO_PRESET_BOUNDS.shadows.label).toBe('Sombras');
    expect(PHOTO_PRESET_BOUNDS.blacks.label).toBe('Pretos');
    expect(PHOTO_PRESET_BOUNDS.whites.label).toBe('Brancos');
  });

  it('never lets selected preset ids exceed the gallery limit', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 0, maxLength: 40 }), { maxLength: 40 }),
        fc.string({ minLength: 1, maxLength: 40 }),
        (ids, nextId) => {
          const normalized = normalizePhotoPresetIds(ids);
          const merged = mergePresetIds(normalized, nextId);
          expect(merged.length).toBeLessThanOrEqual(MAX_PRESETS_PER_GALLERY);
          expect(new Set(merged).size).toBe(merged.length);
        }
      )
    );
  });

  it('resolves preset stacks in the selected order', () => {
    fc.assert(
      fc.property(fc.uniqueArray(
        fc.string({ minLength: 1, maxLength: 12 }).filter((value) => value.trim().length > 0),
        { maxLength: 8, selector: (value) => value.trim().toLowerCase() }
      ), (ids) => {
        const presets = ids.map((id) => ({ id: id.trim().toLowerCase(), name: id, settings: {} }));
        const selected = presets.slice().reverse().slice(0, MAX_PRESETS_PER_GALLERY).map((preset) => preset.id);
        expect(resolvePresetStack(presets, selected).map((preset) => preset.id)).toEqual(selected);
      })
    );
  });

  it('always builds a finite CSS filter string for random preset stacks', () => {
    fc.assert(
      fc.property(fc.array(fc.record({
        settings: fc.dictionary(fc.constantFrom(...Object.keys(PHOTO_PRESET_BOUNDS)), fc.anything()),
      }), { maxLength: 3 }), (stack) => {
        const filter = buildPresetFilter(stack);
        expect(filter).toContain('brightness(');
        expect(filter).not.toContain('NaN');
        expect(filter).not.toContain('Infinity');
      })
    );
  });
});
