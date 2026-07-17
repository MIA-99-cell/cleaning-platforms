require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

(async () => {
  const [tables] = await pool.query(`
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('booking_status', 'booking_statuses')
  `);

  const hasStatuses = tables.some((t) => t.table_name === 'booking_statuses');
  const statusEntry = tables.find((t) => t.table_name === 'booking_status');

  if (!hasStatuses) {
    console.error('booking_statuses table not found');
    process.exit(1);
  }

  if (statusEntry?.table_type === 'BASE TABLE') {
    console.log('Dropping duplicate booking_status table...');
    await pool.query('DROP TABLE booking_status CASCADE');
  }

  await pool.query(`
    CREATE OR REPLACE VIEW booking_status AS
    SELECT id, name, description
    FROM booking_statuses
  `);

  console.log('booking_status view now points to booking_statuses');
  const [rows] = await pool.query('SELECT * FROM booking_status ORDER BY id');
  console.log(rows);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
