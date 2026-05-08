const { Pool } = require('pg');

function createPool(config) {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL ausente. Rode INSTALAR_SNAPFLOW.bat ou INSTALAR_SNAPFLOW_SEM_DOCKER.bat para configurar o Postgres antes de iniciar o backend.');
  }
  return new Pool({ connectionString: config.databaseUrl });
}

async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createPool, withTransaction };
