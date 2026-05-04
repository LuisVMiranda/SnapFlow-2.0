function createPaymentEventRepo({ query }) {
  async function recordPaymentEvent(event) {
    const result = await query(
      `insert into payment_events (provider, provider_event_id, payment_id, session_id, status, raw_payload)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (provider_event_id) do nothing
       returning *`,
      [
        event.provider || 'mercado_pago',
        event.providerEventId,
        event.paymentId || null,
        event.sessionId || null,
        event.status || null,
        event.rawPayload || {},
      ]
    );
    return result.rows[0] || null;
  }

  return { recordPaymentEvent };
}

module.exports = { createPaymentEventRepo };
