const express = require('express');
const { HttpError, asyncHandler } = require('../errors');

function coverUpload(upload) {
  return (req, res, next) => upload.single('cover')(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      next(new HttpError(413, 'A capa excede o limite de upload configurado.', 'cover_too_large'));
      return;
    }
    next(error);
  });
}

function createWebsiteRouter({ auth, upload, website, galleryCovers, repos }) {
  const router = express.Router();
  router.get('/website', asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await website.get());
  }));
  router.get('/website/gallery-covers/:token/:variant', asyncHandler(async (req, res) => {
    await galleryCovers.send(req.params.token, req.params.variant, res);
  }));
  router.use('/admin/website', auth.requireAdmin);
  router.get('/admin/website', asyncHandler(async (req, res) => res.json(await website.get(true))));
  router.get('/admin/website/galleries', asyncHandler(async (req, res) => res.json(await website.search(req.query))));
  router.put('/admin/website/settings', asyncHandler(async (req, res) => res.json(await website.saveSettings(req.body))));
  router.put('/admin/website/order', asyncHandler(async (req, res) => res.json(await website.reorder(req.body))));
  router.post('/admin/website/galleries/:token', asyncHandler(async (req, res) => res.json(await website.change(req.params.token, 'visible'))));
  router.delete('/admin/website/galleries/:token', asyncHandler(async (req, res) => res.json(await website.change(req.params.token, 'excluded'))));

  const requireGallery = asyncHandler(async (req, res, next) => {
    if (!await repos.getShareSession(req.params.token)) throw new HttpError(404, 'Galeria não encontrada.', 'share_not_found');
    next();
  });
  router.put('/admin/share-sessions/:token/cover', auth.requireAdmin, requireGallery, coverUpload(upload),
    asyncHandler(async (req, res) => {
      if (!req.file) throw new HttpError(400, 'Selecione uma imagem de capa.', 'cover_required');
      res.json(await galleryCovers.upload(req.params.token, req.file));
    }));
  router.delete('/admin/share-sessions/:token/cover', auth.requireAdmin, requireGallery,
    asyncHandler(async (req, res) => {
      await galleryCovers.remove(req.params.token);
      res.json({ coverUrl: '' });
    }));
  return router;
}
module.exports = { createWebsiteRouter };
