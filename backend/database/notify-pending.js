require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const { notifySuperAdminsApprovalNeeded } = require('../src/services/notificationService');

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cleaning_platform',
  });

  const [tenants] = await c.query(
    `SELECT t.*, c.company_name, c.license_number FROM tenants t
     LEFT JOIN companies c ON t.id = c.tenant_id
     WHERE t.status = 'pending' AND t.email_verified = TRUE`
  );

  for (const tenant of tenants) {
    const approvalToken = uuidv4();
    const approvalExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await c.query(
      'UPDATE tenants SET admin_approval_token = ?, admin_approval_token_expires = ? WHERE id = ?',
      [approvalToken, approvalExpires, tenant.id]
    );
    const result = await notifySuperAdminsApprovalNeeded({
      tenantId: tenant.id,
      companyName: tenant.company_name || tenant.full_name,
      contactName: tenant.full_name,
      email: tenant.email,
      licenseNumber: tenant.license_number || 'N/A',
      phone: tenant.phone,
      approvalToken,
    });
    console.log(`Notified admin for: ${tenant.company_name || tenant.email}`);
    if (result.approveUrl) console.log(`  Approve: ${result.approveUrl}`);
  }

  console.log(`Done. Processed ${tenants.length} tenant(s).`);
  await c.end();
})();
