const assert = require('node:assert/strict');
const test = require('node:test');
const { createCredentialsService } = require('../src/services/credentialsService');

function createMemoryRepos() {
  const records = new Map();
  return {
    async listCredentials() {
      return Array.from(records.values());
    },
    async getCredential(key) {
      return records.get(key) || null;
    },
    async upsertCredential({ key, value, sensitive }) {
      const record = {
        key,
        value,
        sensitive,
        updated_at: new Date('2026-05-02T12:00:00.000Z').toISOString(),
      };
      records.set(key, record);
      return record;
    },
    async deleteCredential(key) {
      records.delete(key);
    },
    records,
  };
}

test('credentials service masks sensitive values and rejects missing confirmation', async () => {
  const repos = createMemoryRepos();
  const service = createCredentialsService({
    config: {
      adminAccessToken: 'admin123',
      credentialsSecret: 'test-secret',
    },
    repos,
  });

  await assert.rejects(
    () => service.updateCredential('mpAccessToken', { value: 'APP_USR_secret_1234', confirmation: 'wrong' }),
    /Confirmação administrativa inválida/
  );

  const saved = await service.updateCredential('mpAccessToken', {
    value: 'APP_USR_secret_1234',
    confirmation: 'admin123',
  });

  assert.equal(saved.configured, true);
  assert.equal(saved.maskedValue.endsWith('1234'), true);
  assert.equal(saved.maskedValue.includes('APP_USR_secret'), false);
  assert.equal(repos.records.get('mpAccessToken').value.includes('APP_USR_secret'), false);

  const secret = await service.getSecretValue('mpAccessToken');
  assert.equal(secret, 'APP_USR_secret_1234');
});

test('credentials service can delete editable values after confirmation', async () => {
  const repos = createMemoryRepos();
  const service = createCredentialsService({
    config: {
      adminAccessToken: 'admin123',
      credentialsSecret: 'test-secret',
    },
    repos,
  });

  await service.updateCredential('studioName', { value: 'Studio Snap', confirmation: 'admin123' });
  const deleted = await service.deleteCredential('studioName', { confirmation: 'admin123' });

  assert.equal(deleted.configured, false);
  assert.equal(repos.records.has('studioName'), false);
});
