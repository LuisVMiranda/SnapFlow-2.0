const assert = require('node:assert/strict');
const test = require('node:test');
const { createWatermarkAssetService } = require('../src/services/watermarkAssetService');

test('watermark asset delete rechecks assignment conflicts after atomic delete miss', async () => {
  let removed = false;
  let assignmentChecks = 0;
  const service = createWatermarkAssetService({
    media: {
      removeWatermarkAsset: async () => {
        removed = true;
      },
    },
    repos: {
      getWatermarkAsset: async () => ({ id: 'asset_a', name: 'Brand A', storagePath: 'watermark-assets/a.png' }),
      countWatermarkAssetAssignments: async () => {
        assignmentChecks += 1;
        return assignmentChecks === 1 ? 0 : 1;
      },
      deleteWatermarkAsset: async () => null,
    },
  });

  await assert.rejects(
    () => service.deleteAsset('asset_a'),
    (error) => error.status === 409 && error.code === 'watermark_asset_in_use'
  );
  assert.equal(removed, false);
});
