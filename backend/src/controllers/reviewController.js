const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { notifyTenantNewReview } = require('../services/productOrderNotificationService');

const createReview = async (req, res) => {
  try {
    const { booking_id, company_rating, cleaner_rating, comment } = req.body;
    const customerId = req.user.id;

    const [booking] = await pool.query(
      `SELECT b.*, bs.name AS status FROM bookings b
       JOIN booking_status bs ON b.status_id = bs.id
       WHERE b.id = ? AND b.customer_id = ?`,
      [booking_id, customerId]
    );
    if (!booking.length) return sendError(res, 'Booking not found', 404);
    if (booking[0].status !== 'completed') return sendError(res, 'Only completed bookings can be reviewed', 400);

    const [existing] = await pool.query('SELECT id FROM reviews WHERE booking_id = ?', [booking_id]);
    if (existing.length) return sendError(res, 'Review already submitted', 409);

    const [assignment] = await pool.query(
      'SELECT cleaner_id FROM cleaner_assignments WHERE booking_id = ? LIMIT 1',
      [booking_id]
    );

    await pool.query(
      `INSERT INTO reviews (tenant_id, booking_id, customer_id, cleaner_id, company_rating, cleaner_rating, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [booking[0].tenant_id, booking_id, customerId, assignment[0]?.cleaner_id, company_rating, cleaner_rating, comment]
    );

    await pool.query(
      `UPDATE companies SET rating = (
        SELECT AVG(company_rating) FROM reviews WHERE tenant_id = ?
      ), total_reviews = total_reviews + 1 WHERE tenant_id = ?`,
      [booking[0].tenant_id, booking[0].tenant_id]
    );

    const [customerRows] = await pool.query('SELECT full_name FROM customers WHERE id = ?', [customerId]);
    notifyTenantNewReview({
      tenantId: booking[0].tenant_id,
      customerName: customerRows[0]?.full_name || 'Customer',
      companyRating: company_rating,
      cleanerRating: cleaner_rating,
      comment,
    }).catch((err) => console.error('[Review Email]', err.message));

    sendSuccess(res, null, 'Review submitted', 201);
  } catch (error) {
    sendError(res, 'Failed to submit review', 500);
  }
};

const getReviews = async (req, res) => {
  try {
    const [reviews] = await pool.query(
      `SELECT r.*, c.full_name AS customer_name, cl.full_name AS cleaner_name
       FROM reviews r
       JOIN customers c ON r.customer_id = c.id
       LEFT JOIN cleaners cl ON r.cleaner_id = cl.id
       WHERE r.tenant_id = ? AND r.is_visible = TRUE
       ORDER BY r.created_at DESC`,
      [req.tenantId]
    );
    sendSuccess(res, reviews);
  } catch (error) {
    sendError(res, 'Failed to fetch reviews', 500);
  }
};

const replyToReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;

    await pool.query(
      'UPDATE reviews SET tenant_reply = ? WHERE id = ? AND tenant_id = ?',
      [reply, id, req.tenantId]
    );

    sendSuccess(res, null, 'Reply added');
  } catch (error) {
    sendError(res, 'Failed to reply', 500);
  }
};

const deleteReview = async (req, res) => {
  try {
    await pool.query('UPDATE reviews SET is_visible = FALSE WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
    sendSuccess(res, null, 'Review hidden');
  } catch (error) {
    sendError(res, 'Failed to delete review', 500);
  }
};

module.exports = { createReview, getReviews, replyToReview, deleteReview };
