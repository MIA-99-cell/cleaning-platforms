require('dotenv').config();
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'cleaning_platform',
  });
  const [t] = await c.query(
    `SELECT t.id, t.email, t.email_verified, t.status, t.email_verification_token, c.company_name
     FROM tenants t LEFT JOIN companies c ON t.id = c.tenant_id
     WHERE t.email = 'besongemanuela@gmail.com'`
  );
  console.log(t[0]);
  await c.end();
})();
