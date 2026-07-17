require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  const [dbs] = await c.query("SHOW DATABASES LIKE 'cleaning_platform'");
  if (dbs.length) {
    await c.query('USE cleaning_platform');
    const [tables] = await c.query('SHOW TABLES');
    console.log('DB exists, tables:', tables.length);
  } else {
    console.log('DB not found');
  }
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
