require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

(async () => {
  const tenantId = 1;
  try {
    const [[stats]] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE b.tenant_id = ? AND b.scheduled_date = CURRENT_DATE) AS todays_jobs,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE b.tenant_id = ? AND bs.name = 'pending') AS pending_jobs,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE b.tenant_id = ? AND bs.name = 'completed') AS completed_jobs,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE b.tenant_id = ? AND bs.name = 'cancelled') AS cancelled_jobs,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE tenant_id = ? AND status = 'confirmed' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())) AS monthly_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE tenant_id = ? AND status = 'confirmed' AND DATE(created_at) = CURRENT_DATE) AS todays_revenue,
        (SELECT COUNT(DISTINCT customer_id) FROM bookings WHERE tenant_id = ?) AS total_customers,
        (SELECT COUNT(*) FROM cleaners WHERE tenant_id = ? AND status = 'active') AS total_cleaners`,
      Array(8).fill(tenantId)
    );
    console.log('stats', stats);
  } catch (e) {
    console.error('query failed:', e.message);
  }
  process.exit(0);
})();
