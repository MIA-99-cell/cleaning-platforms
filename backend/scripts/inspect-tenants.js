require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

(async () => {
  const [cols] = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'tenants'
      AND column_name IN ('is_active', 'email_verified', 'status')
  `);
  console.log('columns:', cols);

  const [tenants] = await pool.query(
    'SELECT id, email, status, is_active, email_verified FROM tenants LIMIT 10'
  );
  console.log('tenants:', tenants);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
