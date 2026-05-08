function toCents(value) {
  return Math.round((Number(value) || 0) * 100);
}

function fromCents(value) {
  return (Number(value) || 0) / 100;
}

function rowToSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    amount: fromCents(row.amount_cents),
    photoCount: row.photo_count,
    packageType: row.package_type,
    phone: row.phone,
    clientName: row.client_name || '',
    clientEmail: row.client_email || '',
    status: row.status,
    paymentMethod: row.payment_method,
    paymentId: row.payment_id,
    shareToken: row.share_token,
    approvedAt: row.approved_at,
    created_at: row.created_at,
    deliveryStatus: row.delivery_status || 'idle',
    deliveryError: row.delivery_error || null,
    deliveryJobId: row.delivery_job_id || null,
    deliveredAt: row.delivered_at,
  };
}

function rowToPhoto(row, config) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    shareToken: row.share_token,
    originalPath: row.original_path,
    thumbPath: row.thumb_path,
    previewPath: row.preview_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    checksum: row.checksum,
    createdAt: row.created_at,
    retentionExpiresAt: row.retention_expires_at,
    deletedAt: row.deleted_at,
    url: `${config.publicBaseUrl}/api/media/${row.id}/preview`,
    thumbUrl: `${config.publicBaseUrl}/api/media/${row.id}/thumb`,
  };
}

function rowToShare(row, options = {}) {
  if (!row) return null;
  const payload = {
    token: row.token,
    galleryId: row.gallery_id || row.token,
    galleryName: row.gallery_name || '',
    galleryDescription: row.gallery_description || '',
    packageType: row.package_type,
    phone: row.phone,
    clientName: row.client_name || '',
    clientEmail: row.client_email || '',
    photoCount: row.photo_count,
    total: fromCents(row.total_cents),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    deletedAt: row.deleted_at,
    status: row.computed_status || row.status,
    accessGrantedAt: row.access_granted_at,
    extendsCount: row.extends_count || 0,
    retentionExpiresAt: row.retention_expires_at,
    link: row.link,
    sales: {
      soldPhotoCount: Number(row.sold_photo_count || 0),
      soldOrderCount: Number(row.sold_order_count || 0),
      soldAmount: fromCents(row.sold_amount_cents),
      lastSoldAt: row.last_sold_at || null,
    },
  };
  if (options.includeSensitive) payload.accessCodeHash = row.access_code_hash;
  if (options.includeSensitive || options.includeAccessCode) payload.accessCode = row.access_code || null;
  return payload;
}

module.exports = { fromCents, rowToPhoto, rowToSession, rowToShare, toCents };
