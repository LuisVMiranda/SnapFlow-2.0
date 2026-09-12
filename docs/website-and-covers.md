# Website and gallery covers

## Operation

- Start the API, panel and website together with `INICIAR_TUDO.bat`.
- Start only the website with `INICIAR_SITE.bat` after the API is ready.
- Open the panel's **Website** tab, immediately after **Configurações**.
- Register the photographer's commercial WhatsApp in **Credenciais**. Missing or invalid numbers disable contact; there is no hardcoded fallback recipient.
- Add a public title and dedicated cover when creating a gallery, or upload a cover in **Galerias → Ver/Editar**. The Website search can also upload covers for unpublished galleries.
- Gallery creation saves first. Failed cover uploads retain the saved gallery and offer retry; subsequent creations do not discard pending retries. Retry files are held in browser memory, so reselect the cover in the gallery editor after a full reload.
- Covers are public, including before passcode entry. Never choose an image that must remain private. Original gallery photos keep the existing access protection.

## Configuration and publication

| Application | Local listener | Intended public URL |
| --- | --- | --- |
| API | `127.0.0.1:3000` | Proxied through the two web applications |
| Website | `127.0.0.1:5174` | `https://desktop-luis.tail2104cf.ts.net` |
| Panel/gallery | `127.0.0.1:5173` | `https://desktop-luis.tail2104cf.ts.net:8443` |

Root `.env`: `SNAPFLOW_WEBSITE_HOST`, `SNAPFLOW_WEBSITE_PORT`, `SNAPFLOW_DEV_HOST`, `SNAPFLOW_DEV_PORT`, `SNAPFLOW_API_PORT`, `SNAPFLOW_ALLOWED_HOSTS`.
Backend `.env.local`: `PUBLIC_WEBSITE_URL` and `PUBLIC_BASE_URL`; keep the website URL consistent with root `.env`.
An explicitly saved public-base credential takes precedence over its environment fallback, matching existing SnapFlow behavior. Website gallery links are built from this current configuration, never the old link saved on a gallery.

After all three applications are ready, enable Funnel for the machine and run `CONFIGURAR_SITE_PUBLICO.bat` (as administrator if Tailscale reports access denied). It validates application identities and hostname, then creates persistent background mappings for HTTPS 443 and 8443. Review existing Tailscale routes before using the helper if this computer later hosts other applications on those ports.

