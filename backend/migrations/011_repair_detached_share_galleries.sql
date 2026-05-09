with live_empty_duplicates as (
  select live.*
  from share_sessions live
  where live.deleted_at is null
    and not exists (
      select 1
      from photos p
      where p.share_token = live.token
        and p.deleted_at is null
    )
),
deleted_photo_galleries as (
  select deleted.*
  from share_sessions deleted
  where deleted.deleted_at is not null
    and exists (
      select 1
      from photos p
      where p.share_token = deleted.token
        and p.deleted_at is null
    )
),
repair_pairs as (
  select distinct on (deleted.token)
         deleted.token as restore_token,
         live.token as duplicate_token
  from deleted_photo_galleries deleted
  join live_empty_duplicates live
    on live.phone = deleted.phone
   and live.client_name = deleted.client_name
   and live.client_email = deleted.client_email
   and live.package_type = deleted.package_type
   and live.total_cents = deleted.total_cents
   and live.photo_count = deleted.photo_count
   and abs(extract(epoch from (live.created_at - deleted.created_at))) <= 3600
  order by deleted.token, live.created_at desc
),
restored_galleries as (
  update share_sessions ss
  set deleted_at = null,
      revoked_at = null,
      status = 'active',
      expires_at = greatest(ss.expires_at, now() + interval '30 minutes'),
      photo_count = (
        select count(*)::int
        from photos p
        where p.share_token = ss.token
          and p.deleted_at is null
      )
  from repair_pairs pairs
  where ss.token = pairs.restore_token
  returning pairs.restore_token, pairs.duplicate_token
),
updated_sessions as (
  update sessions s
  set share_token = restored.restore_token
  from restored_galleries restored
  where s.share_token = restored.duplicate_token
  returning s.id
),
removed_empty_duplicates as (
  update share_sessions ss
  set deleted_at = coalesce(ss.deleted_at, now())
  from restored_galleries restored
  where ss.token = restored.duplicate_token
  returning ss.token
)
update sessions s
set status = 'cancelled',
    delivery_status = 'cancelled',
    delivery_error = 'Galeria removida pelo administrador.',
    delivery_updated_at = now()
where s.status = 'pending'
  and (
    exists (
      select 1
      from share_sessions ss
      where ss.token = s.share_token
        and ss.deleted_at is not null
    )
    or exists (
      select 1
      from photos p
      join share_sessions ss on ss.token = p.share_token
      where p.session_id = s.id
        and ss.deleted_at is not null
    )
  );
