require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

(async () => {
  const [monthlyStats] = await pool.query(`
    SELECT
      COALESCE(b.month, p.month) AS month,
      COALESCE(b.bookings, 0) AS bookings,
      COALESCE(p.revenue, 0) AS revenue
    FROM (
      SELECT to_char(created_at, 'YYYY-MM') AS month, COUNT(*) AS bookings
      FROM bookings
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY 1
    ) b
    FULL OUTER JOIN (
      SELECT to_char(created_at, 'YYYY-MM') AS month, COALESCE(SUM(amount), 0) AS revenue
      FROM payments
      WHERE status = 'confirmed' AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY 1
    ) p ON b.month = p.month
    ORDER BY month DESC
  `);
  console.log('monthly OK:', monthlyStats);

  await pool.query(
    `INSERT INTO notifications (user_type, title, message, type) VALUES ('all', ?, ?, ?)`,
    ['Test', 'Test message', 'info']
  );
  console.log('announcement OK');
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
