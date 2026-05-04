const { loadEnv } = require('../src/loadEnv');

loadEnv();

const fs = require('fs/promises');
const path = require('path');
const { createConfig } = require('../src/config');
const { createRepos } = require('../src/repos');
const { hashValue, addDays } = require('../src/tokens');

function photoIdFromUrl(url) {
  const filename = String(url || '').split('/').pop() || '';
  return filename.replace(/\.[^.]+$/, '') || `legacy_${Math.random().toString(36).slice(2)}`;
}

function legacyPathFromUrl(url, fallbackPrefix = 'originals') {
  const filename = String(url || '').split('/').pop();
  return filename ? `${fallbackPrefix}/${filename}` : '';
}

async function copyLegacyUpload(url, storageRoot) {
  const filename = String(url || '').split('/').pop();
  if (!filename) return;
  const source = path.join(__dirname, '..', 'uploads', filename);
  const destinations = [
    path.join(storageRoot, 'originals', filename),
    path.join(storageRoot, 'thumbs', filename),
    path.join(storageRoot, 'previews', filename),
  ];
  try {
    await fs.access(source);
  } catch {
    return;
  }
  for (const destination of destinations) {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination).catch(() => {});
  }
}

async function main() {
  const config = createConfig();
  const repos = createRepos(config);
  const dbPath = path.join(__dirname, '..', 'db.json');
  const data = JSON.parse(await fs.readFile(dbPath, 'utf8'));
  const importedPhotos = new Set();

  for (const session of data.sessions || []) {
    const photos = [];
    for (const url of session.photos || []) {
      const id = photoIdFromUrl(url);
      if (!importedPhotos.has(id)) {
        await copyLegacyUpload(url, config.storageRoot);
        photos.push({
          id,
          sessionId: session.id,
          shareToken: session.shareToken || null,
          originalPath: legacyPathFromUrl(url, 'originals'),
          thumbPath: legacyPathFromUrl(url, 'thumbs'),
          previewPath: legacyPathFromUrl(url, 'previews'),
          mimeType: 'image/jpeg',
          sizeBytes: 0,
          checksum: null,
          retentionExpiresAt: addDays(new Date(session.created_at || Date.now()), config.defaultGalleryRetentionDays),
        });
        importedPhotos.add(id);
      }
    }
    if (photos.length) await repos.createPhotos(photos);
    await repos.createSession(
      {
        id: session.id,
        amount: session.amount || 0,
        photoCount: session.photoCount || photos.length,
        packageType: session.packageType || 'eventos',
        phone: session.phone || '',
        status: session.status || 'pending',
        paymentMethod: session.paymentMethod || null,
        paymentId: session.paymentId || null,
        shareToken: session.shareToken || null,
        deliveryStatus: session.deliveryStatus || 'idle',
      },
      photos.map((photo) => photo.id)
    );
  }

  for (const share of data.shareSessions || []) {
    const photoIds = [];
    for (const url of share.photos || []) {
      const id = photoIdFromUrl(url);
      photoIds.push(id);
      if (!importedPhotos.has(id)) {
        await copyLegacyUpload(url, config.storageRoot);
        await repos.createPhotos([
          {
            id,
            shareToken: share.token,
            originalPath: legacyPathFromUrl(url, 'originals'),
            thumbPath: legacyPathFromUrl(url, 'thumbs'),
            previewPath: legacyPathFromUrl(url, 'previews'),
            mimeType: 'image/jpeg',
            sizeBytes: 0,
            checksum: null,
            retentionExpiresAt: addDays(new Date(share.createdAt || Date.now()), config.defaultGalleryRetentionDays),
          },
        ]);
        importedPhotos.add(id);
      }
    }
    const existing = await repos.getShareSession(share.token);
    if (!existing) {
      await repos.createShareSession({
        token: share.token,
        accessCodeHash: hashValue(share.accessCode || ''),
        accessCode: share.accessCode || null,
        phone: share.phone || '',
        packageType: share.packageType || 'eventos',
        photoCount: share.photoCount || photoIds.length,
        total: share.total || 0,
        expiresAt: share.expiresAt || addDays(new Date(), 1),
        retentionExpiresAt: addDays(new Date(share.createdAt || Date.now()), config.defaultGalleryRetentionDays),
        link: share.link || null,
        photoIds,
      });
    }
  }

  await repos.close();
  console.log('Importacao de db.json concluida.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
