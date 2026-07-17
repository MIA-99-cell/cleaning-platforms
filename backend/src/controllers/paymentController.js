const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const {
  DB_CONFIRMED,
  isConfirmedStatus,
  normalizePayments,
  PENDING_OR_CONFIRMED_DB,
} = require('../utils/paymentStatus');

const getPayments = async (req, res) => {
  try {
    const [payments] = await pool.query(
      `SELECT p.*, b.scheduled_date, c.full_name AS customer_name, s.name AS service_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN customers c ON p.customer_id = c.id
       JOIN services s ON b.service_id = s.id
       WHERE p.tenant_id = ?
       ORDER BY p.created_at DESC`,
      [req.tenantId]
    );
    sendSuccess(res, normalizePayments(payments));
  } catch (error) {
    console.error('Get payments error:', error.message);
    sendError(res, 'Failed to fetch payments', 500);
  }
};

const createPayment = async (req, res) => {
  try {
    const { booking_id, payment_method, transaction_ref } = req.body;
    const customerId = req.user.id;

    const [booking] = await pool.query(
      `SELECT b.*, bs.name AS status FROM bookings b
       JOIN booking_status bs ON b.status_id = bs.id
       WHERE b.id = ? AND b.customer_id = ?`,
      [booking_id, customerId]
    );
    if (!booking.length) return sendError(res, 'Booking not found', 404);

    const b = booking[0];
    if (['cancelled', 'rejected', 'completed'].includes(b.status)) {
      return sendError(res, 'Cannot pay for this booking', 400);
    }

    const [existing] = await pool.query(
      `SELECT id, status FROM payments WHERE booking_id = ? AND status IN ${PENDING_OR_CONFIRMED_DB}`,
      [booking_id]
    );
    if (existing.length) {
      const msg = existing[0].status === DB_CONFIRMED
        ? 'This booking has already been paid'
        : 'A payment is already pending for this booking';
      return sendError(res, msg, 409);
    }

    const validMethods = ['mobile_money', 'card', 'cash', 'bank_transfer', 'flutterwave'];
    if (!validMethods.includes(payment_method)) {
      return sendError(res, 'Invalid payment method', 400);
    }

    const [result] = await pool.query(
      `INSERT INTO payments (tenant_id, booking_id, customer_id, amount, payment_method, transaction_ref, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [b.tenant_id, booking_id, customerId, b.total_amount, payment_method, transaction_ref || `TXN-${Date.now()}`]
    );

    sendSuccess(res, { id: result.insertId }, 'Payment submitted', 201);
  } catch (error) {
    console.error('Create payment error:', error.message);
    sendError(res, 'Failed to create payment', 500);
  }
};

const confirmPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT * FROM payments WHERE id = ? AND tenant_id = ?',
      [id, req.tenantId]
    );
    if (!existing.length) return sendError(res, 'Payment not found', 404);
    if (existing[0].status === DB_CONFIRMED || existing[0].status === 'confirmed') {
      return sendSuccess(res, null, 'Payment already confirmed');
    }
    if (existing[0].status !== 'pending') {
      return sendError(res, `Cannot confirm payment with status: ${existing[0].status}`, 400);
    }

    await pool.query(
      `UPDATE payments SET status = ?, confirmed_at = NOW(), confirmed_by = ? WHERE id = ? AND tenant_id = ?`,
      [DB_CONFIRMED, String(req.user.id), id, req.tenantId]
    );

    const invoiceNumber = `INV-${Date.now()}`;
    await pool.query(
      `INSERT INTO invoices (tenant_id, booking_id, payment_id, invoice_number, amount, status, issued_at)
       VALUES (?, ?, ?, ?, ?, 'paid', NOW())`,
      [req.tenantId, existing[0].booking_id, id, invoiceNumber, existing[0].amount]
    );

    sendSuccess(res, null, 'Payment confirmed');
  } catch (error) {
    console.error('Confirm payment error:', error.message);
    sendError(res, 'Failed to confirm payment', 500);
  }
};

const getCustomerPayments = async (req, res) => {
  try {
    const [payments] = await pool.query(
      `SELECT p.*, b.scheduled_date, s.name AS service_name, co.company_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN services s ON b.service_id = s.id
       JOIN companies co ON b.tenant_id = co.tenant_id
       WHERE p.customer_id = ?
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    sendSuccess(res, normalizePayments(payments));
  } catch (error) {
    console.error('Get customer payments error:', error.message);
    sendError(res, 'Failed to fetch payments', 500);
  }
};

module.exports = { getPayments, createPayment, confirmPayment, getCustomerPayments };
