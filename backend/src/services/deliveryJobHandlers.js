const { deliveryContextForShareToken, shareTokenForDelivery } = require('./deliveryContextService');

function shareUnavailableForNotification(share) {
  const expiryTime = new Date(share.expiresAt).getTime();
  return Boolean(
    share.deletedAt
      || share.revokedAt
      || ['deleted', 'expired', 'revoked'].includes(share.status)
      || (Number.isFinite(expiryTime) && expiryTime <= Date.now())
  );
}

function notificationClientName(session, share) {
  return session.clientName || share.clientName || '';
}

async function processApprovalNotification({ repos, session, whatsapp, whatsappTemplates }) {
  const share = await repos.getShareSession(session.shareToken, { includeAccessCode: true });
  if (!share) throw new Error('Galeria não encontrada para enviar o aviso de pagamento confirmado.');
  if (shareUnavailableForNotification(share)) return false;
  const clientName = notificationClientName(session, share);
  const message = await whatsappTemplates.renderPaymentApprovedMessage({
    accessCode: share.accessCode,
    accessDays: share.postPaymentAccessDays,
    clientName,
    expiresAt: share.expiresAt,
    link: share.link,
    name: clientName,
  });
  await whatsapp.sendText(session.phone || share.phone, message);
  return true;
}

function deliveryThanksVariables(session, count) {
  return {
    clientName: session.clientName || '',
    count,
    name: session.clientName || '',
    phone: session.phone,
    sessionId: session.id,
  };
}

function createDeliveryJobHandlers({ galleryOverlays, media, repos, whatsapp, whatsappTemplates }) {
  async function processMedia({ job, session }) {
    const sessionPhotos = await repos.listPhotosForSession(job.session_id);
    if (!sessionPhotos.length) throw new Error('Nenhuma foto encontrada para esta venda. Verifique se a galeria ainda possui fotos antes de reenviar.');
    await repos.updateDeliveryStatus(job.session_id, 'sending');
    const shareToken = shareTokenForDelivery(session, sessionPhotos);
    const context = await deliveryContextForShareToken({ galleryOverlays, shareToken });
    const prepared = media.prepareDeliveryPhotos
      ? await media.prepareDeliveryPhotos(sessionPhotos, context.overlay, { storyDeliveryEnabled: context.storyDeliveryEnabled })
      : { photos: sessionPhotos, cleanup: async () => {} };
    const message = !shareToken && whatsappTemplates
      ? await whatsappTemplates.renderDeliveryThanksMessage(deliveryThanksVariables(session, sessionPhotos.length))
      : undefined;
    try {
      await whatsapp.sendPhotos(session.phone, prepared.photos, media.storageRoot, message);
    } finally {
      await prepared.cleanup();
    }
    await repos.updateDeliveryStatus(job.session_id, 'sent');
    if (typeof repos.recordConversionEvent === 'function') {
      await repos.recordConversionEvent({
        type: 'delivery_sent',
        shareToken: shareToken || session.shareToken,
        sessionId: session.id,
        photoCount: sessionPhotos.length,
        amount: session.amount,
      }).catch((error) => console.warn(`Falha ao registrar conversão de entrega: ${error.message}`));
    }
  }

  return {
    approval_notification: ({ session }) => processApprovalNotification({ repos, session, whatsapp, whatsappTemplates }),
    media: processMedia,
  };
}

module.exports = { createDeliveryJobHandlers, processApprovalNotification };