Funnel makes these applications accessible to the public internet. Keep the existing admin authentication enabled, and keep local listeners bound to loopback. The computer, apps and Tailscale must remain running. Follow the [official Funnel documentation](https://tailscale.com/docs/reference/tailscale-cli/funnel) for account enablement and supported ports.

Production builds: run `npm run build` and then `npm run build:website`. They produce `dist/` and `dist/website/`. The second build preserves the panel build. Static deployment requires an `/api` reverse proxy; the provided local workflow uses Vite's same-origin proxy.

## Data and ordering

Migration `023_website_gallery_covers.sql` creates dedicated cover metadata, persisted website entries, ordered/eligibility indexes, and `websiteSettings` with `eventos` enabled initially. The migration is repeatable.

`gallery_covers` stores version, original filename, access dimensions, paths and timestamps. Card dimensions are always 800×1200; access images preserve aspect ratio with maximum dimension 1600. Both are metadata-free, auto-oriented WebP. Existing photo MIME and upload-size limits apply; decoded covers are additionally bounded to 60 megapixels.

New variants are staged before committing metadata. Failed processing or persistence cleans staging. A successful replacement then removes old files. File-removal failures are logged with the orphan path for later cleanup; they do not undo saved metadata. Include both the database and private storage in backups.

Eligible galleries require a title, cover, undeleted photo, enabled type, active status and future expiration, without revocation/deletion. Public reads filter eligibility live, return at most 10, and backfill from saved positions. Initial discovery is serialized once per backend process; normal reads do not take the ordering write lock. Ordering mutations use a transaction and advisory lock.

- A first cover inserts at the front; replacing it never changes order.
- Manual order changes preserve the position slots of currently hidden galleries.
- Removing a cover hides the entry without losing position.
- Website removal records an exclusion. Re-adding clears it and moves the gallery first.
- Revocation, expiration and disabled types hide entries; restoration recovers saved ordering.
- Gallery deletion removes website metadata and cover files, including duplicate-cleanup paths.
- Reordering a stale or incomplete carousel returns 409 and the panel refreshes.

## Interface inventory

Public: `GET /api/website`, `GET /api/website/gallery-covers/:token/:variant` (`card`/`access`), and `coverUrl` on the existing pre-unlock share response.

Website gallery objects contain only `id`, `token`, `title`, `galleryUrl`, `coverUrl`. Contact contains the resolved public business number and enabled status. No access codes, client fields, original paths, sales or administrative metadata are included in the website feed. Metadata responses are not cached; image responses use versioned URLs, short public caching, WebP content type and `nosniff`. Missing images return a generic, non-cached 404.

All new admin routes require the existing admin bearer authentication:

- `GET /api/admin/website`
- `GET /api/admin/website/galleries?query=&cursor=&limit=25`
- `PUT /api/admin/website/settings` with `eligiblePackageTypes`
- `PUT /api/admin/website/order` with `tokens`
- `POST` / `DELETE /api/admin/website/galleries/:token`
- `PUT` / `DELETE /api/admin/share-sessions/:token/cover` (multipart field `cover`)

## Spec-to-implementation review

| Requirement | Implementation/check |
| --- | --- |
| Lightweight vanilla website | No framework/dependency additions; website JS build ~6.8 kB before gzip |
| Optional creation/edit covers; title and description | Shared, Pix and manual creation callbacks tested; existing editor and Website search support replacement/removal |
| Safe image processing and rollback | Database integration tests validate dimensions, orientation, metadata removal, size/type rejection, rollback, cleanup and caching |
| Automatic latest galleries, manual order, exclusions, backfill | Real isolated PostgreSQL tests cover 12 galleries, limit 10, new first cover, exclusion/re-add, restoration and stale order |
| Dedicated Website panel | URL copy, configuration warnings, package types, order controls, cover management and paginated search; frontend tests include failure states |
| Five/three/one portrait carousel | Unit/property tests plus browser inspection at 1440, 900 and 390px; active centered, no horizontal overflow, circular arrows/keyboard and swipe logic |
| Hover/focus titles and safe public DOM | Titles use `textContent`; focus/hover styles, inner stroke, broken-image handling and empty/API-error states |
| Contact redesign and old section removal | Required name ≤80 and exact five reasons; encoded WhatsApp message; obsolete buying/testimonial links/sections/styles removed |
| Cover before gallery unlock | Existing access response and lock screen extended; covered/no-cover/expired/broken-image tests |
| Separate port, startup identity, environment propagation | Startup tests and real local readiness checks; website Vite rejects duplicate/invalid ports |
| Syntax, lint, size, complexity | Repository lint and both builds pass; production sources ≤600 physical lines; new website/cover modules enforce complexity≤10, parameters≤5, depth≤3 |
| Public/cellular verification | Pending account Funnel enablement and an actual non-tailnet cellular device check |

The eight obsolete portfolio PNGs were removed from website source after checking references. This working copy keeps recoverable originals in ignored `tmp/website-legacy-portfolio-20260912`. The about-page portrait remains included in the repository.

## Verification snapshot (2026-09-12)

- Database migration applied; repeated migration made no changes.
- Full frontend suite: 197 passing tests across 55 files.
- `npm --prefix backend run test:website-db`: 8 passing tests, using a randomly named isolated schema and temporary storage, cleaned afterward.
- Full backend suite: 240 pass, 4 unrelated failures, 1 integration skip (run separately above).
- Existing failures: delivery notification test uses a July 2026 expiry now in the past; three WhatsApp QR/profile-lock property tests fail in the pre-existing modified test file. That file remains untouched by this feature.
- New-module quality gate and repository lint pass. The wider optional strict scan reports 50 legacy complexity and 2 legacy nesting findings outside the new modules; these remain separate from this feature gate.
- Local API, panel and website identity probes pass. The live database currently has no configured photographer phone or eligible covers, so the website intentionally shows its empty/contact-disabled state.
- Tailscale started successfully. Account-level Funnel enablement was requested; public URLs must not be treated as verified until enablement, mappings and external access checks finish.

For a cellular check, turn Wi-Fi off and disconnect Tailscale on a phone, then open both public URLs. Confirm a covered gallery requires its code, the hero link uses port 8443, and the WhatsApp draft has the selected name/reason. Do not send the draft merely to test it.
