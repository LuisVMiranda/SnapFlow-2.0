const { fromCents, rowToSession, rowToShare, toCents } = require('./mappers');
const { addDays, generateAccessCode, hashValue, randomToken } = require('../tokens');
const { shareExpiresAtFromNow } = require('../services/shareExpiration');

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
                ss.watermark_asset_id,
                ss.watermark_settings,
                ss.watermark_updated_at,
                ss.overlay_asset_id,
                ss.overlay_enabled,
                ss.overlay_settings,
                ss.overlay_updated_at,
                ss.story_delivery_enabled,
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
    const conversionFunnelResult = await query(
      `select event_type,
              count(*)::int as count,
              coalesce(sum(photo_count), 0)::int as photo_count,
              coalesce(sum(amount_cents), 0)::bigint as amount_cents
       from conversion_events
       where created_at >= current_date
       group by event_type`
    ).catch(() => ({ rows: [] }));
    const conversionByType = new Map(conversionFunnelResult.rows.map((row) => [row.event_type, row]));
    const funnelEvents = [
      ['share_opened', 'Links abertos'],
      ['share_unlocked', 'Galerias desbloqueadas'],
      ['cart_saved', 'Selecoes salvas'],
      ['pix_generated', 'Pix gerados'],
      ['manual_payment_requested', 'Pagamentos manuais'],
      ['payment_approved', 'Pagamentos aprovados'],
      ['delivery_sent', 'Entregas concluidas'],
    ];
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
      conversionFunnel: funnelEvents.map(([type, label]) => {
        const row = conversionByType.get(type) || {};
        return {
          type,
          label,
          count: Number(row.count || 0),
          photoCount: Number(row.photo_count || 0),
          amount: fromCents(row.amount_cents || 0),
        };
      }),
    };
  }

  async function ensureDirectSaleGalleries(options = {}) {
    const retentionDays = Number(options.defaultGalleryRetentionDays) || 30;
    const baseUrl = String(options.publicBaseUrl || '').trim();
    return withTransaction(pool, async (client) => {
      const result = await client.query(
        `select s.*
         from sessions s
         where s.share_token is null
           and s.status <> 'cancelled'
           and exists (
             select 1
             from photos p
             where p.session_id = s.id
               and p.share_token is null
               and p.deleted_at is null
           )
         order by s.created_at desc
         limit 20
         for update skip locked`
      );
      const repaired = [];
      for (const row of result.rows) {
        const token = randomToken(12);
        const accessCode = generateAccessCode(4);
        const retentionExpiresAt = addDays(new Date(), retentionDays);
        const { expiresAt } = shareExpiresAtFromNow();
        const link = baseUrl ? new URL(`/s/${token}`, baseUrl).toString() : null;
        const galleryName = row.client_name ? `Venda - ${row.client_name}` : 'Venda direta';
        await client.query(
          `insert into share_sessions
            (token, gallery_id, gallery_name, access_code_hash, access_code, phone, client_name, client_email, package_type, photo_count, subtotal_cents, discount_cents, total_cents, expires_at, retention_expires_at, link)
           values ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            token,
            galleryName,
            hashValue(accessCode),
            accessCode,
            row.phone || '',
            row.client_name || '',
            row.client_email || '',
            row.package_type || 'eventos',
            Number(row.photo_count || 0),
            Number(row.subtotal_cents || row.amount_cents || 0),
            Number(row.discount_cents || 0),
            Number(row.amount_cents || 0),
            expiresAt,
            retentionExpiresAt,
            link,
          ]
        );
        const photosResult = await client.query(
          `update photos
           set share_token = $1,
               retention_expires_at = coalesce(retention_expires_at, $2)
           where session_id = $3
             and share_token is null
             and deleted_at is null
           returning id`,
          [token, retentionExpiresAt, row.id]
        );
        await client.query(
          `update share_sessions
           set photo_count = $2
           where token = $1`,
          [token, photosResult.rowCount]
        );
        await client.query('update sessions set share_token = $2 where id = $1 and share_token is null', [row.id, token]);
        repaired.push({ sessionId: row.id, shareToken: token, photoCount: photosResult.rowCount });
      }
      return repaired;
    });
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
    ensureDirectSaleGalleries,
    getSession,
    getSessionByPaymentId,
    updateDeliveryStatus,
  };
}

module.exports = { createSessionRepo };
