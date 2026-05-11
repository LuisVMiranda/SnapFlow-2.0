alter table sessions
  add column if not exists subtotal_cents integer not null default 0;

alter table sessions
  add column if not exists discount_cents integer not null default 0;

alter table share_sessions
  add column if not exists subtotal_cents integer not null default 0;

alter table share_sessions
  add column if not exists discount_cents integer not null default 0;

update sessions
set subtotal_cents = amount_cents
where coalesce(subtotal_cents, 0) = 0;

update share_sessions
set subtotal_cents = total_cents
where coalesce(subtotal_cents, 0) = 0;
