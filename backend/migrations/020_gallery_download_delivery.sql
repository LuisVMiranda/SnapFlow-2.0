alter table share_sessions
  add column if not exists delivery_mode text not null default 'whatsapp';

update share_sessions
set delivery_mode = 'whatsapp'
where delivery_mode is null
   or delivery_mode not in ('whatsapp', 'download', 'both');

alter table share_sessions
  drop constraint if exists share_sessions_delivery_mode_check;

alter table share_sessions
  add constraint share_sessions_delivery_mode_check
  check (delivery_mode in ('whatsapp', 'download', 'both'));

create table if not exists download_entitlements (
  id bigserial primary key,
  share_token text not null references share_sessions(token) on delete cascade,
  session_id text not null references sessions(id) on delete cascade,
  photo_id text not null references photos(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists download_entitlements_share_photo_unique
  on download_entitlements(share_token, photo_id);

create index if not exists download_entitlements_session_idx
  on download_entitlements(session_id);

insert into app_settings(key, value) values
  ('defaultDeliveryMode', '"both"'::jsonb)
on conflict (key) do nothing;
