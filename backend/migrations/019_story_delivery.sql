alter table overlay_assets
  add column if not exists story_settings jsonb not null default '{}'::jsonb,
  add column if not exists story_settings_updated_at timestamptz;

alter table share_sessions
  add column if not exists story_delivery_enabled boolean not null default false;

insert into app_settings(key, value) values
  ('storyDeliverySettings', '{"defaultEnabled":false}'::jsonb)
on conflict (key) do nothing;
