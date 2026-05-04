function createCredentialRepo({ query }) {
  async function listCredentials() {
    const result = await query('select * from admin_credentials order by key');
    return result.rows;
  }

  async function getCredential(key) {
    const result = await query('select * from admin_credentials where key = $1', [key]);
    return result.rows[0] || null;
  }

  async function upsertCredential(record) {
    const result = await query(
      `insert into admin_credentials (key, value, sensitive)
       values ($1, $2, $3)
       on conflict (key) do update set
         value = excluded.value,
         sensitive = excluded.sensitive,
         updated_at = now()
       returning *`,
      [record.key, record.value, Boolean(record.sensitive)]
    );
    return result.rows[0] || null;
  }

  async function deleteCredential(key) {
    const result = await query('delete from admin_credentials where key = $1 returning *', [key]);
    return result.rows[0] || null;
  }

  return {
    deleteCredential,
    getCredential,
    listCredentials,
    upsertCredential,
  };
}

module.exports = { createCredentialRepo };
