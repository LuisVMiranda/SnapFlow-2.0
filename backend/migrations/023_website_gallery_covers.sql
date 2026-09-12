create table if not exists gallery_covers (
  share_token text primary key references share_sessions(token) on delete cascade,
  card_path text not null,
  access_path text not null,
  width integer not null,
  height integer not null,
  version text not null,
  original_filename text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists website_gallery_entries (
  share_token text primary key references share_sessions(token) on delete cascade,
  position bigint not null,
  state text not null default 'visible' check (state in ('visible', 'excluded')),
  updated_at timestamptz not null default now()
);
create index if not exists website_gallery_order_idx on website_gallery_entries(state, position, share_token);
create index if not exists website_gallery_eligibility_idx
  on share_sessions(package_type, created_at desc, token)
  where deleted_at is null and revoked_at is null;
insert into app_settings(key, value) values
  ('websiteSettings', '{"eligiblePackageTypes":["eventos"]}'::jsonb)
on conflict (key) do nothing;
