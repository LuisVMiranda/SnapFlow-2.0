# SnapFlow 2.0 Project Manifesto

Updated on: 2026-06-04

This document compiles the product vision, architecture, technologies, workflows, features, advantages, and operating model of SnapFlow 2.0. It is intended to be reused later for commercial material, technical documentation, proposals, onboarding, product planning, and architecture review.

## Executive Summary

SnapFlow 2.0 is a fast-sales operating system for in-person photographers. It combines an admin dashboard, photo upload, shared galleries, customer selection, checkout, payment, approval, image processing, downloads, and optional WhatsApp delivery into one focused workflow.

The product exists to shorten the time between taking a photo, selling it, and delivering it. In events, tourism, schools, parks, corporate activations, and high-turnover environments, every minute of friction costs sales. SnapFlow organizes that cycle so photographers can serve more people, sell with less improvisation, and deliver high-quality files without losing commercial control.

In practical terms, SnapFlow does four things especially well:

1. Turns freshly captured photos into sellable galleries.
2. Lets customers choose, pay, and follow their purchase with less friction.
3. Automates release and delivery when payment is approved.
4. Gives the photographer control over branding, prices, discounts, links, approvals, retention, and WhatsApp operations.

## Positioning

SnapFlow is not just a photo gallery. It is also not a full photo editor, a generic CRM, or a traditional e-commerce storefront. It is an operational layer focused on the moment of in-person sale.

Its value comes from connecting steps that are often scattered:

- selecting photos;
- showing protected previews;
- calculating packages and discounts;
- charging through Pix or in-person payment;
- approving or blocking releases;
- delivering originals through WhatsApp;
- recording status and history;
- keeping temporary galleries under control.

The system is built for environments where photographers need to sell quickly without looking improvised, deliver quickly without compromising quality, and control access without making the process heavy for the customer.

## Audience and Use Cases

The primary audience is photographers and operators who sell photos in volume, often at the same location where the images were captured.

Natural use cases:

- educational tourism;
- school events;
- graduations;
- parks, attractions, and experiences;
- corporate events;
- promotional activations;
- family and group photos in high-traffic locations;
- operations where multiple customers choose photos in parallel;
- sales where the customer chooses a few images from a larger set;
- scenarios where Pix, cash, and card coexist in the same workflow.

The product also serves smaller operations that need a professional process without building heavy e-commerce infrastructure.

## Product Principles

- Speed first: the workflow should shorten the path from photo to selection, payment, and delivery.
- Mobile-first: customers and operators often use phones, shared links, or networks such as Tailscale/Funnel.
- Photographer control: manual payment never releases photos without explicit admin approval.
- Proportional protection: previews use watermarks, temporary access, and casual-copy barriers without promising impossible DRM.
- Delivery quality: paid files are sent as WhatsApp documents to preserve quality.
- Automation with supervision: approved Pix can release delivery automatically; cash/card requires a human decision.
- Viable local operation: the system runs on Windows with BAT scripts, Node.js, and local PostgreSQL through Docker or native PostgreSQL.
- Incremental evolution: funnels, presets, overlays, and Stories are integrated as layers over the existing workflow.
- Clear fallbacks: when WhatsApp, Pix, backend, or database fail, the dashboard tries to show the cause and an actionable next step.

## Core Workflows

### Direct Photographer Sale

1. The photographer opens the admin dashboard.
2. They upload the session photos.
3. The backend processes originals, previews, and thumbnails.
4. The operator chooses the package and selects photos with the customer.
5. The summary calculates count, unit price, subtotal, manual discount, and total.
6. The operator enters name, phone, optional e-mail, and payment method.
7. The order can proceed through Mercado Pago Pix or manual payment.
8. Once approved, the gallery receives download rights and at least seven days of post-payment access.
9. WhatsApp sends a lightweight notice and, when enabled, the queue also sends originals.

### Shared Gallery

1. The photographer selects photos and creates a shared gallery.
2. The gallery receives a token, link, access code, expiration, metadata, package, total, and visual settings.
3. The link can be sent by WhatsApp with a configurable message.
4. The customer opens the link, enters the code, and unlocks temporary access.
5. The gallery loads photos in internal pages to avoid freezing phones or networks.
6. The customer selects photos; the cart can be saved in the backend.
7. The customer generates Pix or requests manual payment.
8. Approved Pix releases delivery automatically; manual payment waits for photographer approval.
9. Paid files become available individually and as a ZIP in the gallery; sending originals through WhatsApp is optional.

