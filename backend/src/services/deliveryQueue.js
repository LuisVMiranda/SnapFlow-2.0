function createDeliveryQueue({ repos, whatsapp, media, whatsappTemplates, galleryOverlays }) {
  let timer = null;
  let running = false;

  async function enqueue(sessionId) {
    return repos.enqueueDelivery(sessionId);
  }

  function shareTokenForDelivery(session, photos = []) {
    if (session?.shareToken) return session.shareToken;
    const photoTokens = new Set(photos.map((photo) => photo.shareToken).filter(Boolean));
    return photoTokens.size === 1 ? Array.from(photoTokens)[0] : '';
  }

  async function deliveryOverlayForShareToken(shareToken) {
    if (!shareToken || typeof galleryOverlays?.effectiveForShare !== 'function') return null;
    const overlay = await galleryOverlays.effectiveForShare(shareToken);
    if (!overlay?.enabled || overlay.kind !== 'image' || !overlay.assetPath) return null;
    return overlay;
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
      const deliveryShareToken = shareTokenForDelivery(session, sessionPhotos);
      const deliveryOverlay = await deliveryOverlayForShareToken(deliveryShareToken);
      const prepared = media.prepareDeliveryPhotos
        ? await media.prepareDeliveryPhotos(sessionPhotos, deliveryOverlay, {
            storyDeliveryEnabled: Boolean(deliveryOverlay?.share?.storyDeliveryEnabled),
          })
        : { photos: sessionPhotos, cleanup: async () => {} };
      const message = whatsappTemplates
        ? await whatsappTemplates.renderDeliveryThanksMessage({
            count: sessionPhotos.length,
            phone: session.phone,
            sessionId: session.id,
            name: session.clientName || '',
            clientName: session.clientName || '',
        })
        : undefined;
      try {
        await whatsapp.sendPhotos(session.phone, prepared.photos, media.storageRoot, message);
      } finally {
        await prepared.cleanup();
      }
      await repos.completeDeliveryJob(job.id);
      await repos.updateDeliveryStatus(job.session_id, 'sent');
      if (typeof repos.recordConversionEvent === 'function') {
        await repos.recordConversionEvent({
          type: 'delivery_sent',
          shareToken: deliveryShareToken || session.shareToken,
          sessionId: session.id,
          photoCount: sessionPhotos.length,
          amount: session.amount,
        }).catch((error) => console.warn(`Falha ao registrar conversao de entrega: ${error.message}`));
      }
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
