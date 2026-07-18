const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { paginate } = require('../utils/auth');
const { logActivity } = require('../utils/logger');
const { storeUploadedFile } = require('../services/storageService');

const getDashboard = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const [[stats]] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE b.tenant_id = ? AND b.scheduled_date = CURRENT_DATE) AS todays_jobs,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE b.tenant_id = ? AND bs.name = 'pending') AS pending_jobs,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE b.tenant_id = ? AND bs.name = 'completed') AS completed_jobs,
        (SELECT COUNT(*) FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE b.tenant_id = ? AND bs.name = 'cancelled') AS cancelled_jobs,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE tenant_id = ? AND status IN ('successful', 'confirmed') AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW()) AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())) AS monthly_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE tenant_id = ? AND status IN ('successful', 'confirmed') AND DATE(created_at) = CURRENT_DATE) AS todays_revenue,
        (SELECT COUNT(DISTINCT customer_id) FROM bookings WHERE tenant_id = ?) AS total_customers,
        (SELECT COUNT(*) FROM cleaners WHERE tenant_id = ? AND status = 'active') AS total_cleaners`,
      Array(8).fill(tenantId)
    );

    const [companyRows] = await pool.query(
      `SELECT c.company_name, c.address, c.latitude, c.longitude, c.rating, c.total_reviews,
              COALESCE(c.email, t.email) AS email
       FROM tenants t
       LEFT JOIN companies c ON c.tenant_id = t.id
       WHERE t.id = ?`,
      [tenantId]
    );

    const [recentReviews] = await pool.query(
      `SELECT r.id, r.company_rating, r.cleaner_rating, r.comment, r.created_at, r.tenant_reply,
              c.full_name AS customer_name
       FROM reviews r
       JOIN customers c ON r.customer_id = c.id
       WHERE r.tenant_id = ? AND r.is_visible = TRUE
       ORDER BY r.created_at DESC LIMIT 5`,
      [tenantId]
    );

    sendSuccess(res, {
      ...stats,
      company: companyRows[0] || null,
      recentReviews,
    });
  } catch (error) {
    sendError(res, 'Failed to load dashboard', 500);
  }
};

const getCompanyProfile = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM companies WHERE tenant_id = ?', [req.tenantId]);
    sendSuccess(res, rows[0] || null);
  } catch (error) {
    sendError(res, 'Failed to fetch company profile', 500);
  }
};

const updateCompanyProfile = async (req, res) => {
  try {
    const { company_name, address, phone, email, working_hours, license_number, description, latitude, longitude } = req.body;
    const logo_url = req.file ? `/uploads/logos/${req.file.filename}` : undefined;

    if (!email || !String(email).trim()) {
      return sendError(res, 'Company email is required for notifications and customer contact', 400);
    }

    const [existing] = await pool.query('SELECT id FROM companies WHERE tenant_id = ?', [req.tenantId]);

    if (existing.length) {
      const updates = [];
      const params = [];
      if (company_name) { updates.push('company_name = ?'); params.push(company_name); }
      if (address !== undefined) { updates.push('address = ?'); params.push(address); }
      if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
      if (email !== undefined) { updates.push('email = ?'); params.push(email); }
      if (working_hours) { updates.push('working_hours = ?'); params.push(JSON.stringify(working_hours)); }
      if (license_number !== undefined) { updates.push('license_number = ?'); params.push(license_number); }
      if (description !== undefined) { updates.push('description = ?'); params.push(description); }
      if (latitude !== undefined && latitude !== '') { updates.push('latitude = ?'); params.push(latitude); }
      if (longitude !== undefined && longitude !== '') { updates.push('longitude = ?'); params.push(longitude); }
      if (logo_url) { updates.push('logo_url = ?'); params.push(logo_url); }

      if (updates.length) {
        params.push(req.tenantId);
        await pool.query(`UPDATE companies SET ${updates.join(', ')} WHERE tenant_id = ?`, params);
      }
    } else {
      await pool.query(
        `INSERT INTO companies (tenant_id, company_name, address, phone, email, working_hours, license_number, description, logo_url, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.tenantId, company_name, address, phone, email, JSON.stringify(working_hours), license_number, description, logo_url, latitude || null, longitude || null]
      );
    }

    sendSuccess(res, null, 'Company profile updated');
  } catch (error) {
    sendError(res, 'Failed to update company profile', 500);
  }
};

