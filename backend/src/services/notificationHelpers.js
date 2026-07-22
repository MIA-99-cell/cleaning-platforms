const pool = require('../config/database');
const { sendSms } = require('./smsService');

const getTenantContact = async (tenantId) => {
  const [rows] = await pool.query(
    `SELECT t.phone AS tenant_phone, t.email AS tenant_email, t.full_name,
            c.phone AS company_phone, c.email AS company_email, c.company_name
     FROM tenants t
     LEFT JOIN companies c ON c.tenant_id = t.id
     WHERE t.id = ?`,
    [tenantId]
  );
  const row = rows[0] || {};
  return {
    phone: row.company_phone || row.tenant_phone,
    email: row.company_email || row.tenant_email,
    name: row.full_name || row.company_name || 'Tenant',
    companyName: row.company_name || 'Your company',
  };
};

const getCustomerContact = async (customerId) => {
  const [rows] = await pool.query(
    'SELECT full_name, phone, email FROM customers WHERE id = ?',
    [customerId]
  );
  return rows[0] || {};
};

const sendSmsAndReport = async ({ to, message, label }) => {
  if (!to) {
    console.warn(`[${label}] Customer has no phone number`);
    return { success: false, error: 'Missing phone number' };
  }

  const result = await sendSms({ to, message });
  if (!result.success) {
    console.error(`[${label}] SMS failed:`, result.error);
  }
  return result;
};

module.exports = {
  getTenantContact,
  getCustomerContact,
  sendSmsAndReport,
};
