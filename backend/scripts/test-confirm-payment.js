require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');
const { DB_CONFIRMED } = require('../src/utils/paymentStatus');

(async () => {
  const [pending] = await pool.query(`SELECT * FROM payments WHERE status = 'pending' LIMIT 1`);
  if (!pending.length) {
    console.log('No pending payments');
    process.exit(0);
  }
  const p = pending[0];

  await pool.query(
    `UPDATE payments SET status = ?, confirmed_at = NOW(), confirmed_by = ? WHERE id = ? AND tenant_id = ?`,
    [DB_CONFIRMED, '1', p.id, p.tenant_id]
  );
  console.log('Payment confirmed:', p.id);

  await pool.query(
    `INSERT INTO invoices (tenant_id, booking_id, payment_id, invoice_number, amount, status, issued_at)
     VALUES (?, ?, ?, ?, ?, 'paid', NOW())`,
    [p.tenant_id, p.booking_id, p.id, `INV-TEST-${Date.now()}`, p.amount]
  );
  console.log('Invoice created');
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
