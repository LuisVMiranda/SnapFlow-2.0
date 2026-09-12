const { HttpError } = require('../errors');

const COVER_JOIN = `from share_sessions s
  left join gallery_covers c on c.share_token = s.token
  left join website_gallery_entries e on e.share_token = s.token`;
const ELIGIBLE = `s.deleted_at is null and s.revoked_at is null
  and s.status = 'active' and s.expires_at > now()
  and btrim(s.gallery_name) <> '' and c.share_token is not null
  and s.package_type = any($1::text[])
  and exists(select 1 from photos p where p.share_token = s.token and p.deleted_at is null)`;
const FIELDS = `s.token, s.gallery_id, s.gallery_name, s.package_type, s.created_at,
  s.expires_at, s.revoked_at, s.status, c.version, c.width, c.height, e.state, e.position`;

function createWebsiteRepo({ pool, query, withTransaction }) {
  let initialization;
  function transaction(action) {
    return withTransaction(pool, async (client) => {
      await client.query('select pg_advisory_xact_lock(7351023)');
      return action(client);
    });
  }

  async function seed(client) {
    await client.query(`insert into website_gallery_entries(share_token, position)
      select c.share_token, coalesce((select max(position) from website_gallery_entries), 0)
        + row_number() over(order by s.created_at desc, s.token)
      from gallery_covers c join share_sessions s on s.token = c.share_token
      where s.deleted_at is null and not exists
        (select 1 from website_gallery_entries e where e.share_token = c.share_token)
      on conflict do nothing`);
  }

  async function websiteCarousel(types) {
    initialization ||= transaction(seed).catch((error) => { initialization = null; throw error; });
    await initialization;
    const result = await query(`select ${FIELDS} ${COVER_JOIN}
      where ${ELIGIBLE} and e.state = 'visible'
      order by e.position, s.token limit 10`, [types]);
    return result.rows;
  }

  async function searchWebsiteGalleries({ search, offset, limit, types }) {
    const result = await query(`select ${FIELDS}, (${ELIGIBLE}) as eligible
      ${COVER_JOIN} where s.deleted_at is null and
      (s.gallery_name ilike $2 or s.token ilike $2)
      order by s.created_at desc, s.token limit $3 offset $4`,
    [types, `%${search}%`, limit + 1, offset]);
    return result.rows;
  }

  async function changeWebsiteEntry(token, state, types) {
    return transaction(async (client) => {
      const result = await client.query(`select s.token ${COVER_JOIN}
        where s.token = $2 and ${ELIGIBLE}`, [types, token]);
      if (state === 'visible' && !result.rowCount) {
        throw new HttpError(409, 'A galeria precisa de título, capa, fotos, tipo habilitado e acesso ativo.', 'website_gallery_ineligible');
      }
      await client.query(`insert into website_gallery_entries(share_token, state, position)
        values ($1, $2, coalesce((select min(position) from website_gallery_entries), 0) - 1)
        on conflict(share_token) do update set state = excluded.state,
        position = case when excluded.state = 'visible' then excluded.position else website_gallery_entries.position end,
        updated_at = now()`, [token, state]);
    });
  }

  async function reorderWebsite(tokens, types) {
    return transaction(async (client) => {
      const current = await client.query(`select s.token, e.position ${COVER_JOIN}
        where ${ELIGIBLE} and e.state = 'visible'
        order by e.position, s.token limit 10`, [types]);
      const expected = new Set(current.rows.map((row) => row.token));
      if (tokens.length !== expected.size || tokens.some((token) => !expected.has(token))) {
        throw new HttpError(409, 'A lista mudou. Atualize o painel antes de ordenar.', 'website_order_conflict');
      }
      for (const [index, token] of tokens.entries()) {
        await client.query('update website_gallery_entries set position = $2, updated_at = now() where share_token = $1',
          [token, current.rows[index].position]);
      }
    });
  }

  async function getGalleryCover(token) {
    const result = await query(`select c.* from gallery_covers c join share_sessions s on s.token = c.share_token
      where c.share_token = $1 and s.deleted_at is null`, [token]);
    return result.rows[0] || null;
  }

  async function replaceGalleryCover(token, cover) {
    return transaction(async (client) => {
      const share = await client.query('select token from share_sessions where token = $1 and deleted_at is null for update', [token]);
      if (!share.rowCount) throw new HttpError(404, 'Galeria não encontrada.', 'share_not_found');
      const old = await client.query('select * from gallery_covers where share_token = $1', [token]);
      await client.query(`insert into gallery_covers
        (share_token, card_path, access_path, width, height, version, original_filename)
        values($1,$2,$3,$4,$5,$6,$7) on conflict(share_token) do update set
        card_path=$2, access_path=$3, width=$4, height=$5, version=$6,
        original_filename=$7, updated_at=now()`,
      [token, cover.card_path, cover.access_path, cover.width, cover.height, cover.version, cover.original_filename]);
      await client.query(`insert into website_gallery_entries(share_token, position)
        values($1, coalesce((select min(position) from website_gallery_entries),0)-1)
        on conflict do nothing`, [token]);
      return old.rows[0];
    });
  }

  async function removeGalleryCover(token, removeEntry = false) {
    return transaction(async (client) => {
      const result = await client.query('delete from gallery_covers where share_token = $1 returning *', [token]);
      if (removeEntry) await client.query('delete from website_gallery_entries where share_token = $1', [token]);
      return result.rows[0];
    });
  }

  return { websiteCarousel, searchWebsiteGalleries, changeWebsiteEntry, reorderWebsite,
    getGalleryCover, replaceGalleryCover, removeGalleryCover };
}

module.exports = { createWebsiteRepo };
