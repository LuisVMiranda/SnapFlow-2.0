alter table share_sessions
  add column if not exists access_code text;

create index if not exists share_sessions_access_code_idx on share_sessions(access_code);
