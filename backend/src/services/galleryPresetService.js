const { HttpError } = require('../errors');
const {
  normalizePhotoPresetIds,
  resolvePhotoPresetStack,
} = require('./photoEditingPresetService');

function stackIds(stack = []) {
  return stack.map((preset) => preset.id).filter(Boolean);
}

function sameIds(left = [], right = []) {
  const normalizedLeft = normalizePhotoPresetIds(left);
  const normalizedRight = normalizePhotoPresetIds(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((id, index) => id === normalizedRight[index]);
}

async function mapWithSmallConcurrency(items, concurrency, mapper) {
  const results = [];
  const limit = Math.max(1, Math.min(Number(concurrency) || 1, items.length || 1));
  for (let index = 0; index < items.length; index += limit) {
    const chunk = items.slice(index, index + limit);
    const settled = await Promise.allSettled(chunk.map((item, offset) => mapper(item, index + offset)));
    const rejected = settled.find((result) => result.status === 'rejected');
    if (rejected) throw rejected.reason;
    results.push(...settled.map((result) => result.value));
  }
  return results;
}

function createGalleryPresetService({ galleryOverlays, galleryWatermarks, media, photoPresets, repos }) {
  async function getShareOrFail(token) {
    const share = await repos.getShareSession(token, { includeAccessCode: true });
    if (!share) {
      throw new HttpError(404, 'Galeria não encontrada. Atualize Galerias e confirme se o link ainda existe.', 'share_not_found');
    }
    return share;
  }

  async function resolveStack(presetIds) {
    const presets = await photoPresets.getPresets();
    return resolvePhotoPresetStack(presets, presetIds);
  }

  async function applyStackToPhotos(share, stack) {
    const photos = await repos.listPhotosForShare(share.token);
    if (!photos.length) {
      throw new HttpError(400, 'Esta galeria não possui fotos para receber presets. Adicione fotos em Ver/Editar e tente novamente.', 'share_photos_missing');
    }
    const watermark = galleryWatermarks && typeof galleryWatermarks.effectiveForShare === 'function'
      ? await galleryWatermarks.effectiveForShare(share)
      : null;
    const overlay = galleryOverlays && typeof galleryOverlays.effectiveForShare === 'function'
      ? await galleryOverlays.effectiveForShare(share)
      : null;
    const updatedPhotos = await mapWithSmallConcurrency(photos, 2, async (photo) => {
      const processed = await media.reprocessPhotoWithPresets(photo, stack, { overlay, watermark });
      return repos.updatePhotoPresetState(photo.id, processed);
    });
    return updatedPhotos;
  }

  async function applyGalleryPresets(token, presetIds = [], options = {}) {
    const share = await getShareOrFail(token);
    const ids = normalizePhotoPresetIds(presetIds);
    const stack = await resolveStack(ids);
    const currentPresetIds = share.photoPresetIds || [];
    if (currentPresetIds.length && !sameIds(currentPresetIds, ids) && !options.confirmReplace) {
      throw new HttpError(
        409,
        'Esta galeria já possui preset ativo. Confirme que deseja substituir os ajustes antes de reaplicar.',
        'photo_preset_confirmation_required'
      );
    }
    const previousSnapshot = share.photoPresetSnapshot || [];
    const updatedPhotos = await applyStackToPhotos(share, stack);
    const updatedShare = await repos.updateSharePresetState(share.token, {
      photoPresetIds: stackIds(stack),
      photoPresetSnapshot: stack,
      photoPresetAppliedAt: new Date().toISOString(),
      photoPresetUndoSnapshot: previousSnapshot,
    });
    return {
      share: updatedShare,
      changedPhotoCount: updatedPhotos.length,
      photoPresetIds: stackIds(stack),
      photoPresetSnapshot: stack,
    };
  }

  async function removeGalleryPresets(token, options = {}) {
    const share = await getShareOrFail(token);
    if (!(share.photoPresetIds || []).length) {
      return {
        share,
        changedPhotoCount: 0,
        photoPresetIds: [],
        photoPresetSnapshot: [],
      };
    }
    if (!options.confirmRemove) {
      throw new HttpError(
        409,
        'Confirme a remocao dos presets desta galeria. As fotos serão reprocessadas sem esses ajustes.',
        'photo_preset_remove_confirmation_required'
      );
    }
    const updatedPhotos = await applyStackToPhotos(share, []);
    const updatedShare = await repos.updateSharePresetState(share.token, {
      photoPresetIds: [],
      photoPresetSnapshot: [],
      photoPresetAppliedAt: null,
      photoPresetUndoSnapshot: share.photoPresetSnapshot || [],
    });
    return {
      share: updatedShare,
      changedPhotoCount: updatedPhotos.length,
      photoPresetIds: [],
      photoPresetSnapshot: [],
    };
  }

  async function undoGalleryPresetApplication(token) {
    const share = await getShareOrFail(token);
    const photos = await repos.listPhotosForShare(share.token);
    const photosWithUndo = photos.filter((photo) => photo.undoOriginalPath && photo.undoThumbPath && photo.undoPreviewPath);
    if (!photosWithUndo.length) {
      throw new HttpError(409, 'Não ha uma reaplicação de preset para desfazer nesta galeria.', 'photo_preset_undo_missing');
    }
    const updatedPhotos = await mapWithSmallConcurrency(photosWithUndo, 2, async (photo) => {
      const restored = await media.restorePhotoPresetUndo(photo);
      return repos.updatePhotoPresetState(photo.id, restored);
    });
    const previousSnapshot = Array.isArray(share.photoPresetUndoSnapshot) ? share.photoPresetUndoSnapshot : [];
    const updatedShare = await repos.updateSharePresetState(share.token, {
      photoPresetIds: stackIds(previousSnapshot),
      photoPresetSnapshot: previousSnapshot,
      photoPresetAppliedAt: previousSnapshot.length ? new Date().toISOString() : null,
      photoPresetUndoSnapshot: null,
    });
    return {
      share: updatedShare,
      changedPhotoCount: updatedPhotos.length,
      photoPresetIds: stackIds(previousSnapshot),
      photoPresetSnapshot: previousSnapshot,
    };
  }

  return {
    applyGalleryPresets,
    removeGalleryPresets,
    undoGalleryPresetApplication,
  };
}

module.exports = {
  createGalleryPresetService,
  sameIds,
};
