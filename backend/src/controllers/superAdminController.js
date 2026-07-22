const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { paginate } = require('../utils/auth');
const { logActivity } = require('../utils/logger');
const { sendCompanyApprovalEmail } = require('../services/emailService');
const {
  getPlatformCommissionTotals,
  getMonthlyCommissionByTenant,
  getCommissionHistory,
  getCommissionRate,
  getCurrentPeriodMonth,
  getAllTimePlatformEarnings,
  getTenantSalesTotals,
  ensurePlatformCommissionsTable,
} = require('../services/platformCommissionService');

const getDashboard = async (req, res) => {
  try {
    await ensurePlatformCommissionsTable();
    const currentMonth = getCurrentPeriodMonth();
    const [commissionTotals, commissionHistory, allTimeSales, allTimeEarnings] = await Promise.all([
      getPlatformCommissionTotals(currentMonth),
      getCommissionHistory(6),
      getTenantSalesTotals(),
      getAllTimePlatformEarnings(),
    ]);

    const [[stats]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM tenants) AS total_companies,
        (SELECT COUNT(*) FROM cleaners) AS total_cleaners,
        (SELECT COUNT(*) FROM customers) AS total_customers,
        (SELECT COUNT(*) FROM bookings) AS total_bookings,
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

    sendSuccess(res, {
      stats: {
        ...stats,
        total_tenant_sales: allTimeSales.totalSales,
        total_platform_revenue: allTimeEarnings,
        platform_commission_this_month: commissionTotals.platformCommission,
        platform_gross_sales_this_month: commissionTotals.grossSales,
        platform_commission_rate: getCommissionRate(),
        platform_commission_period: currentMonth,
      },
      monthlyStats,
      commissionHistory,
    });
  } catch (error) {
    console.error('Super admin dashboard error:', error);
    sendError(res, 'Failed to load dashboard', 500);
  }
};

