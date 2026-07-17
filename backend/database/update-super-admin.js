require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const SUPER_ADMIN_EMAIL = 'admincleaning43@gmail.com';
const SUPER_ADMIN_PASSWORD = 'admin@1234.*';
const SUPER_ADMIN_NAME = 'Platform Administrator';

async function updateSuperAdmin() {
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
    console.log(`  Password: ${SUPER_ADMIN_PASSWORD}`);
  } catch (error) {
    console.error('Update failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

updateSuperAdmin();
