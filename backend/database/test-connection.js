require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

(async () => {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS total FROM tenants');
    console.log('Database connection OK');
    console.log('Tenants count:', rows[0]?.total ?? rows[0]);
    process.exit(0);
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
})();
