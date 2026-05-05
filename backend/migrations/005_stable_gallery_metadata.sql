alter table share_sessions
  add column if not exists gallery_id text;

update share_sessions
set gallery_id = token
where gallery_id is null;

alter table share_sessions
  alter column gallery_id set not null;

create unique index if not exists share_sessions_gallery_id_unique
  on share_sessions(gallery_id);