### Pix Flow

1. The frontend calls the Pix route with session, photos, total, package, customer, and phone.
2. The backend creates a Pix payment in Mercado Pago.
3. The response includes QR Code and Pix copy-paste code.
4. The customer pays in their banking app.
5. Mercado Pago calls the public webhook.
6. The backend validates the signature, checks payment status, and approves the session when the status is approved.
7. Delivery is queued.
8. The dashboard shows notification and status.

### Cash/Card Flow

1. The customer or photographer records a manual payment request.
2. The session remains pending.
3. The dashboard shows the pending request to the admin.
4. The admin can release the photos or cancel the release.
5. Releasing approves the session and queues delivery.
6. Cancelling makes that order impossible to approve; a new request is needed if the customer buys later.

### Delivery Flow

1. Approval promotes expiry from `approvedAt` without shortening a longer manual expiry or clearing explicit revocation.
2. Download entitlements are created before any WhatsApp dependency.
3. The queue creates independent jobs for approval notification and optional media.
4. The notice containing link, code, and expiry is prioritized before documents.
5. When original sending is enabled, the gallery visual context is resolved and final files are prepared.
6. WhatsApp sends originals as documents without duplicating the approval message.
7. The queue cleans temporary files, tracks each job separately, and records the media conversion event.
8. Notice and media failures remain independently visible and retryable.

## Product Features

### Upload and Media Processing

The backend accepts JPG, PNG, WebP, HEIC, and HEIF images. Uploads go through MIME validation, size limits, and Sharp processing.

General pipeline:

```text
Upload -> temporary storage -> EXIF rotation -> optional Auto Enhance -> optional per-gallery manual presets -> processed original -> preview -> thumbnail -> PostgreSQL metadata
```

Storage lives under `STORAGE_ROOT`, with folders such as:

- `originals`;
- `sources`;
- `thumbs`;
- `previews`;
- `tmp`;
- `undo`;
- `archive`;
- `overlay-assets`;
- `watermark-assets`.

The database stores metadata; image files live on the filesystem.

### Optional Auto Enhance

Auto Enhance is disabled by default. When enabled through `AUTO_ENHANCE=true`, the backend uses Sharp for light brightness, saturation, contrast, and sharpening adjustments.

Available levels:

- `soft`;
- `balanced`;
- `cinematic`.

The feature aims to improve images without replacing the photographer's taste and without turning SnapFlow into a heavy editor. It also respects `UPLOAD_PROCESSING_CONCURRENCY` to avoid overwhelming local machines.

### Photo Editing Presets

The admin can create editing presets and apply up to three adjustments per gallery. The system preserves reprocessing and undo information, allowing preset stacks to be applied or reverted without losing the source.

Presets are especially useful for standardizing batches from events, schools, or tourism operations without editing photo by photo.

### Shared Galleries

A shared gallery is the central object in SnapFlow. It groups photos, link, code, expiration, package, total, phone, customer, cart, presets, watermark, overlay, and Stories.

Available controls:

- create link;
- copy and open link;
- revoke link;
- extend time;
- recreate/revalidate gallery;
- edit name, description, customer, phone, package, total, discount, and code;
- add and remove photos;
- load photos in batches;
- apply or undo presets;
- apply, disable, or remove watermark;
- apply, disable, or remove overlay;
- enable or disable Stories delivery.

Galleries are temporary by design. Expiration, revocation, and retention help limit exposure and reduce operational clutter.

### Selection and Cart

Customers or operators select photos with a counter, live total, and active-package highlight. In shared galleries, the cart can be saved in the backend so selections can be recovered when the customer returns to the link.

The system also shows subtle commercial nudges when only a few photos are missing to activate a package or discount.

### Pricing, Packages, and Manual Discount

Packages live in settings and can be edited from the dashboard. Pricing uses selected count, package type, normal unit price, volume promotional price, and manual discounts.

Manual discount can be applied to any admin sale. The system validates bounds to prevent discounts larger than the subtotal and asks for confirmation when a discount makes the order free.

### Mercado Pago Pix

SnapFlow integrates with Mercado Pago to create Pix payments. It supports:

- QR Code;
- Pix copy-paste code;
- optional payer e-mail;
- signed webhook;
- payment event records;
- automatic session approval;
- automatic delivery queueing.

Credentials can come from environment variables or from the credentials dashboard.

### Manual Payment

Manual payment covers in-person cash and card. The product rule is deliberate: manual payment does not release photos without admin approval.

