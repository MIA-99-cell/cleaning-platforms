require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'cleaning_platform',
  });
  const [pending] = await c.query(
    `SELECT t.id, t.email, t.email_verified, t.status, t.admin_approval_token, c.company_name
     FROM tenants t LEFT JOIN companies c ON t.id = c.tenant_id WHERE t.status = 'pending'`
  );
  console.log('Pending tenants:', JSON.stringify(pending, null, 2));
  const [admin] = await c.query('SELECT email, phone FROM super_admin');
  console.log('Super admin:', JSON.stringify(admin, null, 2));
  await c.end();
})();
