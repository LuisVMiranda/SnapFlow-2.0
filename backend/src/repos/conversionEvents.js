const { fromCents, toCents } = require('./mappers');

const FUNNEL_EVENTS = [
  ['share_opened', 'Links abertos'],
  ['share_unlocked', 'Galerias desbloqueadas'],
  ['cart_saved', 'Selecoes salvas'],
  ['pix_generated', 'Pix gerados'],
  ['manual_payment_requested', 'Pagamentos manuais'],
  ['payment_approved', 'Pagamentos aprovados'],
  ['delivery_sent', 'Entregas concluidas'],
];

function createConversionEventRepo({ query }) {
  async function recordConversionEvent(event = {}) {
    if (!event.type) return null;
    const result = await query(
      `insert into conversion_events
        (event_type, share_token, session_id, photo_count, amount_cents, metadata)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       returning *`,
      [
        String(event.type),
        event.shareToken || null,
        event.sessionId || null,
        Math.max(0, Number(event.photoCount) || 0),
        toCents(event.amount || 0),
        JSON.stringify(event.metadata || {}),
      ]
    );
    return result.rows[0] || null;
  }

  async function conversionFunnel() {
    const result = await query(
      `select event_type,
              count(*)::int as count,
              coalesce(sum(photo_count), 0)::int as photo_count,
              coalesce(sum(amount_cents), 0)::bigint as amount_cents
       from conversion_events
       where created_at >= current_date
       group by event_type`
    );
    const byType = new Map(result.rows.map((row) => [row.event_type, row]));
    return FUNNEL_EVENTS.map(([type, label]) => {
      const row = byType.get(type) || {};
      return {
        type,
        label,
        count: Number(row.count || 0),
        photoCount: Number(row.photo_count || 0),
        amount: fromCents(row.amount_cents || 0),
      };
    });
  }

  return { conversionFunnel, recordConversionEvent };
}

module.exports = { createConversionEventRepo, FUNNEL_EVENTS };