// Services
const getServices = async (req, res) => {
  try {
    const [services] = await pool.query('SELECT * FROM services WHERE tenant_id = ? ORDER BY created_at DESC', [req.tenantId]);
    sendSuccess(res, services);
  } catch (error) {
    sendError(res, 'Failed to fetch services', 500);
  }
};

const createService = async (req, res) => {
  try {
    const { name, description, price, duration_minutes } = req.body;
    const image_url = req.file ? await storeUploadedFile(req.file, 'services') : null;

    const [result] = await pool.query(
      `INSERT INTO services (tenant_id, name, description, price, duration_minutes, image_url) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.tenantId, name, description, price, duration_minutes || 60, image_url]
    );

    sendSuccess(res, { id: result.insertId }, 'Service created', 201);
  } catch (error) {
    sendError(res, 'Failed to create service', 500);
  }
};

const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration_minutes, is_active } = req.body;
    const image_url = req.file ? await storeUploadedFile(req.file, 'services') : undefined;

    const updates = [];
    const params = [];
    if (name) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (price) { updates.push('price = ?'); params.push(price); }
    if (duration_minutes) { updates.push('duration_minutes = ?'); params.push(duration_minutes); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }
    if (image_url) { updates.push('image_url = ?'); params.push(image_url); }

    params.push(id, req.tenantId);
    await pool.query(`UPDATE services SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params);

    sendSuccess(res, null, 'Service updated');
  } catch (error) {
    sendError(res, 'Failed to update service', 500);
  }
};

const deleteService = async (req, res) => {
  try {
    await pool.query('DELETE FROM services WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
    sendSuccess(res, null, 'Service deleted');
  } catch (error) {
    sendError(res, 'Failed to delete service', 500);
  }
};

const getCustomers = async (req, res) => {
  try {
    const [customers] = await pool.query(
      `SELECT c.id, c.full_name, c.email, c.phone, c.is_blacklisted,
        COUNT(b.id) AS total_bookings,
        COALESCE(SUM(CASE WHEN p.status = 'successful' THEN p.amount ELSE 0 END), 0) AS total_spent
       FROM customers c
       JOIN bookings b ON b.customer_id = c.id AND b.tenant_id = ?
       LEFT JOIN payments p ON p.booking_id = b.id
       GROUP BY c.id
       ORDER BY total_bookings DESC`,
      [req.tenantId]
    );
    sendSuccess(res, customers);
  } catch (error) {
    sendError(res, 'Failed to fetch customers', 500);
  }
};

const toggleCustomerBlacklist = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_blacklisted, blacklist_reason } = req.body;

    const [customer] = await pool.query(
      `SELECT c.id FROM customers c
       JOIN bookings b ON b.customer_id = c.id
       WHERE c.id = ? AND b.tenant_id = ?
       LIMIT 1`,
      [id, req.tenantId]
    );
    if (!customer.length) return sendError(res, 'Customer not found', 404);

    await pool.query(
      'UPDATE customers SET is_blacklisted = ?, blacklist_reason = ? WHERE id = ?',
      [is_blacklisted, blacklist_reason || null, id]
    );

    sendSuccess(res, null, is_blacklisted ? 'Customer blacklisted' : 'Customer removed from blacklist');
  } catch (error) {
    sendError(res, 'Failed to update customer', 500);
  }
};

module.exports = {
  getDashboard,
  getCompanyProfile,
  updateCompanyProfile,
  getServices,
  createService,
  updateService,
  deleteService,
  getCustomers,
  toggleCustomerBlacklist,
};
