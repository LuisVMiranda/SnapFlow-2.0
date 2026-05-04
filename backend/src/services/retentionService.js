function parseSetting(value, fallback) {
  if (value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function createRetentionService({ repos, media }) {
  async function getSettings() {
    const raw = await repos.getSettings();
    return {
      defaultGalleryRetentionDays: parseSetting(raw.defaultGalleryRetentionDays, 30),
      deliveredPhotoRetentionDays: parseSetting(raw.deliveredPhotoRetentionDays, 30),
      expiredShareRetentionDays: parseSetting(raw.expiredShareRetentionDays, 7),
      archiveBeforeDelete: parseSetting(raw.archiveBeforeDelete, false),
      autoCleanupEnabled: parseSetting(raw.autoCleanupEnabled, false),
    };
  }

  async function updateSettings(settings) {
    const allowed = {};
    for (const key of ['defaultGalleryRetentionDays', 'deliveredPhotoRetentionDays', 'expiredShareRetentionDays', 'archiveBeforeDelete', 'autoCleanupEnabled']) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) allowed[key] = settings[key];
    }
    await repos.upsertSettings(allowed);
    return getSettings();
  }

  async function preview() {
    const photos = await repos.listCleanupEligible();
    const bytesCount = photos.reduce((sum, photo) => sum + Number(photo.sizeBytes || 0), 0);
    return { filesCount: photos.length * 3, photosCount: photos.length, bytesCount };
  }

  async function run() {
    const settings = await getSettings();
    const photos = await repos.listCleanupEligible();
    let bytesCount = 0;
    const errors = [];
    for (const photo of photos) {
      const result = await media.removeOrArchive(photo, settings.archiveBeforeDelete);
      bytesCount += result.bytes;
      errors.push(...result.errors);
    }
    await repos.markPhotosDeleted(photos.map((photo) => photo.id));
    const runRecord = await repos.recordCleanupRun({
      mode: settings.archiveBeforeDelete ? 'archive' : 'delete',
      filesCount: photos.length * 3,
      bytesCount,
      errors,
    });
    return { run: runRecord, filesCount: photos.length * 3, photosCount: photos.length, bytesCount, errors };
  }

  return { getSettings, updateSettings, preview, run };
}

module.exports = { createRetentionService };
