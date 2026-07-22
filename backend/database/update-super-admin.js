require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'Platform Administrator';

async function updateSuperAdmin() {
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    console.error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in the environment.');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cleaning_platform',
  });

  try {
    const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

    const [existing] = await connection.query('SELECT id FROM super_admin LIMIT 1');

    if (existing.length) {
      await connection.query(
        `UPDATE super_admin SET email = ?, password_hash = ?, full_name = ?, is_active = TRUE WHERE id = ?`,
        [SUPER_ADMIN_EMAIL, passwordHash, SUPER_ADMIN_NAME, existing[0].id]
      );
    } else {
      await connection.query(
        `INSERT INTO super_admin (email, password_hash, full_name) VALUES (?, ?, ?)`,
        [SUPER_ADMIN_EMAIL, passwordHash, SUPER_ADMIN_NAME]
      );
    }

    console.log('Super Admin updated successfully!');
    console.log(`  Email: ${SUPER_ADMIN_EMAIL}`);
    console.log('  Password: (set from SUPER_ADMIN_PASSWORD env var)');
  } catch (error) {
    console.error('Update failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

updateSuperAdmin();
