create index if not exists photos_share_visible_cursor_idx
  on photos(share_token, deleted_at, created_at, id);

create index if not exists photos_share_visible_id_idx
  on photos(share_token, id)
  where deleted_at is null;
