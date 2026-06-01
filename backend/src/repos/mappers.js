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
    subtotal: fromCents(row.subtotal_cents),
    discountAmount: fromCents(row.discount_cents),
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
  const mediaVersion = mediaVersionFromRow(row);
  const versionQuery = mediaVersion ? `?v=${encodeURIComponent(mediaVersion)}` : '';
  return {
    id: row.id,
    sessionId: row.session_id,
    shareToken: row.share_token,
    originalPath: row.original_path,
    sourcePath: row.source_path || row.original_path,
    thumbPath: row.thumb_path,
    previewPath: row.preview_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    checksum: row.checksum,
    createdAt: row.created_at,
    retentionExpiresAt: row.retention_expires_at,
    deletedAt: row.deleted_at,
    appliedPresetIds: row.applied_preset_ids || [],
    appliedPresetSnapshot: row.applied_preset_snapshot || [],
    presetAppliedAt: row.preset_applied_at || null,
    overlayAppliedAt: row.overlay_applied_at || null,
    watermarkAppliedAt: row.watermark_applied_at || null,
    mediaVersion,
    undoOriginalPath: row.undo_original_path || null,
    undoThumbPath: row.undo_thumb_path || null,
    undoPreviewPath: row.undo_preview_path || null,
    undoPresetSnapshot: row.undo_preset_snapshot || null,
    url: `${config.publicBaseUrl}/api/media/${row.id}/preview${versionQuery}`,
    thumbUrl: `${config.publicBaseUrl}/api/media/${row.id}/thumb${versionQuery}`,
  };
}

function mediaVersionFromRow(row) {
  const dated = [row.overlay_applied_at, row.watermark_applied_at, row.preset_applied_at, row.created_at]
    .filter(Boolean)
    .map((value) => ({ value: String(value), time: new Date(value).getTime() }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((left, right) => right.time - left.time);
  return String(dated[0]?.value || row.checksum || '').replace(/\s+/g, '');
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
    subtotal: fromCents(row.subtotal_cents),
    discountAmount: fromCents(row.discount_cents),
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
    photoPresetIds: row.photo_preset_ids || [],
    photoPresetSnapshot: row.photo_preset_snapshot || [],
    photoPresetAppliedAt: row.photo_preset_applied_at || null,
    photoPresetUndoSnapshot: row.photo_preset_undo_snapshot || null,
    watermarkAssetId: row.watermark_asset_id || '',
    watermarkSettings: row.watermark_settings || {},
    watermarkUpdatedAt: row.watermark_updated_at || null,
    overlayAssetId: row.overlay_asset_id || '',
    overlayEnabled: Boolean(row.overlay_enabled),
    overlaySettings: row.overlay_settings || {},
    overlayUpdatedAt: row.overlay_updated_at || null,
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

function rowToOverlayAsset(row) {
  if (!row) return null;
  return {
    id: row.id,
    identifier: row.identifier || '',
    originalFilename: row.original_filename || '',
    storagePath: row.storage_path,
    mimeType: row.mime_type || 'image/png',
    width: Number(row.width || 0),
    height: Number(row.height || 0),
    sizeBytes: Number(row.size_bytes || 0),
    checksum: row.checksum || '',
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToWatermarkAsset(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || '',
    originalFilename: row.original_filename || '',
    storagePath: row.storage_path,
    mimeType: row.mime_type || 'image/png',
    width: Number(row.width || 0),
    height: Number(row.height || 0),
    sizeBytes: Number(row.size_bytes || 0),
    checksum: row.checksum || '',
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { fromCents, rowToOverlayAsset, rowToPhoto, rowToSession, rowToShare, rowToWatermarkAsset, toCents };