const getCompanies = async (req, res) => {
  try {
    await ensurePlatformCommissionsTable();
    const { page, limit, status, search } = req.query;
    const { offset, limit: lim, page: p } = paginate(page, limit);

    let where = '1=1';
    const params = [];
    if (status) { where += ' AND t.status = ?'; params.push(String(status).toLowerCase()); }
    if (search) {
      where += ' AND (t.full_name LIKE ? OR t.email LIKE ? OR c.company_name LIKE ? OR c.license_number LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM tenants t LEFT JOIN companies c ON t.id = c.tenant_id WHERE ${where}`,
      params
    );

    const currentMonth = getCurrentPeriodMonth();
    const [companies] = await pool.query(
      `SELECT t.*, c.company_name, c.license_number, c.logo_url, c.rating,
        (SELECT COUNT(*) FROM cleaners cl WHERE cl.tenant_id = t.id) AS cleaner_count,
        (SELECT COUNT(*) FROM bookings b WHERE b.tenant_id = t.id) AS booking_count,
        (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.tenant_id = t.id AND p.status IN ('successful', 'confirmed'))
          + (SELECT COALESCE(SUM(po.total_amount), 0) FROM product_orders po WHERE po.tenant_id = t.id AND po.status IN ('paid', 'delivered'))
          AS total_sales,
        (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
          WHERE p.tenant_id = t.id AND p.status IN ('successful', 'confirmed')
            AND to_char(COALESCE(p.confirmed_at, p.created_at), 'YYYY-MM') = ?)
          + (SELECT COALESCE(SUM(po.total_amount), 0) FROM product_orders po
          WHERE po.tenant_id = t.id AND po.status IN ('paid', 'delivered')
            AND to_char(COALESCE(po.confirmed_at, po.updated_at, po.created_at), 'YYYY-MM') = ?)
          AS monthly_sales,
        (SELECT COALESCE(SUM(pc.commission_amount), 0) FROM platform_commissions pc
          WHERE pc.tenant_id = t.id AND pc.period_month = ?) AS monthly_commission
       FROM tenants t
       LEFT JOIN companies c ON t.id = c.tenant_id
       WHERE ${where}
       ORDER BY
         CASE WHEN t.status = 'pending' THEN 0 ELSE 1 END,
         t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, currentMonth, currentMonth, currentMonth, lim, offset]
    );

    const rate = getCommissionRate();
    companies.forEach((c) => {
      const sales = parseFloat(c.monthly_sales || 0);
      const recorded = parseFloat(c.monthly_commission || 0);
      if (sales > 0 && recorded <= 0) {
        c.monthly_commission = Math.round(sales * rate * 100) / 100;
      }
    });

    sendPaginated(res, companies, { page: p, limit: lim, total });
  } catch (error) {
    console.error('getCompanies error:', error.message);
    sendError(res, 'Failed to fetch companies', 500);
  }
};

const updateCompanyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['approved', 'pending', 'suspended', 'rejected'];
    const nextStatus = String(status || '').toLowerCase();
    if (!allowed.includes(nextStatus)) {
      return sendError(res, 'Invalid status', 400);
    }

    const [rows] = await pool.query('SELECT id, email, full_name, status FROM tenants WHERE id = ?', [id]);
    if (!rows.length) return sendError(res, 'Company not found', 404);

    const previousStatus = String(rows[0].status || '').toLowerCase();

    await pool.query(
      `UPDATE tenants
       SET status = ?,
           admin_approval_token = CASE WHEN ? = 'approved' THEN NULL ELSE admin_approval_token END,
           admin_approval_token_expires = CASE WHEN ? = 'approved' THEN NULL ELSE admin_approval_token_expires END
       WHERE id = ?`,
      [nextStatus, nextStatus, nextStatus, id]
    );

    if (nextStatus === 'approved' && previousStatus !== 'approved') {
      const [tenant] = await pool.query(
        'SELECT t.*, c.company_name FROM tenants t LEFT JOIN companies c ON t.id = c.tenant_id WHERE t.id = ?',
        [id]
      );
      if (tenant.length) {
        const row = tenant[0];
        const emailResult = await sendCompanyApprovalEmail({
          email: row.email,
          companyName: row.company_name || row.full_name,
          contactName: row.full_name,
        });

        if (emailResult.success) {
          console.log(`[Approval Email] Sent to ${row.email} for company ${row.company_name || row.full_name}`);
        } else {
          console.error(`[Approval Email] Failed for ${row.email}:`, emailResult.error || 'unknown');
        }

        await pool.query(
          `INSERT INTO notifications (tenant_id, user_type, user_id, title, message, type)
           VALUES (?, 'tenant', ?, 'Company Approved', 'Your company has been approved! You can now log in.', 'success')`,
          [id, id]
        );

        await logActivity({
          userType: 'super_admin',
          userId: req.user.id,
          action: 'company_approved',
          entityType: 'tenant',
          entityId: parseInt(id, 10),
          ipAddress: req.ip,
        });

        const message = emailResult.success
          ? `Company approved. Confirmation email sent to ${row.email}.`
          : `Company approved, but the email to ${row.email} could not be sent. Check RESEND_API_KEY on Render.`;

        return sendSuccess(res, { emailSent: emailResult.success, tenantEmail: row.email }, message);
      }
    }

    await logActivity({
      userType: 'super_admin',
      userId: req.user.id,
      action: `company_${nextStatus}`,
      entityType: 'tenant',
      entityId: parseInt(id, 10),
      ipAddress: req.ip,
    });

    sendSuccess(res, null, `Company ${nextStatus} successfully`);
  } catch (error) {
    console.error('updateCompanyStatus error:', error.message);
    sendError(res, 'Failed to update company status', 500);
  }
};

const getCommissions = async (req, res) => {
  try {
    await ensurePlatformCommissionsTable();
    const periodMonth = req.query.month || getCurrentPeriodMonth();
    const [totals, byTenant, history] = await Promise.all([
      getPlatformCommissionTotals(periodMonth),
      getMonthlyCommissionByTenant(periodMonth),
      getCommissionHistory(12),
    ]);

    sendSuccess(res, {
      periodMonth,
      commissionRate: getCommissionRate(),
      totals,
      byTenant,
      history,
    });
  } catch (error) {
    console.error('getCommissions error:', error.message);
    sendError(res, 'Failed to load commission data', 500);
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
  getCommissions,
  updateCompanyStatus,
  deleteCompany,
  sendAnnouncement,
};
