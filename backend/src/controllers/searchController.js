const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { SQL_IS_ACTIVE } = require('../utils/pgCompat');

const searchCompanies = async (req, res) => {
  try {
    const { q, minRating, location } = req.query;

    let where = "t.status = 'approved'";
    const params = [];

    if (q) {
      where += ' AND (c.company_name LIKE ? OR c.description LIKE ?)';
      const s = `%${q}%`;
      params.push(s, s);
    }
    if (minRating) { where += ' AND c.rating >= ?'; params.push(parseFloat(minRating)); }
    if (location) { where += ' AND c.address LIKE ?'; params.push(`%${location}%`); }

    const [companies] = await pool.query(
      `SELECT c.*, t.email AS tenant_email,
        (SELECT COUNT(*) FROM services s WHERE s.tenant_id = c.tenant_id AND s.is_active = TRUE) AS service_count
       FROM companies c
       JOIN tenants t ON c.tenant_id = t.id
       WHERE ${where}
       ORDER BY c.rating DESC`,
      params
    );

    sendSuccess(res, companies);
  } catch (error) {
    sendError(res, 'Search failed', 500);
  }
};

const searchServices = async (req, res) => {
  try {
    const { q, minPrice, maxPrice, tenant_id } = req.query;

    let where = `s.${SQL_IS_ACTIVE} AND t.status = 'approved'`;
    const params = [];

    if (q) { where += ' AND (s.name LIKE ? OR s.description LIKE ?)'; const s = `%${q}%`; params.push(s, s); }
    if (minPrice) { where += ' AND s.price >= ?'; params.push(parseFloat(minPrice)); }
    if (maxPrice) { where += ' AND s.price <= ?'; params.push(parseFloat(maxPrice)); }
    if (tenant_id) { where += ' AND s.tenant_id = ?'; params.push(tenant_id); }

    const [services] = await pool.query(
      `SELECT s.*, c.company_name, c.rating AS company_rating, c.logo_url
       FROM services s
       JOIN companies c ON s.tenant_id = c.tenant_id
       JOIN tenants t ON t.id = s.tenant_id
       WHERE ${where}
       ORDER BY s.created_at DESC`,
      params
    );

    sendSuccess(res, services);
  } catch (error) {
    sendError(res, 'Search failed', 500);
  }
};

/** Home page / guest catalog — newest services from approved companies. */
const listPublicServices = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const [services] = await pool.query(
      `SELECT s.*, c.company_name, c.rating AS company_rating, c.logo_url
       FROM services s
       JOIN companies c ON s.tenant_id = c.tenant_id
       JOIN tenants t ON t.id = s.tenant_id
       WHERE s.${SQL_IS_ACTIVE} AND t.status = 'approved'
       ORDER BY s.created_at DESC
       LIMIT ?`,
      [limit]
    );
    sendSuccess(res, services);
  } catch (error) {
    console.error('listPublicServices error:', error.message);
    sendError(res, 'Failed to load services', 500);
  }
};

const getCustomerDashboard = async (req, res) => {
  try {
    const customerId = req.user.id;

    const [[stats]] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE b.customer_id = ? AND bs.name NOT IN ('completed', 'cancelled')) AS upcoming,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE b.customer_id = ? AND bs.name = 'completed') AS completed,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE b.customer_id = ? AND bs.name = 'cancelled') AS cancelled,
        (SELECT COUNT(*) FROM payments WHERE customer_id = ?) AS total_payments`,
      [customerId, customerId, customerId, customerId]
    );

    const [upcomingBookings] = await pool.query(
      `SELECT b.*, bs.name AS status, s.name AS service_name, co.company_name,
        (SELECT CASE WHEN p.status = 'successful' THEN 'confirmed' ELSE p.status END FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status
       FROM bookings b
       JOIN booking_status bs ON b.status_id = bs.id
       JOIN services s ON b.service_id = s.id
       JOIN companies co ON b.tenant_id = co.tenant_id
       WHERE b.customer_id = ? AND bs.name NOT IN ('completed', 'cancelled', 'rejected')
       ORDER BY b.created_at DESC, b.id DESC LIMIT 10`,
      [customerId]
    );

    sendSuccess(res, { stats, upcomingBookings });
  } catch (error) {
    console.error('getCustomerDashboard error:', error.message);
    sendError(res, 'Failed to load dashboard', 500);
  }
};

const getCleanerDashboard = async (req, res) => {
  try {
    const cleanerId = req.user.id;

    const [[stats]] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM cleaner_assignments WHERE cleaner_id = ? AND status = 'assigned') AS assigned,
        (SELECT COUNT(*) FROM cleaner_assignments WHERE cleaner_id = ? AND status IN ('assigned', 'accepted')) AS pending,
        (SELECT COUNT(*) FROM cleaner_assignments WHERE cleaner_id = ? AND status = 'completed') AS completed,
        (SELECT COUNT(*) FROM cleaner_assignments WHERE cleaner_id = ? AND status = 'rejected') AS cancelled,
        (SELECT performance_rating FROM cleaners WHERE id = ?) AS rating`,
      [cleanerId, cleanerId, cleanerId, cleanerId, cleanerId]
    );

    sendSuccess(res, stats);
  } catch (error) {
    sendError(res, 'Failed to load dashboard', 500);
  }
};

module.exports = {
  searchCompanies,
  searchServices,
  listPublicServices,
  getCustomerDashboard,
  getCleanerDashboard,
};
