const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createDeliveryModeSettingsService,
  normalizePostPaymentAccessDays,
} = require('../src/services/deliveryModeService');

function memoryRepos(initial = {}) {
  let settings = { ...initial };
  return {
    async getSettings() {
      return settings;
    },
    async upsertSettings(next) {
      settings = { ...settings, ...next };
    },
  };
}

test('gallery delivery settings default to seven download days without WhatsApp originals', async () => {
  const service = createDeliveryModeSettingsService({ repos: memoryRepos() });

  assert.deepEqual(await service.getSettings(), {
    defaultDeliveryMode: 'download',
    defaultPostPaymentAccessDays: 7,
    defaultSendOriginalsViaWhatsapp: false,
  });
});

test('gallery delivery settings persist days and derive the compatible delivery mode', async () => {
  const service = createDeliveryModeSettingsService({ repos: memoryRepos() });

  assert.deepEqual(await service.updateSettings({
    defaultPostPaymentAccessDays: 14,
    defaultSendOriginalsViaWhatsapp: true,
  }), {
    defaultDeliveryMode: 'both',
    defaultPostPaymentAccessDays: 14,
    defaultSendOriginalsViaWhatsapp: true,
  });
});

test('gallery delivery settings reject access windows outside 1 to 365 days', async () => {
  const service = createDeliveryModeSettingsService({ repos: memoryRepos() });

  await assert.rejects(
    service.updateSettings({ defaultPostPaymentAccessDays: 0 }),
    (error) => error.status === 400 && error.code === 'post_payment_access_days_invalid'
  );
  await assert.rejects(
    service.updateSettings({ defaultPostPaymentAccessDays: 366 }),
    (error) => error.status === 400 && error.code === 'post_payment_access_days_invalid'
  );
});

test('gallery delivery access normalization tolerates values that cannot become numbers', async () => {
  const invalidValue = Object.create(null);
  const service = createDeliveryModeSettingsService({ repos: memoryRepos() });

  assert.equal(normalizePostPaymentAccessDays(invalidValue), 7);
  await assert.rejects(
    service.updateSettings({ defaultPostPaymentAccessDays: invalidValue }),
    (error) => error.status === 400 && error.code === 'post_payment_access_days_invalid'
  );
});