The dashboard also lets the admin cancel pending releases, preventing stuck orders when the customer gives up, tests the flow, or closes the gallery without paying.

### WhatsApp

Delivery uses `whatsapp-web.js` in the backend with a local WhatsApp Web session. The dashboard shows status and QR Code.

Available operations:

- check status;
- reconnect;
- pair again;
- reset local authentication;
- send text;
- send photos as documents;
- retry after transient failures.

Messages are configurable and support variables such as `{name}`, `{link}`, `{linkText}`, `{code}`, `{expiresMinutes}`, `{expiresAt}`, `{accessDays}`, `{count}`, `{total}`, `{phone}`, and `{sessionId}`.

### Delivery Queue

The delivery queue separates approval, notification, and media sending. Downloads and expiry are persisted first, so WhatsApp failure cannot break the sale.

Queue responsibilities:

- claim the pending notice before media;
- validate approved session;
- fetch selected photos;
- resolve gallery context;
- prepare final files;
- send a notice or originals through WhatsApp according to job type;
- clean temporary files;
- mark success or failure;
- allow retry;
- recover jobs left `running` by a terminated or restarted process after 10 minutes.

### Watermarks

Watermark protects and customizes previews. There are two levels:

- global watermark settings;
- reusable image library applicable per gallery.

When a gallery has no custom image, the system uses the SnapFlow Plan B watermark. Watermark applies to previews and public viewing; paid originals do not receive preview watermark.

### Overlays

Overlay is a visual image layer applied over previews and, when active, also over paid delivered files. It is separate from watermark.

The admin can:

- upload overlays to a library;
- name and rename assets;
- apply overlay per gallery;
- adjust position, scale, and opacity;
- configure vertical and horizontal orientation profiles;
- enable or disable without deleting configuration;
- remove it from the gallery.

When overlay and watermark coexist, preview order is: photo edit, overlay, watermark.

### 9:16 Stories Delivery

Stories mode generates an additional 9:16 copy of the paid photo, designed for Instagram Stories. When enabled, delivery includes the normal paid original plus the Stories variant.

Stories variant behavior:

- approximate 1080 x 1920 output;
- main photo in `contain`, without cutting off the subject;
- the same photo as `cover` background, blurred and darkened;
- optional Stories overlay if the asset has a configured 9:16 profile;
- independent from gallery overlay.

This means Stories can be enabled even when gallery overlay is disabled or absent. If an overlay with a Stories profile exists, it is added to the variant. If not, the Stories variant is delivered without overlay.

### Gallery Protections

Protections reduce casual copying and unauthorized access:

- 4-character access code;
- temporary links;
- revocation;
- short customer media access tokens;
- previews and thumbnails instead of originals;
- watermark in public viewing;
- context menu and drag blocking in customer mode;
- keyboard restrictions as convenience barriers;
- controlled headers and API error messages.

These protections are not absolute DRM. They discourage common misuse, but cannot prevent screenshots, screen photos, or highly technical users.

### Dashboard and Analytics

The dashboard tracks sales, recent sessions, shared galleries, payment status, delivery status, and period statistics.

Periods:

- today;
- week;
- month;
- year.

The conversion funnel records events such as:

- `share_opened`;
- `share_unlocked`;
- `cart_saved`;
- `pix_generated`;
- `manual_payment_requested`;
- `payment_approved`;
- `delivery_sent`.

This funnel helps identify where sales lose momentum.

### Credentials and Settings

The dashboard manages:

- Mercado Pago token;
- Mercado Pago webhook secret;
- public URL;
- photographer name;
- studio/brand name;
- business phone;
- business contact;
- Pix display data;
- packages;
- retention;
- watermark;
- overlays;
- presets;
- Stories;
- WhatsApp message templates.

Sensitive credentials are encrypted using `CREDENTIALS_SECRET`. The dashboard shows masked values.

### Retention and Cleanup

The system includes settings for:

- default gallery retention;
- delivered photo retention;
- expired share retention;
- archive-before-delete;
- automatic cleanup;
- cleanup preview and manual execution.

This matters because real photos are large, sensitive, and should not remain in the project forever.

## Architecture

### Layered View

```text
React/Vite frontend
  -> Express API
    -> Domain services
      -> PostgreSQL repositories
      -> Sharp/file storage
      -> Mercado Pago
      -> WhatsApp Web
```

The frontend owns experience and screen state. The backend owns security rules, persistence, payments, image processing, and delivery.

### Frontend

Main technologies:

