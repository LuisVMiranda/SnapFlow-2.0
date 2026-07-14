const DELIVERY_JOB_KINDS = Object.freeze({
  APPROVAL_NOTIFICATION: 'approval_notification',
  MEDIA: 'media',
});

function createDeliveryJobRepo({ query }) {
  async function enqueueDelivery(sessionId, kind = DELIVERY_JOB_KINDS.MEDIA) {
    const result = await query(
      `insert into delivery_jobs (session_id, kind, status)
       values ($1, $2, 'pending')
       on conflict (session_id, kind) where status in ('pending', 'running', 'sent') do nothing
       returning *`,
      [sessionId, kind]
    );
    return result.rows[0] || null;
  }

  async function claimDeliveryJob() {
    const result = await query(
      `update delivery_jobs
       set status = 'running', attempts = attempts + 1, updated_at = now()
       where id = (
        select id from delivery_jobs
        where attempts < 5
          and (
            (status in ('pending', 'failed') and next_attempt_at <= now())
            or (status = 'running' and updated_at <= now() - interval '10 minutes')
          )
        order by case when kind = 'approval_notification' then 0 else 1 end, created_at
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

  async function cancelDeliveryJob(jobId, reason) {
    await query(
      `update delivery_jobs
       set status = 'cancelled',
           last_error = $2,
           updated_at = now()
       where id = $1`,
      [jobId, String(reason || 'Entrega cancelada.')]
    );
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
    const result = await query(
      `update delivery_jobs
       set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null, updated_at = now()
       where id = $1
       returning *`,
      [jobId]
    );
    return result.rows[0] || null;
  }

  async function retryDeliveryForSession(sessionId, kind = DELIVERY_JOB_KINDS.MEDIA) {
    const updated = await query(
      `update delivery_jobs
       set status = 'pending',
           attempts = 0,
           next_attempt_at = now(),
           last_error = null,
           updated_at = now()
       where id = (
         select id from delivery_jobs
         where session_id = $1 and kind = $2 and status <> 'sent'
         order by updated_at desc, id desc
         limit 1
       )
       returning *`,
      [sessionId, kind]
    );
    if (updated.rows[0]) return updated.rows[0];
    return enqueueDelivery(sessionId, kind);
  }

  return {
    cancelDeliveryJob,
    claimDeliveryJob,
    completeDeliveryJob,
    enqueueDelivery,
    failDeliveryJob,
    retryDeliveryForSession,
    retryDeliveryJob,
  };
}

module.exports = { createDeliveryJobRepo, DELIVERY_JOB_KINDS };
