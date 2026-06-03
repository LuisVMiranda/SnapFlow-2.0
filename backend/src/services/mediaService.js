const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { randomToken } = require('../tokens');
const { HttpError } = require('../errors');
const { applyPhotoEditingStack, jpegQualityForPresetStack } = require('./photoEditingPresetService');
const { DEFAULT_WATERMARK_SETTINGS, normalizeWatermarkSettings } = require('./watermarkSettingsService');
const { buildImageWatermarkSvg, buildWatermarkSvg, watermarkPositions } = require('./mediaWatermarkService');
const { prepareDeliveryPhotos } = require('./mediaDeliveryService');
const {
  AUTO_ENHANCE_PRESETS,
  adaptiveAutoEnhancePreset,
  applyAutoEnhance,
  autoEnhancePreset,
  imageToneStats,
} = require('./mediaEnhanceService');
const {
  OVERLAY_ASSET_MAX_BYTES,
  OVERLAY_ASSET_MIME_TYPES,
  buildOverlaySvg,
  validateOverlayAssetFile,
} = require('./mediaOverlayService');
const {
  WATERMARK_ASSET_MAX_BYTES,
  WATERMARK_ASSET_MIME_TYPES,
  validateWatermarkAssetFile,
} = require('./mediaWatermarkAssetValidation');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
function safeRelativePath(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('..') || path.isAbsolute(normalized)) {
    throw new HttpError(400, 'Caminho de arquivo inválido. Use apenas arquivos dentro da pasta privada de armazenamento do SnapFlow.', 'invalid_file_path');
  }
  return normalized;
}