- React 19;
- Vite;
- lucide-react;
- qrcode;
- Vitest;
- Testing Library;
- fast-check for property tests.

Structure:

- `src/screens`: main screens such as dashboard, gallery, summary, Pix, approval, shared link, and confirmation.
- `src/components`: panels, cards, modals, controls, and visual displays.
- `src/hooks`: state, polling, actions, credentials, settings, persistence, and protections.
- `src/lib`: pure rules for pricing, phone, e-mail, discounts, galleries, navigation, API, and formatting.

Main screens:

- Admin dashboard;
- Selection gallery;
- Summary/checkout;
- Pix screen;
- Manual pending screen;
- Admin approval screen;
- Shared-link code screen;
- Confirmation screen.

### Backend

Main technologies:

- Node.js CommonJS;
- Express 5;
- PostgreSQL through `pg`;
- Sharp;
- Mercado Pago SDK;
- whatsapp-web.js;
- Multer;
- dotenv;
- node:test;
- supertest.

Entrypoint:

- `backend/server.js`.

Routes:

- `healthRoutes`: API health.
- `adminRoutes`: upload, dashboard, admin Pix, admin manual payment, approval, galleries, settings.
- `adminOpsRoutes`: WhatsApp, cleanup, delivery retry, manual cancellation, stats.
- `shareRoutes`: public gallery access, unlock, paginated photos, cart, Pix, and customer manual payment.
- `paymentRoutes`: payment status, admin session, and Mercado Pago webhook.
- `mediaRoutes`: previews, thumbnails, assets, and admin original.
- `overlayAssetRoutes`: overlay library and gallery overlay assignment.
- `watermarkAssetRoutes`: watermark library and gallery watermark assignment.
- `photoPresetRoutes`: presets and gallery application.
- `storyDeliveryRoutes`: global Stories settings.
- `credentialRoutes`: editable credentials.
- `packageRoutes`: public package settings.

Services:

- `mediaService`: upload, storage, previews, thumbnails, presets, watermarks, overlays, cleanup.
- `mediaDeliveryService`: final-file preparation, delivery overlays, and Stories variants.
- `paymentService`: Mercado Pago Pix and webhook.
- `deliveryQueue`: delivery queue and retry.
- `whatsappClient`: pairing and WhatsApp Web sending.
- `galleryOverlayService`: per-gallery overlay.
- `galleryWatermarkService`: per-gallery watermark.
- `photoEditingPresetService`: editing presets.
- `credentialsService`: editable and masked secrets.
- `retentionService`: cleanup and retention.
- `whatsappTemplatesService`: configurable messages.
- `storyDeliverySettingsService`: Stories defaults.

### PostgreSQL

PostgreSQL is the source of truth for metadata. The schema evolves through migrations in `backend/migrations`.

Important entities:

- `sessions`: sales, payments, status, and delivery;
- `photos`: media metadata and paths;
- `share_sessions`: shared galleries;
- `delivery_jobs`: typed approval-notification and media queue;
- `download_entitlements`: persistent download rights per purchase and photo;
- `payment_events`: provider events;
- `app_settings`: settings;
- `cleanup_runs`: cleanup history;
- `share_carts`: persisted customer selections;
- `conversion_events`: funnel;
- `watermark_assets`: watermark library;
- `overlay_assets`: overlay library;
- preset, undo, watermark, overlay, and Stories fields.

### Storage

Photos are not committed to Git and are not stored as database blobs. They live under `STORAGE_ROOT`, while relative paths are stored in PostgreSQL. This simplifies backup, cleanup, and separation between metadata and large files.

### Security

Main mechanisms:

- `ADMIN_ACCESS_TOKEN` for admin routes;
- safe token comparison;
- temporary IP lock after five invalid attempts;
- `CREDENTIALS_SECRET` for credential encryption;
- Mercado Pago webhook HMAC verification;
- customer media access tokens;
- gallery expiration and revocation;
- private storage;
- `.gitignore` for secrets, storage, WhatsApp auth, and dumps;
- controlled JSON API errors, including fallback for missing routes.

## Technologies and Dependencies

Frontend:

- React;
- React DOM;
- Vite;
- lucide-react;
- qrcode.

Backend:

- Node.js;
- Express;
- PostgreSQL;
- Sharp;
- Mercado Pago SDK;
- whatsapp-web.js;
- Multer;
- dotenv;
- CORS.

Quality:

- ESLint;
- Vitest;
- Testing Library;
- node:test;
- supertest;
- fast-check.

