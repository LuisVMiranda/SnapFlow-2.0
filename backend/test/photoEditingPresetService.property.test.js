const assert = require('node:assert/strict');
const test = require('node:test');
const fc = require('fast-check');
const {
  PHOTO_PRESET_BOUNDS,
  normalizePhotoPresetIds,
  normalizePhotoPresetSettings,
  presetToSharpAdjustments,
} = require('../src/services/photoEditingPresetService');

test('random photo preset settings always normalize inside supported bounds', () => {
  fc.assert(
    fc.property(fc.dictionary(fc.string(), fc.oneof(fc.double({ noNaN: true }), fc.string(), fc.boolean(), fc.constant(null))), (input) => {
      const normalized = normalizePhotoPresetSettings(input);
      for (const [key, bounds] of Object.entries(PHOTO_PRESET_BOUNDS)) {
        assert.equal(Number.isFinite(normalized[key]), true);
        assert.ok(normalized[key] >= bounds.min);
        assert.ok(normalized[key] <= bounds.max);
      }
    })
  );
});

test('random preset IDs are deduplicated and never exceed the configured gallery limit silently', () => {
  fc.assert(
    fc.property(fc.array(fc.string(), { maxLength: 12 }), (ids) => {
      const normalizedUniqueCount = new Set(ids.map((id) => String(id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 64)).filter(Boolean)).size;
      if (normalizedUniqueCount > 3) {
        assert.throws(() => normalizePhotoPresetIds(ids), /máximo 3 presets/);
      } else {
        const normalized = normalizePhotoPresetIds(ids);
        assert.ok(normalized.length <= 3);
        assert.equal(new Set(normalized).size, normalized.length);
      }
    })
  );
});

test('random normalized preset settings build finite sharp adjustments', () => {
  fc.assert(
    fc.property(fc.record({
      exposure: fc.double({ noNaN: true }),
      brightness: fc.double({ noNaN: true }),
      contrast: fc.double({ noNaN: true }),
      saturation: fc.double({ noNaN: true }),
      shadows: fc.double({ noNaN: true }),
      blacks: fc.double({ noNaN: true }),
      whites: fc.double({ noNaN: true }),
      hue: fc.double({ noNaN: true }),
      gamma: fc.double({ noNaN: true }),
      temperature: fc.double({ noNaN: true }),
      tint: fc.double({ noNaN: true }),
      sharpen: fc.double({ noNaN: true }),
      jpegQuality: fc.double({ noNaN: true }),
    }), (input) => {
      const adjustments = presetToSharpAdjustments(input);
      for (const value of Object.values(adjustments)) {
        assert.equal(Number.isFinite(value), true);
      }
      assert.ok(adjustments.gamma >= 1 && adjustments.gamma <= 3);
      assert.ok(adjustments.jpegQuality >= 60 && adjustments.jpegQuality <= 98);
    })
  );
});
