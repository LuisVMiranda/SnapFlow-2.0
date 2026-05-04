alter table share_sessions
  add column if not exists deleted_at timestamptz;

create index if not exists share_sessions_deleted_at_idx on share_sessions(deleted_at);

create table if not exists admin_credentials (
  key text primary key,
  value text not null,
  sensitive boolean not null default true,
  updated_at timestamptz not null default now()
);
