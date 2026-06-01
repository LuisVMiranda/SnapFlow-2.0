const assert = require('node:assert/strict');
const test = require('node:test');
const fc = require('fast-check');
const {
  hasExplicitOverlaySettings,
  normalizeOverlaySettings,
} = require('../src/services/overlaySettingsService');

test('overlay settings normalize finite safe values', () => {
  const settings = normalizeOverlaySettings({ x: -10, y: 99, widthRatio: Infinity, opacity: 0 });

  assert.deepEqual(settings, { x: 0, y: 1, widthRatio: 0.35, opacity: 0.05 });
});

test('overlay settings parser detects explicit values', () => {
  assert.equal(hasExplicitOverlaySettings({ opacity: 0.5 }), true);
  assert.equal(hasExplicitOverlaySettings({}), false);
  assert.equal(hasExplicitOverlaySettings('{bad json'), false);
});

test('random overlay settings are always finite and clamped', () => {
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
        assert.equal(Number.isFinite(settings.x), true);
        assert.equal(Number.isFinite(settings.y), true);
        assert.equal(Number.isFinite(settings.widthRatio), true);
        assert.equal(Number.isFinite(settings.opacity), true);
        assert.equal(settings.x >= 0 && settings.x <= 1, true);
        assert.equal(settings.y >= 0 && settings.y <= 1, true);
        assert.equal(settings.widthRatio >= 0.05 && settings.widthRatio <= 1.5, true);
        assert.equal(settings.opacity >= 0.05 && settings.opacity <= 1, true);
      }
    )
  );
});
