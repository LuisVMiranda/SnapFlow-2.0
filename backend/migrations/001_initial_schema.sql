create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  amount_cents integer not null default 0,
  photo_count integer not null default 0,
  package_type text not null default 'eventos',
  phone text not null default '',
  status text not null default 'pending',
  payment_method text,
  payment_id text,
  share_token text,
  delivery_status text not null default 'idle',
  delivery_error text,
  delivered_at timestamptz,
  delivery_updated_at timestamptz
);

create table if not exists photos (
  id text primary key,
  session_id text references sessions(id) on delete set null,
  share_token text,
  original_path text not null,
  thumb_path text not null,
  preview_path text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  checksum text,
  created_at timestamptz not null default now(),
  retention_expires_at timestamptz,
  deleted_at timestamptz
);

create table if not exists share_sessions (
  token text primary key,
  access_code_hash text not null,
  phone text not null default '',
  package_type text not null default 'eventos',
  photo_count integer not null default 0,
  total_cents integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  status text not null default 'active',
  access_granted_at timestamptz,
  extends_count integer not null default 0,
  retention_expires_at timestamptz,
  link text
);

create table if not exists delivery_jobs (
  id bigserial primary key,
  session_id text not null references sessions(id) on delete cascade,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists delivery_jobs_active_unique
  on delivery_jobs(session_id)
  where status in ('pending', 'running', 'sent');

create table if not exists payment_events (
  id bigserial primary key,
  provider text not null,
  provider_event_id text not null,
  payment_id text,
  session_id text,
  status text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists cleanup_runs (
  id bigserial primary key,
  mode text not null,
  files_count integer not null default 0,
  bytes_count bigint not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sessions_created_at_idx on sessions(created_at);
create index if not exists sessions_status_idx on sessions(status);
create index if not exists sessions_payment_id_idx on sessions(payment_id);
create index if not exists sessions_share_token_idx on sessions(share_token);
create index if not exists photos_session_id_idx on photos(session_id);
create index if not exists photos_share_token_idx on photos(share_token);
create index if not exists photos_retention_expires_at_idx on photos(retention_expires_at);
create index if not exists photos_deleted_at_idx on photos(deleted_at);
create index if not exists share_sessions_expires_at_idx on share_sessions(expires_at);
create index if not exists share_sessions_retention_expires_at_idx on share_sessions(retention_expires_at);
create index if not exists delivery_jobs_status_next_attempt_idx on delivery_jobs(status, next_attempt_at);
create unique index if not exists payment_events_provider_event_unique on payment_events(provider_event_id);

insert into app_settings(key, value) values
  ('defaultGalleryRetentionDays', '30'::jsonb),
  ('deliveredPhotoRetentionDays', '30'::jsonb),
  ('expiredShareRetentionDays', '7'::jsonb),
  ('archiveBeforeDelete', 'false'::jsonb),
  ('autoCleanupEnabled', 'false'::jsonb)
on conflict (key) do nothing;
