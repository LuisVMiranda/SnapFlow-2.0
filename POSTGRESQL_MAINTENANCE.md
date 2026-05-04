# SnapFlow PostgreSQL Maintenance

## Local Development Credentials

These credentials are for the simple local Docker PostgreSQL setup only.

| Field | Value |
|---|---|
| Host | `127.0.0.1` |
| Port | `55432` |
| Database | `snapflow` |
| User | `snapflow` |
| Password | choose a local-only password |
| Connection URL | `postgres://snapflow:<local-password>@127.0.0.1:55432/snapflow` |

The local setup writes this database URL into ignored `backend/.env.local`:

```env
DATABASE_URL=postgres://snapflow:<local-password>@127.0.0.1:55432/snapflow
```

Set a unique local admin token in `backend/.env.local`:

```env
ADMIN_ACCESS_TOKEN=<long-random-local-token>
```

Use that same token in the SnapFlow dashboard "Acesso administrativo" field.

## Daily Commands

Start PostgreSQL:

```powershell
docker compose up -d postgres
```

Stop PostgreSQL without deleting data:

```powershell
docker compose stop postgres
```

Stop PostgreSQL and remove the container while keeping the named volume:

```powershell
docker compose down
```

Show logs:

```powershell
docker compose logs -f postgres
```

Run schema migrations:

```powershell
cd backend
npm run migrate
```

Import the old `backend/db.json` metadata after migrations:

```powershell
cd backend
npm run import:json
```

## Data Storage

PostgreSQL data lives in the Docker named volume `snapflow_postgres_data`.
Uploaded photos are not stored in PostgreSQL; the backend stores file metadata in PostgreSQL and image files under `STORAGE_ROOT`.

## Reset Local Database

This deletes the local database volume. Use only when you intentionally want a clean local database.

```powershell
docker compose down -v
docker compose up -d postgres
cd backend
npm run migrate
```

## Production Note

Do not reuse local development passwords outside this machine. For production, create a unique database user/password and update `DATABASE_URL`.
