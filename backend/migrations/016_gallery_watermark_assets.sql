create table if not exists watermark_assets (
  id text primary key,
  name text not null,
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

create index if not exists watermark_assets_deleted_at_idx
  on watermark_assets(deleted_at);

alter table share_sessions
  add column if not exists watermark_asset_id text references watermark_assets(id) on delete restrict,
  add column if not exists watermark_settings jsonb not null default '{}'::jsonb,
  add column if not exists watermark_updated_at timestamptz;

create index if not exists share_sessions_watermark_asset_id_idx
  on share_sessions(watermark_asset_id)
  where watermark_asset_id is not null;

alter table photos
  add column if not exists watermark_applied_at timestamptz;
