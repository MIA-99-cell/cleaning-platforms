require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

const run = async (sql) => {
  await pool.query(sql);
};

(async () => {
  await run(`
    ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS flw_charge_id VARCHAR(100)
  `);

  await run(`
    ALTER TABLE product_orders
    ADD COLUMN IF NOT EXISTS flw_charge_id VARCHAR(100)
  `);

  await run(`
    ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS payments_payment_method_check
  `);

  await run(`
    ALTER TABLE payments
    ADD CONSTRAINT payments_payment_method_check
    CHECK (payment_method IN ('mobile_money', 'card', 'cash', 'bank_transfer', 'flutterwave'))
  `);

  await run(`
    ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS payments_status_check
  `);

  await run(`
    ALTER TABLE payments
    ADD CONSTRAINT payments_status_check
    CHECK (status IN ('pending', 'confirmed', 'successful', 'failed', 'refunded'))
  `);

  await run(`
    ALTER TABLE product_orders
    DROP CONSTRAINT IF EXISTS product_orders_payment_method_check
  `);

  await run(`
    ALTER TABLE product_orders
    ADD CONSTRAINT product_orders_payment_method_check
    CHECK (payment_method IN ('cash_on_delivery', 'mobile_money', 'flutterwave'))
  `);

  console.log('Flutterwave payment columns and constraints are ready');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
