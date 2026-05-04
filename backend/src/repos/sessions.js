const { fromCents, rowToSession, rowToShare, toCents } = require('./mappers');

function createSessionRepo({ pool, query, withTransaction }) {
  async function createSession(session, photoIds = []) {
    return withTransaction(pool, async (client) => {
      const result = await client.query(
        `insert into sessions
          (id, amount_cents, photo_count, package_type, phone, status, payment_method, payment_id, share_token, delivery_status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (id) do update set
          amount_cents = excluded.amount_cents,
          photo_count = excluded.photo_count,
          package_type = excluded.package_type,
          phone = excluded.phone,
          status = excluded.status,
          payment_method = excluded.payment_method,
          payment_id = excluded.payment_id,
          share_token = excluded.share_token
         returning *`,
        [
          session.id,
          toCents(session.amount),
          session.photoCount,
          session.packageType || 'eventos',
          session.phone || '',
          session.status || 'pending',
          session.paymentMethod || null,
          session.paymentId || null,
          session.shareToken || null,
          session.deliveryStatus || 'idle',
        ]
      );
      if (photoIds.length) {
        await client.query('update photos set session_id = $1 where id = any($2::text[])', [session.id, photoIds]);
      }
      return rowToSession(result.rows[0]);
    });
  }

  async function approveSession(sessionId) {
    const result = await query(
      `update sessions
       set status = 'approved',
           approved_at = coalesce(approved_at, now()),
           delivery_status = case when delivery_status = 'sent' then delivery_status else 'queued' end,
           delivery_updated_at = now()
       where id = $1
       returning *`,
      [sessionId]
    );
    return rowToSession(result.rows[0]);
  }

  async function getSession(sessionId) {
    const result = await query('select * from sessions where id = $1', [sessionId]);
    return rowToSession(result.rows[0]);
  }

  async function getSessionByPaymentId(paymentId) {
    const result = await query('select * from sessions where payment_id = $1', [paymentId]);
    return rowToSession(result.rows[0]);
  }

  async function updateDeliveryStatus(sessionId, status, error = null) {
    const result = await query(
      `update sessions
       set delivery_status = $2,
           delivery_error = $3,
           delivered_at = case when $2 = 'sent' then coalesce(delivered_at, now()) else delivered_at end,
           delivery_updated_at = now()
       where id = $1 returning *`,
      [sessionId, status, error]
    );
    return rowToSession(result.rows[0]);
  }

  async function dashboard() {
    const statsResult = await query(
      `select
        coalesce(sum(amount_cents) filter (where created_at >= now() - interval '1 day'), 0) as hoje_valor,
        coalesce(sum(photo_count) filter (where created_at >= now() - interval '1 day'), 0) as hoje_fotos,
        count(*) filter (where created_at >= now() - interval '1 day') as hoje_sessoes,
        coalesce(sum(amount_cents) filter (where created_at >= now() - interval '7 days'), 0) as semana_valor,
        coalesce(sum(photo_count) filter (where created_at >= now() - interval '7 days'), 0) as semana_fotos,
        count(*) filter (where created_at >= now() - interval '7 days') as semana_sessoes,
        coalesce(sum(amount_cents) filter (where created_at >= now() - interval '30 days'), 0) as mes_valor,
        coalesce(sum(photo_count) filter (where created_at >= now() - interval '30 days'), 0) as mes_fotos,
        count(*) filter (where created_at >= now() - interval '30 days') as mes_sessoes,
        coalesce(sum(amount_cents) filter (where created_at >= date_trunc('year', now())), 0) as ano_valor,
        coalesce(sum(photo_count) filter (where created_at >= date_trunc('year', now())), 0) as ano_fotos,
        count(*) filter (where created_at >= date_trunc('year', now())) as ano_sessoes
       from sessions where status = 'approved'`
    );
    const dailySeries = await query(
      `select to_char(day, 'DD/MM') as label,
              coalesce(sum(amount_cents), 0) as valor,
              coalesce(sum(photo_count), 0) as fotos,
              count(sessions.id) as sessoes
       from generate_series(current_date - interval '6 days', current_date, interval '1 day') day
       left join sessions on sessions.status = 'approved' and sessions.created_at::date = day::date
       group by day order by day`
    );
    const weeklySeries = await query(
      `select to_char(week_start, 'DD/MM') as label,
              coalesce(sum(amount_cents), 0) as valor,
              coalesce(sum(photo_count), 0) as fotos,
              count(sessions.id) as sessoes
       from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') week_start
       left join sessions on sessions.status = 'approved'
        and sessions.created_at >= week_start
        and sessions.created_at < week_start + interval '1 week'
       group by week_start order by week_start`
    );
    const monthlySeries = await query(
      `select to_char(month_start, 'MM/YYYY') as label,
              coalesce(sum(amount_cents), 0) as valor,
              coalesce(sum(photo_count), 0) as fotos,
              count(sessions.id) as sessoes
       from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') month_start
       left join sessions on sessions.status = 'approved'
        and sessions.created_at >= month_start
        and sessions.created_at < month_start + interval '1 month'
       group by month_start order by month_start`
    );
    const s = statsResult.rows[0] || {};
    const recentResult = await query(
      `select * from sessions
       where status = 'approved' or created_at >= now() - interval '2 hours'
       order by created_at desc
       limit 5`
    );
    const shareResult = await query(
      `select *, case
        when revoked_at is not null then 'revoked'
        when expires_at <= now() then 'expired'
        when access_granted_at is not null then 'opened'
        else status
       end as computed_status
       from share_sessions
       where deleted_at is null
       order by created_at desc
       limit 8`
    );
    return {
      stats: {
        hoje: { valor: fromCents(s.hoje_valor), fotos: Number(s.hoje_fotos), sessoes: Number(s.hoje_sessoes) },
        semana: { valor: fromCents(s.semana_valor), fotos: Number(s.semana_fotos), sessoes: Number(s.semana_sessoes) },
        mes: { valor: fromCents(s.mes_valor), fotos: Number(s.mes_fotos), sessoes: Number(s.mes_sessoes) },
        ano: { valor: fromCents(s.ano_valor), fotos: Number(s.ano_fotos), sessoes: Number(s.ano_sessoes) },
      },
      chartSeries: {
        diario: dailySeries.rows.map((row) => ({ label: row.label, valor: fromCents(row.valor), fotos: Number(row.fotos), sessoes: Number(row.sessoes) })),
        semanal: weeklySeries.rows.map((row) => ({ label: row.label, valor: fromCents(row.valor), fotos: Number(row.fotos), sessoes: Number(row.sessoes) })),
        mensal: monthlySeries.rows.map((row) => ({ label: row.label, valor: fromCents(row.valor), fotos: Number(row.fotos), sessoes: Number(row.sessoes) })),
        anual: [{ label: String(new Date().getFullYear()), valor: fromCents(s.ano_valor), fotos: Number(s.ano_fotos), sessoes: Number(s.ano_sessoes) }],
      },
      recent: recentResult.rows.map(rowToSession),
      shareRecent: shareResult.rows.map((row) => rowToShare(row, { includeAccessCode: true })),
    };
  }

  return {
    approveSession,
    createSession,
    dashboard,
    getSession,
    getSessionByPaymentId,
    updateDeliveryStatus,
  };
}

module.exports = { createSessionRepo };
