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
      const sessionPhotos = await repos.listPhotosForSession(job.session_id);
      await repos.updateDeliveryStatus(job.session_id, 'sending');
      const message = whatsappTemplates
        ? await whatsappTemplates.renderDeliveryThanksMessage({
            count: sessionPhotos.length,
            phone: session.phone,
            sessionId: session.id,
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
