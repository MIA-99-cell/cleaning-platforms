require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

(async () => {
  const [tables] = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('reviews', 'cleaner_assignments', 'cleaners', 'bookings')
  `);
  console.log('tables:', tables.map((t) => t.table_name));

  try {
    const [bookings] = await pool.query(
      `SELECT b.id, bs.name AS status, s.name AS service_name, co.company_name,
        cl.full_name AS cleaner_name,
        (SELECT id FROM reviews r WHERE r.booking_id = b.id LIMIT 1) AS review_id,
        (SELECT CASE WHEN p.status = 'successful' THEN 'confirmed' ELSE p.status END
         FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status
       FROM bookings b
       JOIN booking_status bs ON b.status_id = bs.id
       JOIN services s ON b.service_id = s.id
       LEFT JOIN companies co ON b.tenant_id = co.tenant_id
       LEFT JOIN cleaner_assignments ca ON ca.booking_id = b.id
       LEFT JOIN cleaners cl ON ca.cleaner_id = cl.id
       WHERE b.customer_id = ?
       ORDER BY b.scheduled_date DESC LIMIT 5`,
      [2]
    );
    console.log('getCustomerBookings OK:', bookings.length, bookings);
  } catch (e) {
    console.error('getCustomerBookings FAILED:', e.message);
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
