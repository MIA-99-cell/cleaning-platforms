require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function seedDemo() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cleaning_platform',
  });

  try {
    const tenantPass = await bcrypt.hash('Tenant@123', 12);
    const cleanerPass = await bcrypt.hash('Cleaner@123', 12);
    const customerPass = await bcrypt.hash('Customer@123', 12);

    let [tenants] = await connection.query("SELECT id FROM tenants WHERE email = 'tenant@demo.com'");
    let tenantId;

    if (!tenants.length) {
      const [result] = await connection.query(
        `INSERT INTO tenants (email, password_hash, full_name, phone, email_verified, status)
         VALUES (?, ?, ?, ?, TRUE, 'approved')`,
        ['tenant@demo.com', tenantPass, 'Demo Cleaning Co', '+1234567890']
      );
      tenantId = result.insertId;
    } else {
      tenantId = tenants[0].id;
      await connection.query(
        `UPDATE tenants SET password_hash = ?, status = 'approved', email_verified = TRUE WHERE id = ?`,
        [tenantPass, tenantId]
      );
    }

    const [companies] = await connection.query('SELECT id FROM companies WHERE tenant_id = ?', [tenantId]);
    if (!companies.length) {
      await connection.query(
        `INSERT INTO companies (tenant_id, company_name, address, phone, email, description, rating)
         VALUES (?, ?, ?, ?, ?, ?, 4.5)`,
        [tenantId, 'Sparkle Clean Services', '123 Main St, City', '+1234567890', 'tenant@demo.com', 'Professional home and office cleaning']
      );
    }

    const [serviceCount] = await connection.query('SELECT COUNT(*) AS c FROM services WHERE tenant_id = ?', [tenantId]);
    if (serviceCount[0].c === 0) {
      await connection.query(
        `INSERT INTO services (tenant_id, name, description, price, duration_minutes, is_active) VALUES
         (?, 'Standard Home Cleaning', 'Full home cleaning including kitchen and bathrooms', 15000, 120, TRUE),
         (?, 'Deep Cleaning', 'Intensive deep clean for move-in or move-out', 25000, 180, TRUE),
         (?, 'Office Cleaning', 'Commercial office space cleaning', 35000, 240, TRUE)`,
        [tenantId, tenantId, tenantId]
      );
    }

    const [cleaners] = await connection.query("SELECT id FROM cleaners WHERE email = 'cleaner@demo.com'");
    if (!cleaners.length) {
      await connection.query(
        `INSERT INTO cleaners (tenant_id, email, password_hash, full_name, phone, must_change_password, status)
         VALUES (?, ?, ?, ?, ?, FALSE, 'active')`,
        [tenantId, 'cleaner@demo.com', cleanerPass, 'John Cleaner', '+1987654321']
      );
    } else {
      await connection.query('UPDATE cleaners SET password_hash = ?, status = ? WHERE email = ?',
        [cleanerPass, 'active', 'cleaner@demo.com']);
    }

    const [customers] = await connection.query("SELECT id FROM customers WHERE email = 'customer@demo.com'");
    if (!customers.length) {
      await connection.query(
        `INSERT INTO customers (email, password_hash, full_name, phone, address)
         VALUES (?, ?, ?, ?, ?)`,
        ['customer@demo.com', customerPass, 'Jane Customer', '+1555123456', '456 Oak Ave, City']
      );
    } else {
      await connection.query('UPDATE customers SET password_hash = ? WHERE email = ?',
        [customerPass, 'customer@demo.com']);
    }

    console.log('Demo data seeded successfully!\n');
    console.log('Demo Accounts:');
    console.log('  Tenant:   tenant@demo.com   / Tenant@123');
    console.log('  Cleaner:  cleaner@demo.com  / Cleaner@123');
    console.log('  Customer: customer@demo.com / Customer@123');
    console.log('  Super Admin: admincleaning43@gmail.com / admin@1234.*');
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seedDemo();
