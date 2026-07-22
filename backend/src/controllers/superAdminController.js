const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { paginate } = require('../utils/auth');
const { logActivity, logError } = require('../utils/logger');

const getDashboard = async (req, res) => {
  try {
    const [[stats]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM tenants) AS total_companies,
        (SELECT COUNT(*) FROM cleaners) AS total_cleaners,
        (SELECT COUNT(*) FROM customers) AS total_customers,
        (SELECT COUNT(*) FROM bookings) AS total_bookings,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'successful') AS total_revenue,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE bs.name = 'pending') AS pending_bookings,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE bs.name = 'completed') AS completed_bookings,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE bs.name = 'cancelled') AS cancelled_bookings,
        (SELECT COUNT(*) FROM tenants WHERE status = 'approved') AS active_companies,
        (SELECT COUNT(*) FROM tenants WHERE status = 'suspended') AS suspended_companies,
        (SELECT COUNT(*) FROM tenants WHERE status = 'pending') AS pending_companies,
        (SELECT COUNT(*) FROM tenants WHERE status = 'pending' AND email_verified = TRUE) AS pending_approval
    `);

    const [monthlyStats] = await pool.query(`
      SELECT
        COALESCE(b.month, p.month) AS month,
        COALESCE(b.bookings, 0) AS bookings,
        COALESCE(p.revenue, 0) AS revenue
      FROM (
        SELECT to_char(created_at, 'YYYY-MM') AS month, COUNT(*) AS bookings
        FROM bookings
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY 1
      ) b
      FULL OUTER JOIN (
        SELECT to_char(created_at, 'YYYY-MM') AS month, COALESCE(SUM(amount), 0) AS revenue
        FROM payments
        WHERE status = 'successful' AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY 1
      ) p ON b.month = p.month
      ORDER BY month DESC
    `);

    sendSuccess(res, { stats, monthlyStats });
  } catch (error) {
    console.error('Super admin dashboard error:', error);
    sendError(res, 'Failed to load dashboard', 500);
  }
};

const getCompanies = async (req, res) => {
  try {
    const { page, limit, status, search } = req.query;
    const { offset, limit: lim, page: p } = paginate(page, limit);

    let where = '1=1';
    const params = [];
    if (status) { where += ' AND t.status = ?'; params.push(status); }
    if (search) {
      where += ' AND (t.full_name LIKE ? OR t.email LIKE ? OR c.company_name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM tenants t LEFT JOIN companies c ON t.id = c.tenant_id WHERE ${where}`,
      params
    );

    const [companies] = await pool.query(
      `SELECT t.*, c.company_name, c.logo_url, c.rating,
        (SELECT COUNT(*) FROM cleaners cl WHERE cl.tenant_id = t.id) AS cleaner_count,
        (SELECT COUNT(*) FROM bookings b WHERE b.tenant_id = t.id) AS booking_count,
        (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.tenant_id = t.id AND p.status = 'successful') AS revenue
       FROM tenants t
       LEFT JOIN companies c ON t.id = c.tenant_id
       WHERE ${where}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, lim, offset]
    );

    sendPaginated(res, companies, { page: p, limit: lim, total });
  } catch (error) {
    logError('superAdmin.getCompanies', error);
    sendError(res, 'Failed to fetch companies', 500);
  }
};

const updateCompanyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await pool.query('UPDATE tenants SET status = ? WHERE id = ?', [status, id]);

    if (status === 'approved') {
      const [tenant] = await pool.query('SELECT t.*, c.company_name FROM tenants t LEFT JOIN companies c ON t.id = c.tenant_id WHERE t.id = ?', [id]);
      if (tenant.length) {
        const { sendNotificationEmail, emailTemplates } = require('../services/emailService');
        const config = require('../config');
        const template = emailTemplates.companyApproval(tenant[0].company_name || tenant[0].full_name);
        await sendNotificationEmail({
          to: tenant[0].email,
          ...template,
          actionUrl: `${config.frontendUrl}/login`,
        });
      }
    }

    await logActivity({
      userType: 'super_admin',
      userId: req.user.id,
      action: `company_${status}`,
      entityType: 'tenant',
      entityId: parseInt(id, 10),
      ipAddress: req.ip,
    });

    sendSuccess(res, null, `Company ${status} successfully`);
  } catch (error) {
    logError('superAdmin.updateCompanyStatus', error);
    sendError(res, 'Failed to update company status', 500);
  }
};

const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tenants WHERE id = ?', [id]);

    await logActivity({
      userType: 'super_admin',
      userId: req.user.id,
      action: 'company_deleted',
      entityType: 'tenant',
      entityId: parseInt(id, 10),
      ipAddress: req.ip,
    });

    sendSuccess(res, null, 'Company deleted successfully');
  } catch (error) {
    logError('superAdmin.deleteCompany', error);
    sendError(res, 'Failed to delete company', 500);
  }
};

const sendAnnouncement = async (req, res) => {
  try {
    const { title, message, type = 'info' } = req.body;

    const allowedTypes = new Set(['info', 'success', 'warning', 'error']);
    const notificationType = allowedTypes.has(type) ? type : 'info';
    const audience = ['super_admin', 'tenant', 'cleaner', 'customer'];

    await Promise.all(audience.map((userType) => pool.query(
      `INSERT INTO notifications (user_type, title, message, type) VALUES (?, ?, ?, ?)`,
      [userType, title, message, notificationType]
    )));

    sendSuccess(res, null, 'Announcement sent successfully');
  } catch (error) {
    console.error('Send announcement error:', error);
    sendError(res, 'Failed to send announcement', 500);
  }
};

module.exports = {
  getDashboard,
  getCompanies,
  updateCompanyStatus,
  deleteCompany,
  sendAnnouncement,
};
