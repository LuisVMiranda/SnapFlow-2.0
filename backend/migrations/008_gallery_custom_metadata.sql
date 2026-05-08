alter table sessions
  add column if not exists client_email text not null default '';

alter table share_sessions
  add column if not exists client_email text not null default '';

alter table share_sessions
  add column if not exists gallery_name text not null default '',
  add column if not exists gallery_description text not null default '';
