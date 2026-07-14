alter table share_sessions
  add column if not exists post_payment_access_days integer not null default 7;

alter table share_sessions
  drop constraint if exists share_sessions_post_payment_access_days_check;

alter table share_sessions
  add constraint share_sessions_post_payment_access_days_check
  check (post_payment_access_days between 1 and 365);

alter table delivery_jobs
  add column if not exists kind text not null default 'media';

alter table delivery_jobs
  drop constraint if exists delivery_jobs_kind_check;

alter table delivery_jobs
  add constraint delivery_jobs_kind_check
  check (kind in ('media', 'approval_notification'));

drop index if exists delivery_jobs_active_unique;

create unique index if not exists delivery_jobs_active_kind_unique
  on delivery_jobs(session_id, kind)
  where status in ('pending', 'running', 'sent');

create index if not exists delivery_jobs_claim_idx
  on delivery_jobs(status, next_attempt_at, kind, created_at);

insert into app_settings(key, value) values
  ('defaultPostPaymentAccessDays', '7'::jsonb),
  ('defaultSendOriginalsViaWhatsapp', 'false'::jsonb)
on conflict (key) do nothing;
