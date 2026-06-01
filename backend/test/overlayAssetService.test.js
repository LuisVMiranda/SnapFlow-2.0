const assert = require('node:assert/strict');
const test = require('node:test');
const fc = require('fast-check');
const {
  createOverlayAssetService,
  normalizeOverlayIdentifier,
} = require('../src/services/overlayAssetService');

test('overlay identifier is required and path-safe', () => {
  assert.equal(normalizeOverlayIdentifier('  brand\\../logo  '), 'brand-..-logo');
  assert.throws(() => normalizeOverlayIdentifier('', ''), /identificador/);
});

test('random overlay identifiers never keep path separators or control chars', () => {
  fc.assert(
    fc.property(fc.string(), (value) => {
      try {
        const normalized = normalizeOverlayIdentifier(value, 'fallback');
        assert.equal(/[\\/]/.test(normalized), false);
        assert.equal([...normalized].some((char) => {
          const code = char.charCodeAt(0);
          return code <= 31 || code === 127;
        }), false);
        assert.equal(normalized.length > 0 && normalized.length <= 80, true);
      } catch (error) {
        assert.equal(error.code, 'overlay_identifier_required');
      }
    })
  );
});

test('overlay asset delete rechecks assignment conflicts after atomic delete miss', async () => {
  let removed = false;
  let assignmentChecks = 0;
  const service = createOverlayAssetService({
    media: {
      removeOverlayAsset: async () => {
        removed = true;
      },
    },
    repos: {
      getOverlayAsset: async () => ({ id: 'asset_a', identifier: 'Brand A', storagePath: 'overlay-assets/a.png' }),
      countOverlayAssetAssignments: async () => {
        assignmentChecks += 1;
        return assignmentChecks === 1 ? 0 : 1;
      },
      deleteOverlayAsset: async () => null,
    },
  });

  await assert.rejects(
    () => service.deleteAsset('asset_a'),
    (error) => error.status === 409 && error.code === 'overlay_asset_in_use'
  );
  assert.equal(removed, false);
});
