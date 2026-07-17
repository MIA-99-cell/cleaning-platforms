require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

(async () => {
  const [rows] = await pool.query(`
    SELECT conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'notifications'
  `);
  console.log(rows);
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
