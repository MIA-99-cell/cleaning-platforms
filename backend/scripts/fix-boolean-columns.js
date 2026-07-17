require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

const FIXES = [
  { table: 'super_admin', column: 'is_active' },
  { table: 'tenants', column: 'is_active' },
  { table: 'tenants', column: 'email_verified' },
  { table: 'cleaners', column: 'is_active' },
  { table: 'cleaners', column: 'must_change_password' },
  { table: 'customers', column: 'is_active' },
  { table: 'services', column: 'is_active' },
  { table: 'service_categories', column: 'is_active' },
  { table: 'password_resets', column: 'used' },
];

const truthy = "('1', 'true', 't', 'yes', 'TRUE')";

(async () => {
  for (const { table, column } of FIXES) {
    const [cols] = await pool.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ? AND column_name = ?`,
      [table, column]
    );
    if (!cols.length) {
      console.log(`Skip ${table}.${column} (column missing)`);
      continue;
    }
    if (cols[0].data_type === 'boolean') {
      console.log(`OK ${table}.${column} already boolean`);
      continue;
    }

    console.log(`Fixing ${table}.${column} (${cols[0].data_type} -> boolean)`);
    await pool.query(
      `UPDATE ${table}
       SET ${column} = CASE WHEN ${column}::text IN ${truthy} THEN 'true' ELSE 'false' END
       WHERE ${column} IS NOT NULL`
    );
    await pool.query(
      `ALTER TABLE ${table}
       ALTER COLUMN ${column} TYPE boolean
       USING (${column}::text IN ${truthy})`
    );
  }

  console.log('Boolean column migration complete.');
  process.exit(0);
})().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