async function mapWithConcurrency(items, concurrency, mapper) {
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

function createMediaService(config, { watermarkSettings } = {}) {
  const dirs = {
    originals: path.join(config.storageRoot, 'originals'),
    sources: path.join(config.storageRoot, 'sources'),
    thumbs: path.join(config.storageRoot, 'thumbs'),
    previews: path.join(config.storageRoot, 'previews'),
    temp: path.join(config.storageRoot, 'tmp'),
    undo: path.join(config.storageRoot, 'undo'),
    archive: path.join(config.storageRoot, 'archive'),
    overlayAssets: path.join(config.storageRoot, 'overlay-assets'),
    watermarkAssets: path.join(config.storageRoot, 'watermark-assets'),
  };

  async function ensureStorage() {
    await Promise.all(Object.values(dirs).map((dir) => fs.mkdir(dir, { recursive: true })));
  }

  function absolutePath(relativePath) {
    const safe = safeRelativePath(relativePath);
    return path.join(config.storageRoot, safe);
  }

  function tempDir() {
    return dirs.temp;
  }

  function validateUploadFile(file) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new HttpError(400, 'Tipo de arquivo não permitido. Envie fotos em JPG, PNG, WebP ou HEIC.', 'invalid_file_type');
    }
  }

  async function checksumFile(filePath) {
    const hash = crypto.createHash('sha256');
    const content = await fs.readFile(filePath);
    hash.update(content);
    return hash.digest('hex');
  }

  async function fileMetadata(relativePath) {
    const abs = absolutePath(relativePath);
    const stat = await fs.stat(abs);
    return {
      sizeBytes: stat.size,
      checksum: await checksumFile(abs),
    };
  }

  async function currentWatermarkSettings() {
    if (!watermarkSettings || typeof watermarkSettings.getSettings !== 'function') {
      return DEFAULT_WATERMARK_SETTINGS;
    }
    return normalizeWatermarkSettings(await watermarkSettings.getSettings());
  }

  async function watermarkInputForPreview(width, height, watermark) {
    if (watermark && watermark.kind === 'image' && watermark.assetPath) {
      const assetBuffer = await fs.readFile(absolutePath(watermark.assetPath));
      return buildImageWatermarkSvg(width, height, assetBuffer, watermark.settings);
    }
    return buildWatermarkSvg(width, height, watermark?.settings || watermark || await currentWatermarkSettings());
  }

  async function overlayInputForPreview(width, height, overlay) {
    if (!overlay?.enabled || overlay.kind !== 'image' || !overlay.assetPath) return null;
    const assetBuffer = await fs.readFile(absolutePath(overlay.assetPath));
    return buildOverlaySvg(width, height, assetBuffer, overlay.asset, overlay.settings);
  }

  async function protectionInputsForPreview(width, height, options = {}) {
    const inputs = [];
    const overlayInput = await overlayInputForPreview(width, height, options.overlay);
    if (overlayInput) inputs.push({ input: overlayInput, gravity: 'center' });
    inputs.push({ input: await watermarkInputForPreview(width, height, options.watermark), gravity: 'center' });
    return inputs;
  }

  function presetUndoRel(kind, photoId) {
    return `undo/${kind}/${photoId}-${randomToken(8)}.jpg`;
  }

  async function copyRelativeFile(fromRel, toRel) {
    const fromAbs = absolutePath(fromRel);
    const toAbs = absolutePath(toRel);
    await fs.mkdir(path.dirname(toAbs), { recursive: true });
    await fs.copyFile(fromAbs, toAbs);
    return toRel;
  }

  async function replaceRelativeFile(fromRel, toRel) {
    await copyRelativeFile(fromRel, toRel);
    await fs.unlink(absolutePath(fromRel)).catch(() => {});
  }

  async function unlinkRelativeFile(relativePath) {
    if (!relativePath) return;
    await fs.unlink(absolutePath(relativePath)).catch(() => {});
  }

  function appliedPresetIds(presetStack = []) {
    return presetStack.map((preset) => preset.id).filter(Boolean);
  }

  async function buildProcessedVariantsFromSource(photo, presetStack = [], options = {}) {
    const sourceRel = photo.sourcePath || photo.originalPath;
    if (!sourceRel) {
      throw new HttpError(400, 'Esta foto não possui arquivo de origem para reprocessamento. Reenvie a imagem na galeria e tente novamente.', 'photo_source_missing');
    }

    const sourceIsPristine = Boolean(photo.sourcePath && photo.sourcePath !== photo.originalPath);
    const enhanceLevel = config.autoEnhanceLevel || 'balanced';
    const toneStats = config.autoEnhanceEnabled && sourceIsPristine ? await imageToneStats(absolutePath(sourceRel)) : null;
    const enhancePreset = adaptiveAutoEnhancePreset(enhanceLevel, toneStats);
    const rotated = sharp(absolutePath(sourceRel), { sequentialRead: true }).rotate();
    let basePipeline = config.autoEnhanceEnabled && sourceIsPristine ? applyAutoEnhance(rotated.clone(), enhancePreset) : rotated.clone();
    if (presetStack.length) basePipeline = applyPhotoEditingStack(basePipeline, presetStack);

    const watermark = options.watermark || await currentWatermarkSettings();
    const overlay = options.overlay || null;
    const qualityFallback = config.autoEnhanceEnabled && sourceIsPristine ? enhancePreset.jpegQuality : 94;
    const originalQuality = jpegQualityForPresetStack(presetStack, qualityFallback);
    const tempSuffix = `${photo.id}-${randomToken(8)}`;
    const nextOriginalRel = `tmp/${tempSuffix}-original.jpg`;
    const nextThumbRel = `tmp/${tempSuffix}-thumb.jpg`;
    const nextPreviewRel = `tmp/${tempSuffix}-preview.jpg`;

    await Promise.all([
      basePipeline.clone()
        .jpeg({ quality: originalQuality, mozjpeg: true })
        .toFile(absolutePath(nextOriginalRel)),
      basePipeline.clone()
        .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 78, mozjpeg: true })
        .toFile(absolutePath(nextThumbRel)),
      basePipeline.clone()
        .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .toBuffer({ resolveWithObject: true })
        .then(async (preview) => sharp(preview.data)
          .composite(await protectionInputsForPreview(preview.info.width, preview.info.height, { overlay, watermark }))
          .jpeg({ quality: 72, mozjpeg: true })
          .toFile(absolutePath(nextPreviewRel))),
    ]);

    return { nextOriginalRel, nextThumbRel, nextPreviewRel };
  }

  async function processUploadedFile(file, retentionExpiresAt = null, options = {}) {
    validateUploadFile(file);
    const id = `photo_${randomToken(12)}`;
    const sourceRel = `sources/${id}.jpg`;
    const originalRel = `originals/${id}.jpg`;
    const thumbRel = `thumbs/${id}.jpg`;
    const previewRel = `previews/${id}.jpg`;
    const sourceAbs = absolutePath(sourceRel);
    const originalAbs = absolutePath(originalRel);
    const thumbAbs = absolutePath(thumbRel);
    const previewAbs = absolutePath(previewRel);

    try {
      const presetStack = Array.isArray(options.presetStack) ? options.presetStack : [];
      const enhanceLevel = config.autoEnhanceLevel || 'balanced';
      const toneStats = config.autoEnhanceEnabled ? await imageToneStats(file.path) : null;
      const enhancePreset = adaptiveAutoEnhancePreset(enhanceLevel, toneStats);
      const rotated = sharp(file.path, { sequentialRead: true }).rotate();
      let basePipeline = config.autoEnhanceEnabled ? applyAutoEnhance(rotated.clone(), enhancePreset) : rotated.clone();
      if (presetStack.length) basePipeline = applyPhotoEditingStack(basePipeline, presetStack);
      if (config.autoEnhanceEnabled) {
        const luminance = Number.isFinite(enhancePreset.luminance) ? ` luminance=${Math.round(enhancePreset.luminance)}` : '';
        console.log(`[AUTO_ENHANCE] Processing image ${file.originalname || id} with ${enhancePreset.mode || enhanceLevel} preset...${luminance}`);
      }
      const watermark = options.watermark || await currentWatermarkSettings();
      const overlay = options.overlay || null;
      const originalQuality = jpegQualityForPresetStack(presetStack, config.autoEnhanceEnabled ? enhancePreset.jpegQuality : 94);

      await Promise.all([
        rotated.clone()
          .jpeg({ quality: 96, mozjpeg: true })
          .toFile(sourceAbs),
        basePipeline.clone()
          .jpeg({ quality: originalQuality, mozjpeg: true })
          .toFile(originalAbs),
        basePipeline.clone()
          .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 78, mozjpeg: true })
          .toFile(thumbAbs),
        basePipeline.clone()
          .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
          .toBuffer({ resolveWithObject: true })
          .then(async (preview) => sharp(preview.data)
            .composite(await protectionInputsForPreview(preview.info.width, preview.info.height, { overlay, watermark }))
            .jpeg({ quality: 72, mozjpeg: true })
            .toFile(previewAbs)),
      ]);

      const stat = await fs.stat(originalAbs);
      return {
        id,
        sourcePath: sourceRel,
        originalPath: originalRel,
        thumbPath: thumbRel,
        previewPath: previewRel,
        mimeType: 'image/jpeg',
        sizeBytes: stat.size,
        checksum: await checksumFile(originalAbs),
        retentionExpiresAt,
        appliedPresetIds: presetStack.map((preset) => preset.id).filter(Boolean),
        appliedPresetSnapshot: presetStack,
        presetAppliedAt: presetStack.length ? new Date().toISOString() : null,
      };
    } catch (error) {
      await Promise.all([sourceAbs, originalAbs, thumbAbs, previewAbs].map((target) => fs.unlink(target).catch(() => {})));
      throw new HttpError(
        400,
          `Não foi possível processar "${file.originalname}". Confirme que a foto é um JPG, PNG, WebP ou HEIC válido.`,
        'image_processing_failed',
        { fileName: file.originalname, reason: error.message }
      );
    } finally {
      await fs.unlink(file.path).catch(() => {});
    }
  }

  async function processUploadedFiles(files, retentionExpiresAt = null, options = {}) {
    await ensureStorage();
    const uploadFiles = files || [];
    uploadFiles.forEach(validateUploadFile);
    return mapWithConcurrency(uploadFiles, config.uploadProcessingConcurrency || 3, (file) => processUploadedFile(file, retentionExpiresAt, options));
  }
  async function reprocessPhotoWithPresets(photo, presetStack = [], options = {}) {
    await ensureStorage();
    const undoOriginalPath = presetUndoRel('originals', photo.id);
    const undoThumbPath = presetUndoRel('thumbs', photo.id);
    const undoPreviewPath = presetUndoRel('previews', photo.id);
    const tempPaths = [];
    try {
      await Promise.all([
        copyRelativeFile(photo.originalPath, undoOriginalPath),
        copyRelativeFile(photo.thumbPath, undoThumbPath),
        copyRelativeFile(photo.previewPath, undoPreviewPath),
      ]);

      const variants = await buildProcessedVariantsFromSource(photo, presetStack, options);
      tempPaths.push(variants.nextOriginalRel, variants.nextThumbRel, variants.nextPreviewRel);
      await Promise.all([
        replaceRelativeFile(variants.nextOriginalRel, photo.originalPath),
        replaceRelativeFile(variants.nextThumbRel, photo.thumbPath),
        replaceRelativeFile(variants.nextPreviewRel, photo.previewPath),
      ]);

      await Promise.all([
        unlinkRelativeFile(photo.undoOriginalPath),
        unlinkRelativeFile(photo.undoThumbPath),
        unlinkRelativeFile(photo.undoPreviewPath),
      ]);
      const metadata = await fileMetadata(photo.originalPath);

      return {
        originalPath: photo.originalPath,
        thumbPath: photo.thumbPath,
        previewPath: photo.previewPath,
        ...metadata,
        appliedPresetIds: appliedPresetIds(presetStack),
        appliedPresetSnapshot: presetStack,
        presetAppliedAt: new Date().toISOString(),
        undoOriginalPath,
        undoThumbPath,
        undoPreviewPath,
        undoPresetSnapshot: photo.appliedPresetSnapshot || [],
      };
    } catch (error) {
      await Promise.all([
        ...tempPaths.map((relativePath) => unlinkRelativeFile(relativePath)),
        unlinkRelativeFile(undoOriginalPath),
        unlinkRelativeFile(undoThumbPath),
        unlinkRelativeFile(undoPreviewPath),
      ]);
      throw new HttpError(400, `Não foi possível reaplicar presets na foto "${photo.id}". Confirme que os arquivos locais da galeria ainda existem e tente novamente.`, 'photo_preset_apply_failed', { photoId: photo.id, reason: error.message });
    }
  }

  async function restorePhotoPresetUndo(photo) {
    await ensureStorage();
    if (!photo.undoOriginalPath || !photo.undoThumbPath || !photo.undoPreviewPath) {
      throw new HttpError(409, 'Esta foto não possui uma versao anterior para desfazer. Reaplique o preset desejado na galeria.', 'photo_preset_undo_missing');
    }
    try {
      await Promise.all([
        replaceRelativeFile(photo.undoOriginalPath, photo.originalPath),
        replaceRelativeFile(photo.undoThumbPath, photo.thumbPath),
        replaceRelativeFile(photo.undoPreviewPath, photo.previewPath),
      ]);
      const previousStack = Array.isArray(photo.undoPresetSnapshot) ? photo.undoPresetSnapshot : [];
      const metadata = await fileMetadata(photo.originalPath);
      return {
        originalPath: photo.originalPath,
        thumbPath: photo.thumbPath,
        previewPath: photo.previewPath,
        ...metadata,
        appliedPresetIds: appliedPresetIds(previousStack),
        appliedPresetSnapshot: previousStack,
        presetAppliedAt: previousStack.length ? new Date().toISOString() : null,
        undoOriginalPath: null,
        undoThumbPath: null,
        undoPreviewPath: null,
        undoPresetSnapshot: null,
      };
    } catch (error) {
      throw new HttpError(400, `Não foi possível desfazer o preset da foto "${photo.id}". Confirme que os arquivos de desfazer ainda existem no armazenamento local.`, 'photo_preset_undo_failed', { photoId: photo.id, reason: error.message });
    }
  }
  async function processWatermarkAssetUpload(file) {
    await ensureStorage();
    validateWatermarkAssetFile(file);
    const id = `watermark_asset_${randomToken(12)}`;
    const storagePath = `watermark-assets/${id}.png`;
    const targetAbs = absolutePath(storagePath);
    try {
      await sharp(file.path, { sequentialRead: true })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .png()
        .toFile(targetAbs);
      const metadata = await sharp(targetAbs).metadata();
      const stat = await fs.stat(targetAbs);
      return {
        id,
        originalFilename: file.originalname || '',
        storagePath,
        mimeType: 'image/png',
        width: Number(metadata.width || 0),
        height: Number(metadata.height || 0),
        sizeBytes: stat.size,
        checksum: await checksumFile(targetAbs),
      };
    } catch (error) {
      await fs.unlink(targetAbs).catch(() => {});
      throw new HttpError(
        400,
        `Não foi possível processar a marca d'água "${file.originalname || 'enviada'}". Envie PNG, JPG ou WebP válido.`,
        'watermark_asset_processing_failed',
        { fileName: file.originalname, reason: error.message }
      );
    } finally {
      await fs.unlink(file.path).catch(() => {});
    }
  }
  async function processOverlayAssetUpload(file) {
    await ensureStorage();
    validateOverlayAssetFile(file);
    const id = `overlay_asset_${randomToken(12)}`;
    const storagePath = `overlay-assets/${id}.png`;
    const targetAbs = absolutePath(storagePath);
    try {
      await sharp(file.path, { sequentialRead: true })
        .rotate()
        .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
        .png()
        .toFile(targetAbs);
      const metadata = await sharp(targetAbs).metadata();
      const stat = await fs.stat(targetAbs);
      return {
        id,
        originalFilename: file.originalname || '',
        storagePath,
        mimeType: 'image/png',
        width: Number(metadata.width || 0),
        height: Number(metadata.height || 0),
        sizeBytes: stat.size,
        checksum: await checksumFile(targetAbs),
      };
    } catch (error) {
      await fs.unlink(targetAbs).catch(() => {});
      throw new HttpError(
        400,
        `Não foi possível processar o overlay "${file.originalname || 'enviado'}". Envie PNG, JPG ou WebP válido.`,
        'overlay_asset_processing_failed',
        { fileName: file.originalname, reason: error.message }
      );
    } finally {
      await fs.unlink(file.path).catch(() => {});
    }
  }
  async function removeWatermarkAsset(asset) {
    if (!asset?.storagePath) return;
    await unlinkRelativeFile(asset.storagePath);
  }

  async function removeOverlayAsset(asset) {
    if (!asset?.storagePath) return;
    await unlinkRelativeFile(asset.storagePath);
  }

  async function reprocessPhotoPreview(photo, options = {}) {
    await ensureStorage();
    if (!photo.originalPath) {
      throw new HttpError(400, 'Esta foto não possui arquivo base para reaplicar proteções.', 'photo_source_missing');
    }
    const tempPreviewRel = `tmp/${photo.id}-${randomToken(8)}-preview.jpg`;
    try {
      await sharp(absolutePath(photo.originalPath), { sequentialRead: true })
        .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .toBuffer({ resolveWithObject: true })
        .then(async (preview) => sharp(preview.data)
          .composite(await protectionInputsForPreview(preview.info.width, preview.info.height, options))
          .jpeg({ quality: 72, mozjpeg: true })
          .toFile(absolutePath(tempPreviewRel)));
      await replaceRelativeFile(tempPreviewRel, photo.previewPath);
      return {
        previewPath: photo.previewPath,
        overlayAppliedAt: options.markOverlay ? new Date().toISOString() : undefined,
        watermarkAppliedAt: options.markWatermark ? new Date().toISOString() : undefined,
      };
    } catch (error) {
      await unlinkRelativeFile(tempPreviewRel);
      throw new HttpError(400, `Não foi possível reaplicar proteções na foto "${photo.id}".`, 'photo_protection_apply_failed', { photoId: photo.id, reason: error.message });
    }
  }

  async function reprocessPhotoWatermark(photo, watermark, options = {}) {
    return reprocessPhotoPreview(photo, {
      overlay: options.overlay || null,
      watermark,
      markWatermark: true,
    });
  }

  async function reprocessPhotoOverlay(photo, overlay, options = {}) {
    return reprocessPhotoPreview(photo, {
      overlay,
      watermark: options.watermark || await currentWatermarkSettings(),
      markOverlay: true,
      markWatermark: true,
    });
  }

  async function sendFile(res, photo, variant) {
    const pathByVariant = {
      original: photo.originalPath,
      thumb: photo.thumbPath,
      preview: photo.previewPath,
    };
    const target = pathByVariant[variant];
    if (!target) throw new HttpError(404, 'Arquivo não encontrado. Ele pode ter sido removido pela retenção ou pela edição da galeria.', 'file_not_found');
    res.set({
      'Cache-Control': variant === 'original' ? 'private, no-store' : 'private, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    });
    res.sendFile(absolutePath(target));
  }

  async function sendWatermarkAsset(res, asset) {
    if (!asset?.storagePath) throw new HttpError(404, "Marca d'água não encontrada.", 'watermark_asset_not_found');
    res.set({
      'Cache-Control': 'private, max-age=300',
      'Content-Type': asset.mimeType || 'image/png',
      'X-Content-Type-Options': 'nosniff',
    });
    res.sendFile(absolutePath(asset.storagePath));
  }

  async function sendOverlayAsset(res, asset) {
    if (!asset?.storagePath) throw new HttpError(404, 'Overlay não encontrado.', 'overlay_asset_not_found');
    res.set({
      'Cache-Control': 'private, max-age=300',
      'Content-Type': asset.mimeType || 'image/png',
      'X-Content-Type-Options': 'nosniff',
    });
    res.sendFile(absolutePath(asset.storagePath));
  }

  async function removeOrArchive(photo, archive = false) {
    const paths = [...new Set([
      photo.sourcePath,
      photo.originalPath,
      photo.thumbPath,
      photo.previewPath,
      photo.undoOriginalPath,
      photo.undoThumbPath,
      photo.undoPreviewPath,
    ].filter(Boolean))];
    let bytes = 0;
    const errors = [];
    for (const relPath of paths) {
      try {
        const abs = absolutePath(relPath);
        const stat = await fs.stat(abs).catch(() => null);
        if (stat) bytes += stat.size;
        if (archive) {
          const archivePath = path.join(dirs.archive, relPath);
          await fs.mkdir(path.dirname(archivePath), { recursive: true });
          await fs.rename(abs, archivePath).catch(async () => fs.copyFile(abs, archivePath).then(() => fs.unlink(abs)));
        } else {
          await fs.unlink(abs).catch((error) => {
            if (error.code !== 'ENOENT') throw error;
          });
        }
      } catch (error) {
        errors.push(`${relPath}: ${error.message}`);
      }
    }
    return { bytes, errors };
  }

  return {
    ensureStorage,
    tempDir,
    storageRoot: config.storageRoot,
    maxUploadBytes: config.maxUploadMb * 1024 * 1024,
    maxFiles: config.maxFilesPerUpload,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    allowedOverlayMimeTypes: OVERLAY_ASSET_MIME_TYPES,
    allowedWatermarkMimeTypes: WATERMARK_ASSET_MIME_TYPES,
    maxOverlayAssetBytes: OVERLAY_ASSET_MAX_BYTES,
    maxWatermarkAssetBytes: WATERMARK_ASSET_MAX_BYTES,
    absolutePath,
    processOverlayAssetUpload,
    processWatermarkAssetUpload,
    prepareDeliveryPhotos: (photos, overlay, options) => prepareDeliveryPhotos(photos, overlay, absolutePath, options),
    processUploadedFiles,
    reprocessPhotoOverlay,
    reprocessPhotoWatermark,
    reprocessPhotoWithPresets,
    restorePhotoPresetUndo,
    sendFile,
    sendOverlayAsset,
    sendWatermarkAsset,
    removeOverlayAsset,
    removeWatermarkAsset,
    removeOrArchive,
  };
}

module.exports = {
  createMediaService,
  ALLOWED_MIME_TYPES,
  AUTO_ENHANCE_PRESETS,
  OVERLAY_ASSET_MIME_TYPES,
  WATERMARK_ASSET_MIME_TYPES,
  adaptiveAutoEnhancePreset,
  applyAutoEnhance,
  autoEnhancePreset,
  buildImageWatermarkSvg,
  buildWatermarkSvg,
  mapWithConcurrency,
  watermarkPositions,
};
