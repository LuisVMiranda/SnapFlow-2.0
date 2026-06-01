create table if not exists overlay_assets (
  id text primary key,
  identifier text not null,
  original_filename text not null default '',
  storage_path text not null unique,
  mime_type text not null default 'image/png',
  width integer not null default 0,
  height integer not null default 0,
  size_bytes bigint not null default 0,
  checksum text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists overlay_assets_identifier_active_idx
  on overlay_assets(lower(identifier))
  where deleted_at is null;

create index if not exists overlay_assets_deleted_at_idx
  on overlay_assets(deleted_at);

alter table share_sessions
  add column if not exists overlay_asset_id text references overlay_assets(id) on delete restrict,
  add column if not exists overlay_enabled boolean not null default false,
  add column if not exists overlay_settings jsonb not null default '{}'::jsonb,
  add column if not exists overlay_updated_at timestamptz;

create index if not exists share_sessions_overlay_asset_id_idx
  on share_sessions(overlay_asset_id)
  where overlay_asset_id is not null;

alter table photos
  add column if not exists overlay_applied_at timestamptz;
