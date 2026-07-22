const pool = require('../config/database');

const logError = (context, error) => {
  if (error instanceof Error) {
    console.error(`[${context}]`, error.stack || error.message);
  } else {
    console.error(`[${context}]`, error);
  }
};

const logActivity = async ({
  tenantId = null,
  userType,
  userId,
  action,
  entityType = null,
  entityId = null,
  details = null,
  ipAddress = null,
}) => {
  try {
    let safeTenantId = tenantId || null;
    if (safeTenantId) {
      const [tenants] = await pool.query('SELECT id FROM tenants WHERE id = ? LIMIT 1', [safeTenantId]);
      if (!tenants.length) safeTenantId = null;
    }

    await pool.query(
      `INSERT INTO activity_logs (tenant_id, user_type, user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        safeTenantId,
        userType,
        userId,
        action,
        entityType,
        entityId,
        details ? JSON.stringify(details) : null,
        ipAddress,
      ]
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};

module.exports = { logActivity, logError };
