require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

(async () => {
  await pool.query(`
    ALTER TABLE product_orders
    ADD COLUMN IF NOT EXISTS order_group_id VARCHAR(50)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_product_orders_group ON product_orders(order_group_id)
  `);
  console.log('product_orders.order_group_id column ready');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
