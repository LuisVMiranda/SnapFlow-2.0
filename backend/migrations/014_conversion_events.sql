create table if not exists conversion_events (
  id bigserial primary key,
  event_type text not null,
  share_token text,
  session_id text,
  photo_count integer not null default 0,
  amount_cents integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversion_events_created_at_idx on conversion_events(created_at);
create index if not exists conversion_events_event_type_idx on conversion_events(event_type);
create index if not exists conversion_events_share_token_idx on conversion_events(share_token);
create index if not exists conversion_events_session_id_idx on conversion_events(session_id);

