require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cleaning_platform',
  });

  const alters = [
    "ALTER TABLE tenants ADD COLUMN admin_approval_token VARCHAR(255)",
    "ALTER TABLE tenants ADD COLUMN admin_approval_token_expires DATETIME",
    "ALTER TABLE super_admin ADD COLUMN phone VARCHAR(50)",
  ];

  for (const sql of alters) {
    try {
      await connection.query(sql);
      console.log('OK:', sql.split('ADD COLUMN ')[1]);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('Skip (exists):', sql.split('ADD COLUMN ')[1]);
      } else {
        throw err;
      }
    }
  }

  console.log('Migration complete');
  await connection.end();
}

migrate().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
