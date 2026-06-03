const assert = require('node:assert/strict');
const test = require('node:test');
const fc = require('fast-check');
const {
  STORY_OVERLAY_DIMENSIONS,
  hasExplicitOverlaySettings,
  normalizeOverlaySettings,
  normalizeStoryOverlayProfile,
  overlayPlacementForDimensions,
} = require('../src/services/overlaySettingsService');

test('overlay settings normalize finite safe values', () => {
  const settings = normalizeOverlaySettings({ x: -10, y: 99, widthRatio: Infinity, opacity: 0 });

  assert.equal(settings.x, 0);
  assert.equal(settings.y, 1);
  assert.equal(settings.widthRatio, 0.35);
  assert.equal(settings.opacity, 0.05);
  assert.deepEqual(settings.portrait, { x: 0, y: 1, widthRatio: 0.35, opacity: 0.05 });
  assert.deepEqual(settings.landscape, { x: 0, y: 1, widthRatio: 0.35, opacity: 0.05 });
});

test('overlay settings parser detects explicit values', () => {
  assert.equal(hasExplicitOverlaySettings({ opacity: 0.5 }), true);
  assert.equal(hasExplicitOverlaySettings({ portrait: { x: 0.2 } }), true);
  assert.equal(hasExplicitOverlaySettings({}), false);
  assert.equal(hasExplicitOverlaySettings('{bad json'), false);
});

test('overlay settings resolve portrait and landscape placements by dimensions', () => {
  const settings = normalizeOverlaySettings({
    x: 0.5,
    y: 0.5,
    widthRatio: 0.35,
    opacity: 0.75,
    portrait: { x: 0.2, y: 0.8, widthRatio: 0.45, opacity: 0.9 },
    landscape: { x: 0.8, y: 0.2, widthRatio: 0.25, opacity: 0.6 },
  });

  assert.deepEqual(overlayPlacementForDimensions(settings, 800, 1200), settings.portrait);
  assert.deepEqual(overlayPlacementForDimensions(settings, 1200, 800), settings.landscape);
});

test('story overlay profile keeps the asset inside the 9:16 canvas', () => {
  const asset = { width: 1000, height: 3000 };
  const settings = normalizeStoryOverlayProfile({ x: 0, y: 1, widthRatio: 1.5, opacity: 1 }, asset);
  const overlayWidth = Math.round(STORY_OVERLAY_DIMENSIONS.width * settings.widthRatio);
  const overlayHeight = Math.round(overlayWidth * (asset.height / asset.width));
  const left = Math.round((STORY_OVERLAY_DIMENSIONS.width * settings.x) - (overlayWidth / 2));
  const top = Math.round((STORY_OVERLAY_DIMENSIONS.height * settings.y) - (overlayHeight / 2));

  assert.equal(overlayWidth <= STORY_OVERLAY_DIMENSIONS.width, true);
  assert.equal(overlayHeight <= STORY_OVERLAY_DIMENSIONS.height, true);
  assert.equal(left >= 0, true);
  assert.equal(top >= 0, true);
  assert.equal(left + overlayWidth <= STORY_OVERLAY_DIMENSIONS.width, true);
  assert.equal(top + overlayHeight <= STORY_OVERLAY_DIMENSIONS.height, true);
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
