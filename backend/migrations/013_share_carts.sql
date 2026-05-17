create table if not exists share_carts (
  share_token text primary key references share_sessions(token) on delete cascade,
  photo_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

