alter table sessions
  add column if not exists client_name text not null default '';

alter table share_sessions
  add column if not exists client_name text not null default '';
