const assert = require('node:assert/strict');
const test = require('node:test');
const { createDeliveryQueue } = require('../src/services/deliveryQueue');

test('delivery queue uses the configured WhatsApp thank-you message', async () => {
  let claimed = false;
  let sentMessage = '';
  const repos = {
    async claimDeliveryJob() {
      if (claimed) return null;
      claimed = true;
      return { id: 7, session_id: 'sess_1' };
    },
    async getSession() {
      return { id: 'sess_1', phone: '11999999999', clientName: 'Ana Cliente' };
    },
    async listPhotosForSession() {
      return [{ id: 'photo_1' }, { id: 'photo_2' }];
    },
    async updateDeliveryStatus() {},
    async completeDeliveryJob() {},
    async failDeliveryJob() {},
  };
  const whatsappTemplates = {
    async renderDeliveryThanksMessage(variables) {
      return `Obrigado ${variables.name}, pela compra de ${variables.count} foto(s)!`;
    },
  };
  const whatsapp = {
    async sendPhotos(phone, photos, storageRoot, message) {
      assert.equal(phone, '11999999999');
      assert.equal(photos.length, 2);
      assert.equal(storageRoot, 'C:/snap/storage');
      sentMessage = message;
    },
  };

  const queue = createDeliveryQueue({
    media: { storageRoot: 'C:/snap/storage' },
    repos,
    whatsapp,
    whatsappTemplates,
  });

  await queue.processOnce();

  assert.equal(sentMessage, 'Obrigado Ana Cliente, pela compra de 2 foto(s)!');
});
