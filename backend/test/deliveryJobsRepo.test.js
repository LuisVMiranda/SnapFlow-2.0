const assert = require('node:assert/strict');
const test = require('node:test');
const { createDeliveryJobRepo } = require('../src/repos/deliveryJobs');

test('manual job retry resets exhausted attempts and clears the previous error', async () => {
  let statement = '';
  let values = [];
  const repo = createDeliveryJobRepo({
    query: async (sql, params) => {
      statement = sql;
      values = params;
      return { rows: [{ id: 42, status: 'pending', attempts: 0 }] };
    },
  });

  const job = await repo.retryDeliveryJob(42);

  assert.match(statement, /attempts = 0/i);
  assert.match(statement, /last_error = null/i);
  assert.deepEqual(values, [42]);
  assert.equal(job.attempts, 0);
});

test('job claiming recovers a running delivery abandoned by a previous server process', async () => {
  let statement = '';
  const repo = createDeliveryJobRepo({
    query: async (sql) => {
      statement = sql;
      return { rows: [{ id: 43, status: 'running', attempts: 2 }] };
    },
  });

  const job = await repo.claimDeliveryJob();

  assert.match(statement, /status = 'running'/i);
  assert.match(statement, /updated_at <= now\(\) - interval '10 minutes'/i);
  assert.match(statement, /attempts < 5/i);
  assert.equal(job.id, 43);
});
