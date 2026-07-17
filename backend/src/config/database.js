const { Pool } = require('pg');

const toPgParams = (sql, params = []) => {
  let index = 0;
  const text = sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
  return { text, values: params };
};

const isInsert = (sql) => /^\s*insert\s+into/i.test(sql);
const hasReturning = (sql) => /\breturning\b/i.test(sql);

const wrapInsert = (sql) => {
  if (!isInsert(sql) || hasReturning(sql)) return sql;
  return `${sql.trim().replace(/;+\s*$/, '')} RETURNING id`;
};

const formatResult = (sql, result) => {
  if (isInsert(sql) && result.rows?.[0]?.id != null) {
    return [{ insertId: result.rows[0].id, affectedRows: result.rowCount }, []];
  }
  if (/^\s*(update|delete)\s+/i.test(sql)) {
    return [{ affectedRows: result.rowCount, insertId: 0 }, []];
  }
  return [result.rows, []];
};

const createQueryExecutor = (queryFn) => async (sql, params = []) => {
  const preparedSql = wrapInsert(sql);
  const { text, values } = toPgParams(preparedSql, params);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await queryFn(text, values);
      return formatResult(sql, result);
    } catch (err) {
      lastError = err;
      const retryable = ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err.code);
      if (!retryable || attempt === 3) throw err;
      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }
  throw lastError;
};

let pool;

const isPlaceholderDbUrl = (url) =>
  !url || url.includes('[YOUR-PASSWORD]') || url.includes('YOUR_DB_PASSWORD');

const dbUrl = process.env.DATABASE_URL;
const usePostgres = dbUrl && !isPlaceholderDbUrl(dbUrl);

if (usePostgres) {
  const pgPool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false,
  });

  const nativeQuery = pgPool.query.bind(pgPool);

  pool = {
    query: createQueryExecutor(nativeQuery),
    getConnection: async () => {
      const client = await pgPool.connect();
      const clientQuery = client.query.bind(client);
      return {
        query: createQueryExecutor(clientQuery),
        beginTransaction: async () => client.query('BEGIN'),
        commit: async () => client.query('COMMIT'),
        rollback: async () => client.query('ROLLBACK'),
        release: () => client.release(),
      };
    },
  };
} else {
  if (isPlaceholderDbUrl(dbUrl)) {
    console.warn('[DB] DATABASE_URL still has placeholder password. Falling back to MySQL.');
  }
  const mysql = require('mysql2/promise');
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cleaning_platform',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

module.exports = pool;
