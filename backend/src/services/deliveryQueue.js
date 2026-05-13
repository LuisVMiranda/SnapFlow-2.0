function createDeliveryQueue({ repos, whatsapp, media, whatsappTemplates }) {
  let timer = null;
  let running = false;

  async function enqueue(sessionId) {
    return repos.enqueueDelivery(sessionId);
  }

  async function processOnce() {
    if (running) return;
    running = true;
    let job = null;
    try {
      job = await repos.claimDeliveryJob();
      if (!job) return;
      const session = await repos.getSession(job.session_id);
      if (!session) {
        throw new Error('Venda não encontrada para esta entrega. Atualize a aba Vendas antes de tentar reenviar.');
      }
      if (session.status !== 'approved') {
        const reason = session.status === 'pending'
          ? 'Entrega bloqueada: o pagamento em dinheiro/cartão ainda aguarda aprovação do administrador.'
          : 'Entrega bloqueada: esta venda não está aprovada.';
        if (typeof repos.cancelDeliveryJob === 'function') await repos.cancelDeliveryJob(job.id, reason);
        else await repos.failDeliveryJob(job.id, reason);
        await repos.updateDeliveryStatus(job.session_id, session.status === 'cancelled' ? 'cancelled' : 'idle', session.status === 'cancelled' ? reason : null);
        return;
      }
      const sessionPhotos = await repos.listPhotosForSession(job.session_id);
      if (!sessionPhotos.length) throw new Error('Nenhuma foto encontrada para esta venda. Verifique se a galeria ainda possui fotos antes de reenviar.');
      await repos.updateDeliveryStatus(job.session_id, 'sending');
      const message = whatsappTemplates
        ? await whatsappTemplates.renderDeliveryThanksMessage({
            count: sessionPhotos.length,
            phone: session.phone,
            sessionId: session.id,
            name: session.clientName || '',
            clientName: session.clientName || '',
          })
        : undefined;
      await whatsapp.sendPhotos(session.phone, sessionPhotos, media.storageRoot, message);
      await repos.completeDeliveryJob(job.id);
      await repos.updateDeliveryStatus(job.session_id, 'sent');
    } catch (error) {
      console.warn(`Falha na fila de entrega: ${error.message}`);
      if (job?.id) {
        await repos.failDeliveryJob(job.id, error.message);
        await repos.updateDeliveryStatus(job.session_id, 'failed', error.message);
      }
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
