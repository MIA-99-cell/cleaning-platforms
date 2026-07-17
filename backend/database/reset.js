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

  console.log('Connecting to MySQL...');
  const connection = await mysql.createConnection(config);

  try {
    console.log('Dropping old database...');
    await connection.query('DROP DATABASE IF EXISTS cleaning_platform');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('Creating fresh schema...');
    await connection.query(schema);

    const passwordHash = await bcrypt.hash('admin@1234.*', 12);
    await connection.query('USE cleaning_platform');
    await connection.query(
      `INSERT INTO super_admin (email, password_hash, full_name) VALUES (?, ?, ?)`,
      ['admincleaning43@gmail.com', passwordHash, 'Platform Administrator']
    );

    console.log('Database reset complete!');
    console.log('Super Admin: admincleaning43@gmail.com / admin@1234.*');
    console.log('Run: npm run db:seed  (for demo accounts)');
  } catch (error) {
    console.error('Reset failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

reset();
