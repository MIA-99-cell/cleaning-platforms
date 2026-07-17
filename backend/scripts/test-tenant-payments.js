require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');
const { generateToken } = require('../src/utils/auth');

(async () => {
  const [tenants] = await pool.query('SELECT id, email FROM tenants LIMIT 3');
  console.log('tenants:', tenants);

  for (const t of tenants) {
    const token = generateToken({ id: t.id, email: t.email, role: 'tenant', name: 'Tenant' });
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await fetch('http://localhost:5000/api/tenant/payments', { headers });
      const body = await res.json();
      console.log(`\n${t.email} GET payments:`, res.status, body.message || 'ok', 'count:', body.data?.length);
      if (body.data?.length) console.log('sample:', body.data[0]);
    } catch (e) {
      console.error('fetch failed:', e.message);
    }
  }

  try {
    const [payments] = await pool.query(`
      SELECT p.*, c.full_name AS customer_name, s.name AS service_name
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN customers c ON p.customer_id = c.id
      JOIN services s ON b.service_id = s.id
      ORDER BY p.created_at DESC LIMIT 5
    `);
    console.log('\nraw payments:', payments);
  } catch (e) {
    console.error('raw query failed:', e.message);
  }

  const [tables] = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('payments', 'invoices')
  `);
  console.log('\ntables:', tables.map((r) => r.table_name));

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
