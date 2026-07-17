require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS credential_deliveries (
      id SERIAL PRIMARY KEY,
      token VARCHAR(255) NOT NULL UNIQUE,
      cleaner_id INTEGER REFERENCES cleaners(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      temp_password VARCHAR(255) NOT NULL,
      full_name VARCHAR(255),
      company_name VARCHAR(255),
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_credential_deliveries_token
    ON credential_deliveries(token)
  `);
  console.log('credential_deliveries table ready');
  process.exit(0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
