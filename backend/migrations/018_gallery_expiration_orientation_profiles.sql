update share_sessions
set expires_at = now() + interval '30 minutes'
where deleted_at is null
  and revoked_at is null
  and expires_at > now() + interval '180 minutes';
