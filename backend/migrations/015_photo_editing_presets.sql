alter table photos
  add column if not exists source_path text,
  add column if not exists applied_preset_ids text[] not null default '{}',
  add column if not exists applied_preset_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists preset_applied_at timestamptz,
  add column if not exists undo_original_path text,
  add column if not exists undo_thumb_path text,
  add column if not exists undo_preview_path text,
  add column if not exists undo_preset_snapshot jsonb;

alter table share_sessions
  add column if not exists photo_preset_ids text[] not null default '{}',
  add column if not exists photo_preset_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists photo_preset_applied_at timestamptz,
  add column if not exists photo_preset_undo_snapshot jsonb;

insert into app_settings(key, value)
values ('photoEditingPresets', '[]'::jsonb)
on conflict (key) do nothing;
