require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function reset() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  };

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'Platform Administrator';
  if (!superAdminEmail || !superAdminPassword) {
    console.error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in the environment.');
    process.exit(1);
  }

  console.log('Connecting to MySQL...');
  const connection = await mysql.createConnection(config);

  try {
    console.log('Dropping old database...');
    await connection.query('DROP DATABASE IF EXISTS cleaning_platform');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('Creating fresh schema...');
    await connection.query(schema);

    const passwordHash = await bcrypt.hash(superAdminPassword, 12);
    await connection.query('USE cleaning_platform');
    await connection.query(
      `INSERT INTO super_admin (email, password_hash, full_name) VALUES (?, ?, ?)`,
      [superAdminEmail, passwordHash, superAdminName]
    );

    console.log('Database reset complete!');
    console.log(`Super Admin: ${superAdminEmail} (password set from SUPER_ADMIN_PASSWORD env var)`);
    console.log('Run: npm run db:seed  (for demo accounts)');
  } catch (error) {
    console.error('Reset failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

reset();
