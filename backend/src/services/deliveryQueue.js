const { createDeliveryJobHandlers } = require('./deliveryJobHandlers');

function deliveryJobKind(job) {
  return job.kind || 'media';
}

async function blockUnapprovedJob(repos, job, session) {
  const reason = session.status === 'pending'
    ? 'Entrega bloqueada: o pagamento em dinheiro/cartão ainda aguarda aprovação do administrador.'
    : 'Entrega bloqueada: esta venda não está aprovada.';
  if (typeof repos.cancelDeliveryJob === 'function') await repos.cancelDeliveryJob(job.id, reason);
  else await repos.failDeliveryJob(job.id, reason);
  if (deliveryJobKind(job) !== 'media') return;
  const status = session.status === 'cancelled' ? 'cancelled' : 'idle';
  await repos.updateDeliveryStatus(job.session_id, status, status === 'cancelled' ? reason : null);
}

async function failClaimedJob(repos, job, error) {
  if (!job?.id) return;
  await repos.failDeliveryJob(job.id, error.message);
  if (deliveryJobKind(job) === 'media') {
    await repos.updateDeliveryStatus(job.session_id, 'failed', error.message);
  }
}

async function processClaimedJob({ handlers, job, repos }) {
  const session = await repos.getSession(job.session_id);
  if (!session) throw new Error('Venda não encontrada para esta entrega. Atualize a aba Vendas antes de tentar reenviar.');
  if (session.status !== 'approved') {
    await blockUnapprovedJob(repos, job, session);
    return;
  }
  const handler = handlers[deliveryJobKind(job)];
  if (!handler) throw new Error(`Tipo de entrega desconhecido: ${job.kind}.`);
  await handler({ job, session });
  await repos.completeDeliveryJob(job.id);
}

function createDeliveryQueue({ repos, whatsapp, media, whatsappTemplates, galleryOverlays }) {
  let timer = null;
  let running = false;
  const handlers = createDeliveryJobHandlers({ galleryOverlays, media, repos, whatsapp, whatsappTemplates });

  async function enqueue(sessionId, kind = 'media') {
    return repos.enqueueDelivery(sessionId, kind);
  }

  async function processOnce() {
    if (running) return;
    running = true;
    let job = null;
    try {
      job = await repos.claimDeliveryJob();
      if (!job) return;
      await processClaimedJob({ handlers, job, repos });
    } catch (error) {
      console.warn(`Falha na fila de entrega: ${error.message}`);
      await failClaimedJob(repos, job, error);
    } finally {
      running = false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(processOnce, 5000);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { enqueue, processOnce, start, stop };
}

module.exports = { createDeliveryQueue };
