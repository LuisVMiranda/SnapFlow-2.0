function createDeliveryJobRepo({ query }) {
  async function enqueueDelivery(sessionId) {
    const result = await query(
      `insert into delivery_jobs (session_id, status)
       values ($1, 'pending')
       on conflict (session_id) where status in ('pending', 'running', 'sent') do nothing
       returning *`,
      [sessionId]
    );
    return result.rows[0] || null;
  }

  async function claimDeliveryJob() {
    const result = await query(
      `update delivery_jobs
       set status = 'running', attempts = attempts + 1, updated_at = now()
       where id = (
        select id from delivery_jobs
        where status in ('pending', 'failed') and attempts < 5 and next_attempt_at <= now()
        order by created_at
        for update skip locked
        limit 1
       )
       returning *`
    );
    return result.rows[0] || null;
  }

  async function completeDeliveryJob(jobId) {
    await query("update delivery_jobs set status = 'sent', updated_at = now(), last_error = null where id = $1", [jobId]);
  }

  async function failDeliveryJob(jobId, error) {
    await query(
      `update delivery_jobs
       set status = 'failed',
           last_error = $2,
           next_attempt_at = now() + (least(attempts, 5) * interval '5 minutes'),
           updated_at = now()
       where id = $1`,
      [jobId, String(error || 'Falha no envio')]
    );
  }

  async function retryDeliveryJob(jobId) {
    const result = await query("update delivery_jobs set status = 'pending', next_attempt_at = now(), updated_at = now() where id = $1 returning *", [jobId]);
    return result.rows[0] || null;
  }

  return {
    claimDeliveryJob,
    completeDeliveryJob,
    enqueueDelivery,
    failDeliveryJob,
    retryDeliveryJob,
  };
}

module.exports = { createDeliveryJobRepo };
