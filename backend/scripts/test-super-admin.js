require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

(async () => {
  try {
    const [[stats]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM tenants) AS total_companies,
        (SELECT COUNT(*) FROM cleaners) AS total_cleaners,
        (SELECT COUNT(*) FROM customers) AS total_customers,
        (SELECT COUNT(*) FROM bookings) AS total_bookings,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'confirmed') AS total_revenue,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE bs.name = 'pending') AS pending_bookings,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE bs.name = 'completed') AS completed_bookings,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE bs.name = 'cancelled') AS cancelled_bookings,
        (SELECT COUNT(*) FROM tenants WHERE status = 'approved') AS active_companies,
        (SELECT COUNT(*) FROM tenants WHERE status = 'suspended') AS suspended_companies,
        (SELECT COUNT(*) FROM tenants WHERE status = 'pending') AS pending_companies,
        (SELECT COUNT(*) FROM tenants WHERE status = 'pending' AND email_verified = TRUE) AS pending_approval
    `);
    console.log('stats OK:', stats);
  } catch (e) {
    console.error('stats failed:', e.message);
  }

  try {
    await pool.query(
      `INSERT INTO notifications (user_type, title, message, type) VALUES ('all', ?, ?, ?)`,
      ['Test', 'Test message', 'info']
    );
    console.log('announcement insert OK');
  } catch (e) {
    console.error('announcement failed:', e.message);
  }

  const [tables] = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('booking_status', 'booking_statuses', 'notifications')
  `);
  console.log('tables:', tables);

  const [notifCols] = await pool.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'notifications'
  `);
  console.log('notifications columns:', notifCols);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