Local operation:

- Windows BAT;
- Docker Compose with PostgreSQL 16 Alpine;
- native PostgreSQL option;
- npm scripts;
- Vite proxy for `/api`.

## Development and Operation Workflows

### Recommended Installation

`INSTALAR_SNAPFLOW.bat` checks the environment, installs dependencies, creates local files, starts PostgreSQL, runs migrations, and can start backend and dashboard.

### Docker-Free Installation

`INSTALAR_SNAPFLOW_SEM_DOCKER.bat` prepares native PostgreSQL on Windows when Docker Desktop is not desired.

### Daily Startup

`INICIAR_TUDO.bat`:

1. prepares local dependencies;
2. loads hosts and ports and confirms that API and dashboard can own the exact configured ports;
3. starts or validates PostgreSQL;
4. runs migrations once;
5. opens the backend and waits for `/api/health` to identify a ready SnapFlow API;
6. opens the Vite dashboard with strict port ownership;
7. verifies that the returned page is actually the SnapFlow dashboard.

During brief restarts, the WhatsApp card keeps polling the API and only alerts the operator after consecutive failures. When the backend returns, status recovers automatically. This avoids treating a transient `502` as permanent service loss without hiding sustained downtime.

Separate scripts:

- `INICIAR_BANCO.bat`;
- `INICIAR_SERVIDOR.bat`;
- `INICIAR_PAINEL.bat`;
- `PREPARAR_DEPENDENCIAS_LOCAIS.bat`.

### Validation Commands

```powershell
cmd /c npm.cmd test -- --run
cmd /c node --test backend\test\*.test.js
cmd /c npm.cmd run lint
cmd /c npm.cmd run build
cmd /c npm.cmd run db:migrate
```

## Advantages

- Integrates sale, checkout, and delivery into one workflow.
- Serves in-person operations, not only cold e-commerce.
- Keeps human control for cash/card payments.
- Automates Pix with webhook approval.
- Delivers through the channel customers already use: WhatsApp.
- Preserves quality by sending files as documents.
- Uses temporary galleries with code and expiration.
- Saves carts in the backend for returning customers.
- Allows per-gallery visual branding without mixing watermark and overlay.
- Generates 9:16 Stories variants with blurred background.
- Provides Windows scripts designed for operational users.
- Uses PostgreSQL for durability and growth beyond local JSON.
- Includes unit, integration, UI, and property tests.

## Limitations and Care Points

- WhatsApp Web depends on pairing, Chromium, and local-session stability.
- Automatic Pix requires a correctly configured public HTTPS webhook.
- Copy protections reduce casual misuse, but do not prevent screenshots or screen photos.
- Local storage requires backup and retention strategy.
- Exposing the dashboard publicly requires strong token, firewall, and correct `PUBLIC_BASE_URL`.
- The system does not replace deep professional photo editing.
- In operations with many simultaneous customers, Tailscale/Funnel should be treated as access/networking, not CDN.

## Natural Roadmap

Coherent future evolutions:

- abandoned-cart recovery through WhatsApp;
- analytics by gallery, event, source, and operator;
- average ticket and conversion by stage;
- ranking of most desired photos;
- package upsell with visual savings comparison;
- cache/CDN for larger operations;
- WebP thumbnails;
- extreme virtualization for thousands of photos;
- event reports;
- multiple operators and permissions;
- future AI for best-photo selection, closed-eye detection, face grouping, and commercial suggestions.

## Essential Glossary

- Shared gallery: manageable gallery with link, code, photos, and settings.
- Delivery session: sale/delivery attempt linked to photos and payment.
- Paid original: file delivered after approved payment.
- Watermark asset: reusable brand image for previews.
- Gallery watermark: effective watermark for one gallery.
- Plan B watermark: SnapFlow default watermark.
- Overlay asset: reusable image for visual composition.
- Gallery overlay: effective overlay for one gallery, with state and placement.
- Overlay orientation profile: overlay profile for vertical or horizontal photo.
- Story overlay profile: optional overlay profile for the 9:16 frame.
- Story delivery variant: 9:16 copy delivered alongside the paid original.
- Share cart: backend-saved cart for a shared gallery.
- Delivery job: item in the delivery queue.

## Essence

SnapFlow 2.0 is a tool for selling photography while the emotion of the photo is still alive. It replaces improvisation with workflow, waiting with automation, and manual delivery with traceable operation. Its role is to make the photographer faster, more organized, and more professional without pulling the customer away from the moment of purchase.
