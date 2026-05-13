const { fromCents, rowToSession, rowToShare, toCents } = require('./mappers');

function createSessionRepo({ pool, query, withTransaction }) {
  async function createSession(session, photoIds = []) {
    return withTransaction(pool, async (client) => {
      const result = await client.query(
        `insert into sessions
          (id, amount_cents, subtotal_cents, discount_cents, photo_count, package_type, phone, client_name, client_email, status, payment_method, payment_id, share_token, delivery_status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         on conflict (id) do update set
          amount_cents = excluded.amount_cents,
          subtotal_cents = excluded.subtotal_cents,
          discount_cents = excluded.discount_cents,
          photo_count = excluded.photo_count,
          package_type = excluded.package_type,
          phone = excluded.phone,
          client_name = excluded.client_name,
          client_email = excluded.client_email,
          status = excluded.status,
          payment_method = excluded.payment_method,
          payment_id = excluded.payment_id,
          share_token = excluded.share_token,
          delivery_status = excluded.delivery_status,
          delivery_error = null,
          delivered_at = case when excluded.delivery_status = 'sent' then sessions.delivered_at else null end,
          delivery_updated_at = now()
         returning *`,
        [
          session.id,
          toCents(session.amount),
          toCents(session.subtotal === undefined ? session.amount : session.subtotal),
          toCents(session.discountAmount),
          session.photoCount,
          session.packageType || 'eventos',
          session.phone || '',
          session.clientName || '',
          session.clientEmail || '',
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
         and status <> 'cancelled'
       returning *`,
      [sessionId]
    );
    return rowToSession(result.rows[0]);
  }

  async function cancelManualSessionRelease(sessionId) {
    const result = await query(
      `update sessions
       set status = 'cancelled',
           delivery_status = 'cancelled',
           delivery_error = 'Liberação cancelada pelo administrador.',
           delivery_updated_at = now()
       where id = $1
         and status in ('pending', 'cancelled')
         and payment_method = 'Dinheiro/Cartão'
       returning *`,
      [sessionId]
    );
    return rowToSession(result.rows[0]);
  }

  async function cancelPendingSessionsForShare(shareToken, reason = 'Galeria removida pelo administrador.') {
    const result = await query(
      `update sessions
       set status = 'cancelled',
           delivery_status = 'cancelled',
           delivery_error = $2,
           delivery_updated_at = now()
       where status = 'pending'
         and (
           share_token = $1
           or exists (
             select 1
             from photos
             where photos.session_id = sessions.id
               and photos.share_token = $1
           )
         )
       returning *`,
      [shareToken, reason]
    );
    return result.rows.map(rowToSession);
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
        coalesce(sum(amount_cents) filter (where coalesce(approved_at, created_at) >= current_date), 0) as hoje_valor,
        coalesce(sum(photo_count) filter (where coalesce(approved_at, created_at) >= current_date), 0) as hoje_fotos,
        count(*) filter (where coalesce(approved_at, created_at) >= current_date) as hoje_sessoes,
        coalesce(sum(amount_cents) filter (where coalesce(approved_at, created_at) >= date_trunc('week', now())), 0) as semana_valor,
        coalesce(sum(photo_count) filter (where coalesce(approved_at, created_at) >= date_trunc('week', now())), 0) as semana_fotos,
        count(*) filter (where coalesce(approved_at, created_at) >= date_trunc('week', now())) as semana_sessoes,
        coalesce(sum(amount_cents) filter (where coalesce(approved_at, created_at) >= date_trunc('month', now())), 0) as mes_valor,
        coalesce(sum(photo_count) filter (where coalesce(approved_at, created_at) >= date_trunc('month', now())), 0) as mes_fotos,
        count(*) filter (where coalesce(approved_at, created_at) >= date_trunc('month', now())) as mes_sessoes,
        coalesce(sum(amount_cents) filter (where coalesce(approved_at, created_at) >= date_trunc('year', now())), 0) as ano_valor,
        coalesce(sum(photo_count) filter (where coalesce(approved_at, created_at) >= date_trunc('year', now())), 0) as ano_fotos,
        count(*) filter (where coalesce(approved_at, created_at) >= date_trunc('year', now())) as ano_sessoes
       from sessions where status = 'approved'`
    );
    const dailySeries = await query(
      `select to_char(day, 'DD/MM') as label,
              coalesce(sum(amount_cents), 0) as valor,
              coalesce(sum(photo_count), 0) as fotos,
              count(sessions.id) as sessoes
       from generate_series(current_date - interval '6 days', current_date, interval '1 day') day
       left join sessions on sessions.status = 'approved' and coalesce(sessions.approved_at, sessions.created_at)::date = day::date
       group by day order by day`
    );
    const weeklySeries = await query(
      `select to_char(week_start, 'DD/MM') as label,
              coalesce(sum(amount_cents), 0) as valor,
              coalesce(sum(photo_count), 0) as fotos,
              count(sessions.id) as sessoes
       from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') week_start
       left join sessions on sessions.status = 'approved'
        and coalesce(sessions.approved_at, sessions.created_at) >= week_start
        and coalesce(sessions.approved_at, sessions.created_at) < week_start + interval '1 week'
       group by week_start order by week_start`
    );
    const monthlySeries = await query(
      `select to_char(month_start, 'MM/YYYY') as label,
              coalesce(sum(amount_cents), 0) as valor,
              coalesce(sum(photo_count), 0) as fotos,
              count(sessions.id) as sessoes
       from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') month_start
       left join sessions on sessions.status = 'approved'
        and coalesce(sessions.approved_at, sessions.created_at) >= month_start
        and coalesce(sessions.approved_at, sessions.created_at) < month_start + interval '1 month'
       group by month_start order by month_start`
    );
    const s = statsResult.rows[0] || {};
    const recentResult = await query(
      `select sessions.*, delivery_jobs.id as delivery_job_id
       from sessions
       left join lateral (
         select id
         from delivery_jobs
         where delivery_jobs.session_id = sessions.id
         order by updated_at desc, id desc
         limit 1
       ) delivery_jobs on true
       left join share_sessions ss on ss.token = sessions.share_token
       where (sessions.status = 'approved' or sessions.created_at >= now() - interval '2 hours')
         and (
           (
             sessions.share_token is null
             and not exists (
               select 1
               from photos
               where photos.session_id = sessions.id
                 and photos.share_token is not null
             )
           )
           or (ss.token is not null and ss.deleted_at is null)
           or exists (
             select 1
             from photos
             join share_sessions photo_share
               on photo_share.token = photos.share_token
              and photo_share.deleted_at is null
             where photos.session_id = sessions.id
           )
         )
       order by sessions.created_at desc
       limit 5`
    );
    const shareResult = await query(
      `select share_rows.*, case
        when revoked_at is not null then 'revoked'
        when expires_at <= now() then 'expired'
        when access_granted_at is not null then 'opened'
        else status
       end as computed_status
       from (
         select ss.token,
                ss.gallery_id,
                ss.gallery_name,
                ss.gallery_description,
                ss.access_code_hash,
                ss.access_code,
                ss.phone,
                ss.client_name,
                ss.client_email,
                ss.package_type,
                coalesce(photo_counts.photo_count, ss.photo_count, 0)::int as photo_count,
                ss.subtotal_cents,
                ss.discount_cents,
                ss.total_cents,
                ss.created_at,
                ss.expires_at,
                ss.revoked_at,
                ss.status,
                ss.access_granted_at,
                ss.extends_count,
                ss.retention_expires_at,
                ss.link,
                ss.deleted_at,
                coalesce(sales.sold_photo_count, 0)::int as sold_photo_count,
                coalesce(sales.sold_order_count, 0)::int as sold_order_count,
                coalesce(sales.sold_amount_cents, 0)::bigint as sold_amount_cents,
                sales.last_sold_at
         from share_sessions ss
         left join (
           select share_token, count(*)::int as photo_count
           from photos
           where deleted_at is null
           group by share_token
         ) photo_counts on photo_counts.share_token = ss.token
         left join (
           select share_token,
                  coalesce(sum(photo_count), 0)::int as sold_photo_count,
                  count(*)::int as sold_order_count,
                  coalesce(sum(amount_cents), 0)::bigint as sold_amount_cents,
                  max(approved_at) as last_sold_at
           from sessions
           where status = 'approved' and share_token is not null
           group by share_token
         ) sales on sales.share_token = ss.token
         where ss.deleted_at is null
           and (
             coalesce(photo_counts.photo_count, 0) > 0
             or (ss.revoked_at is null and ss.expires_at > now())
           )
       ) share_rows
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

  async function clearSalesStats() {
    const result = await query('delete from sessions returning id');
    return { deletedSessions: result.rowCount };
  }

  return {
    approveSession,
    cancelManualSessionRelease,
    cancelPendingSessionsForShare,
    clearSalesStats,
    createSession,
    dashboard,
    getSession,
    getSessionByPaymentId,
    updateDeliveryStatus,
  };
}

module.exports = { createSessionRepo };
