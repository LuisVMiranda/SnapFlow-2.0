const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const request = require('supertest');
const sharp = require('sharp');
const { Pool } = require('pg');
const { withTransaction } = require('../src/db');
const { runMigrationFiles } = require('../src/migrations/runMigrations');
const { createWebsiteRepo } = require('../src/repos/website');
const { createWebsiteService } = require('../src/services/websiteService');
const { createGalleryCoverService } = require('../src/services/galleryCoverService');
const { createWebsiteRouter } = require('../src/routes/websiteRoutes');
const { createShareRouter } = require('../src/routes/shareRoutes');
const { createUploader } = require('../src/routes/helpers');
const { createAuth } = require('../src/auth');
const { errorHandler } = require('../src/errors');

test('website database, cover lifecycle and protected routes', { skip: !process.env.SNAPFLOW_TEST_DATABASE_URL }, async (t) => {
  const schema = `snapflow_website_test_${crypto.randomBytes(8).toString('hex')}`;
  const connectionString = process.env.SNAPFLOW_TEST_DATABASE_URL;
  const manager = new Pool({ connectionString });
  await manager.query(`create schema ${schema}`);
  const pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
  const query = (sql, values) => pool.query(sql, values);
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-covers-'));
  t.after(async () => {
    await pool.end();
    await manager.query(`drop schema ${schema} cascade`);
    await manager.end();
    await fs.rm(storageRoot, { recursive: true, force: true });
  });
  const client = await pool.connect();
  const migrations = path.join(__dirname, '../migrations');
  await runMigrationFiles(client, migrations, { log() {} });
  assert.deepEqual(await runMigrationFiles(client, migrations, { log() {} }), []);
  client.release();
  assert.ok((await query("select indexname from pg_indexes where schemaname=$1 and indexname like 'website_gallery_%'", [schema])).rowCount >= 2);
  const repos = { ...createWebsiteRepo({ pool, query, withTransaction }),
    getSettings: async () => Object.fromEntries((await query('select key,value from app_settings')).rows.map((r) => [r.key,r.value])),
    upsertSettings: async ({ websiteSettings }) => query("update app_settings set value=$1 where key='websiteSettings'", [JSON.stringify(websiteSettings)]),
    getShareSession: async (token) => {
      const row = (await query('select * from share_sessions where token=$1 and deleted_at is null', [token])).rows[0];
      return row ? { token, galleryName: row.gallery_name, expiresAt: row.expires_at, status: row.status } : null;
    },
  };
  const config = { storageRoot, maxUploadMb: 1, maxFilesPerUpload: 1, adminAccessToken: 'test-admin', publicWebsiteUrl: 'https://site.test', publicBaseUrl: 'https://gallery.test' };
  const credentials = { getSecretValue: async (key) => key === 'photographerPhone' ? '+55 82999999999' : '' };
  const packages = { getSettings: async () => ({ eventos: {}, escola: {} }) };
  const website = createWebsiteService({ config, repos, credentials, packages });
  const galleryCovers = createGalleryCoverService({ config, repos });
  const media = { tempDir: () => storageRoot, maxUploadBytes: 1024 * 1024, allowedMimeTypes: new Set(['image/png','image/jpeg','image/webp']) };
  const app = express().use(express.json());
  app.use('/api', createWebsiteRouter({ auth: createAuth(config), upload: createUploader(config, media), website, galleryCovers, repos }));
  app.use('/api', createShareRouter({ repos, packages }));
  app.use(errorHandler);
  for (let index = 1; index <= 12; index++) {
    const token = `g${index}`;
    await query(`insert into share_sessions(token,gallery_id,gallery_name,access_code_hash,expires_at,created_at)
      values($1,$1,$1,'secret',now()+interval '1 day',now()-($2 * interval '1 hour'))`, [token, index]);
    await query(`insert into photos(id,share_token,original_path,thumb_path,preview_path,mime_type)
      values($1,$1,'private','private','private','image/jpeg')`, [token]);
    await query(`insert into gallery_covers(share_token,card_path,access_path,width,height,version,original_filename)
      values($1,'gallery-covers/old-card.webp','gallery-covers/old-access.webp',800,1200,'old','old.png')`, [token]);
  }
  await t.test('initial import, persistent order, exclusions, expiry, backfill and filters', async () => {
    const first = await website.get();
    assert.deepEqual(first.galleries.map((g) => g.token), Array.from({ length: 10 }, (_, n) => `g${n+1}`));
    const order = first.galleries.map((g) => g.token).reverse();
    await website.reorder({ tokens: order });
    assert.deepEqual((await website.get()).galleries.map((g) => g.token), order);
    await website.change('g10', 'excluded');
    assert.equal((await website.get()).galleries.some((g) => g.token === 'g10'), false);
    assert.equal((await website.get()).galleries.at(-1).token, 'g11');
    await query("update share_sessions set expires_at=now()-interval '1 day' where token='g9'");
    assert.equal((await website.get()).galleries[0].token, 'g8');
    await query("update share_sessions set expires_at=now()+interval '1 day' where token='g9'");
    assert.equal((await website.get()).galleries[0].token, 'g9');
    await website.change('g10', 'visible');
    assert.equal((await website.get()).galleries[0].token, 'g10');
    await website.saveSettings({ eligiblePackageTypes: ['escola'] });
    assert.equal((await website.get()).galleries.length, 0);
    await website.saveSettings({ eligiblePackageTypes: ['eventos'] });
    assert.equal((await website.get()).galleries[0].token, 'g10');
    const found = await website.search({ query: 'g', limit: '5' });
    assert.equal(found.items.length, 5);
    assert.equal(found.nextCursor, '5');
    await assert.rejects(website.reorder({ tokens: ['g1'] }), { code: 'website_order_conflict' });
  });
  await t.test('every administrative route requires authorization', async () => {
    for (const [method, route] of [['get','/website'],['get','/website/galleries'],['put','/website/settings'],['put','/website/order'],
      ['post','/website/galleries/g1'],['delete','/website/galleries/g1'],['put','/share-sessions/g1/cover'],['delete','/share-sessions/g1/cover']]) {
      const response = await request(app)[method](`/api/admin${route}`).set('X-Forwarded-For', `${method}-${route}`);
      assert.ok([401,403].includes(response.status), `${method} ${route}: ${response.status}`);
    }
  });
  const image = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#267185' } }).png().toBuffer();
  await t.test('public redaction and direct administrative validation failures', async () => {
    const payload = (await request(app).get('/api/website').expect(200)).body;
    assert.deepEqual(Object.keys(payload.galleries[0]).sort(), ['coverUrl','galleryUrl','id','title','token']);
    await request(app).put('/api/admin/website/settings').set('Authorization','Bearer test-admin').send({ eligiblePackageTypes: [] }).expect(400);
    await request(app).put('/api/admin/website/settings').set('Authorization','Bearer test-admin').expect(400);
    await request(app).put('/api/admin/website/order').set('Authorization','Bearer test-admin').expect(400);
    await request(app).put('/api/admin/website/order').set('Authorization','Bearer test-admin').send({ tokens: ['g1','g1'] }).expect(400);
    await request(app).get('/api/admin/website/galleries?cursor=-1').set('Authorization','Bearer test-admin').expect(400);
    await request(app).post('/api/admin/website/galleries/missing').set('Authorization','Bearer test-admin').expect(404);
    await request(app).put('/api/admin/share-sessions/g1/cover').set('Authorization','Bearer test-admin').expect(400);
    await request(app).put('/api/admin/share-sessions/g1/cover').set('Authorization','Bearer test-admin').attach('cover', Buffer.alloc(1048577), 'huge.png').expect(413);
    await request(app).put('/api/admin/share-sessions/g1/cover').set('Authorization','Bearer test-admin').attach('cover', Buffer.from('text'), 'text.txt').expect(400);
    const missing = await request(app).get('/api/website/gallery-covers/g2/card').expect(404);
    assert.equal(missing.body.error, 'Capa não encontrada.');
    assert.equal(missing.headers['cache-control'], 'no-store');
  });
  await t.test('first cover takes position one; revoked, titleless, photoless and deleted galleries stay hidden', async () => {
    await query("insert into share_sessions(token,gallery_id,gallery_name,access_code_hash,expires_at) values('fresh','fresh','Nova','secret',now()+interval '1 day')");
    await query("insert into photos(id,share_token,original_path,thumb_path,preview_path,mime_type) values('fresh','fresh','private','private','private','image/jpeg')");
    await request(app).put('/api/admin/share-sessions/fresh/cover').set('Authorization','Bearer test-admin').attach('cover', image, 'first.png').expect(200);
    assert.equal((await website.get()).galleries[0].token, 'fresh');
    for (const [hide, restore] of [
      ["status='revoked',revoked_at=now()", "status='active',revoked_at=null"],
      ["gallery_name='  '", "gallery_name='Nova'"],
      ["deleted_at=now()", "deleted_at=null"],
    ]) {
      await query(`update share_sessions set ${hide} where token='fresh'`);
      assert.equal((await website.get()).galleries.some((g) => g.token === 'fresh'), false);
      await query(`update share_sessions set ${restore} where token='fresh'`);
      assert.equal((await website.get()).galleries[0].token, 'fresh');
    }
    await query("update photos set deleted_at=now() where id='fresh'");
    assert.equal((await website.get()).galleries.some((g) => g.token === 'fresh'), false);
    await assert.rejects(website.change('fresh', 'visible'), { code: 'website_gallery_ineligible' });
    await galleryCovers.remove('fresh', true);
  });
  await t.test('cover replacement yields optimized public images without changing order', async () => {
    const before = (await website.get()).galleries.map((g) => g.token);
    const upload = await request(app).put('/api/admin/share-sessions/g1/cover').set('Authorization','Bearer test-admin').attach('cover', image, 'cover.png');
    assert.equal(upload.status, 200, JSON.stringify(upload.body));
    const card = await request(app).get(upload.body.cardUrl);
    assert.equal(card.status, 200);
    assert.match(card.headers['cache-control'], /public/);
    const metadata = await sharp(card.body).metadata();
    assert.equal(metadata.width, 800);
    assert.equal(metadata.height, 1200);
    assert.equal(metadata.exif, undefined);
    assert.equal(card.headers['x-content-type-options'], 'nosniff');
    const accessImage = await request(app).get(upload.body.coverUrl);
    const accessMeta = await sharp(accessImage.body).metadata();
    assert.equal(accessMeta.width / accessMeta.height, 1.5);
    assert.ok(Math.max(accessMeta.width, accessMeta.height) <= 1600);
    assert.deepEqual((await website.get()).galleries.map((g) => g.token), before);
    const access = await request(app).get('/api/share-session/g1');
    assert.equal(access.body.coverUrl, upload.body.coverUrl);
    const bad = await request(app).put('/api/admin/share-sessions/g1/cover').set('Authorization','Bearer test-admin').attach('cover', Buffer.from('invalid'), 'bad.png');
    assert.equal(bad.status, 400);
    assert.equal((await repos.getGalleryCover('g1')).version, new URL(upload.body.coverUrl,'https://test').searchParams.get('v'));
    await request(app).delete('/api/admin/share-sessions/g1/cover').set('Authorization','Bearer test-admin').expect(200);
    assert.equal((await website.get()).galleries.some((g) => g.token === 'g1'), false);
    await request(app).put('/api/admin/share-sessions/g1/cover').set('Authorization','Bearer test-admin').attach('cover', image, 'new.png').expect(200);
    assert.deepEqual((await website.get()).galleries.map((g) => g.token), before);
  });
  await t.test('rollback cleans staged files and gallery deletion cleans website state', async () => {
    const before = await fs.readdir(path.join(storageRoot, 'gallery-covers'));
    const failing = createGalleryCoverService({ config, repos: { replaceGalleryCover: async () => { throw new Error('database failure'); } } });
    const filePath = path.join(storageRoot,'rollback.png');
    await fs.writeFile(filePath, image);
    await assert.rejects(failing.upload('g1',{ path: filePath, originalname: 'image.png' }), /database failure/);
    assert.deepEqual(await fs.readdir(path.join(storageRoot,'gallery-covers')), before);
    await galleryCovers.remove('g1', true);
    assert.equal(await repos.getGalleryCover('g1'), null);
    assert.equal((await query("select * from website_gallery_entries where share_token='g1'")).rowCount,0);
    await request(app).get('/api/website/gallery-covers/g1/card').expect(404);
    await request(app).get('/api/website/gallery-covers/g2/original').expect(404);
  });
  await t.test('auto-orients camera metadata and limits access image dimensions', async () => {
    const camera = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: '#735858' } })
      .jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await request(app).put('/api/admin/share-sessions/g2/cover').set('Authorization','Bearer test-admin').attach('cover', camera, 'camera.jpg').expect(200);
    const imageResponse = await request(app).get(result.body.coverUrl).expect(200);
    const metadata = await sharp(imageResponse.body).metadata();
    assert.equal(metadata.height, 1600);
    assert.ok(metadata.width < metadata.height);
    assert.equal(metadata.orientation, undefined);
    assert.equal(metadata.exif, undefined);
  });
});
