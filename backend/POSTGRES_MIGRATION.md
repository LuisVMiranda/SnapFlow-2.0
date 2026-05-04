# SnapFlow Postgres Migration Handoff

## Required Environment

Copy `.env.example` to `.env` and set real values:

- `DATABASE_URL`
- `ADMIN_ACCESS_TOKEN`
- `MP_ACCESS_TOKEN`
- `MP_WEBHOOK_SECRET`
- `PUBLIC_BASE_URL`
- `STORAGE_ROOT`

Rotate the previous Mercado Pago token before using this app outside this machine.

## Migration Order

1. Create the Postgres database referenced by `DATABASE_URL`.
2. Run `npm install` inside `backend/` if dependencies are not present.
3. Run `npm run migrate`.
4. Optionally import the existing JSON data with `npm run import:json`.
5. Start the backend with `npm start`.

## Runtime Data Cleanup From Git

The implementation adds runtime paths to `.gitignore`, but it intentionally does not remove already tracked data.
After confirming backups, run the following manually:

```powershell
git rm --cached backend/.env
git rm --cached backend/db.json
git rm --cached -r backend/uploads
git rm --cached -r backend/.wwebjs_auth
git rm --cached -r backend/.wwebjs_cache
```

## Storage Notes

Photos are stored as files under `STORAGE_ROOT`; Postgres stores metadata only. New uploads create:

- `originals/`
- `thumbs/`
- `previews/`
- `archive/` when archive-before-delete is enabled.

Customer media routes require a short-lived unlock token. Admin preview URLs use the current `ADMIN_ACCESS_TOKEN` from the management UI session.
