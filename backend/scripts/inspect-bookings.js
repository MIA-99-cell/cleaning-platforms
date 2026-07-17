require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

(async () => {
  const [cols] = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'bookings'
    ORDER BY ordinal_position
  `);
  console.log('bookings columns:', cols);

  const [statusTables] = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE '%status%'
  `);
  console.log('status tables:', statusTables);

  for (const { table_name } of statusTables) {
    const [rows] = await pool.query(`SELECT * FROM ${table_name} LIMIT 10`);
    console.log(`${table_name}:`, rows);
  }

  const [bookings] = await pool.query('SELECT id, tenant_id, status_id, scheduled_date FROM bookings LIMIT 5');
  console.log('sample bookings:', bookings);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
