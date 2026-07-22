const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { sendSuccess, sendError } = require('../utils/response');
const { DB_CONFIRMED, PENDING_OR_CONFIRMED_DB } = require('../utils/paymentStatus');
const {
  createDirectCharge,
  verifyCharge,
  verifyWebhookSignature,
  isSuccessfulCharge,
  isConfigured,
} = require('../services/flutterwaveService');
const {
  recordBookingPaymentCommission,
  recordProductOrderGroupCommissions,
} = require('../services/platformCommissionService');

const confirmBookingPayment = async (paymentId, chargeId, transactionRef) => {
  const [existing] = await pool.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!existing.length) return { ok: false, reason: 'payment_not_found' };
  if (existing[0].status === DB_CONFIRMED) return { ok: true, already: true };

  await pool.query(
    `UPDATE payments
     SET status = ?, confirmed_at = NOW(), transaction_ref = ?, flw_charge_id = ?
     WHERE id = ?`,
    [DB_CONFIRMED, transactionRef, chargeId, paymentId]
  );

  const invoiceNumber = `INV-${Date.now()}`;
  await pool.query(
    `INSERT INTO invoices (tenant_id, booking_id, payment_id, invoice_number, amount, status, issued_at)
     VALUES (?, ?, ?, ?, ?, 'paid', NOW())`,
    [existing[0].tenant_id, existing[0].booking_id, paymentId, invoiceNumber, existing[0].amount]
  );

  await recordBookingPaymentCommission({
    ...existing[0],
    id: paymentId,
    confirmed_at: new Date(),
  });

  return { ok: true };
};

const confirmProductOrders = async (orderGroupId, chargeId, transactionRef) => {
  const [orders] = await pool.query(
    'SELECT * FROM product_orders WHERE order_group_id = ?',
    [orderGroupId]
  );
  if (!orders.length) return { ok: false, reason: 'orders_not_found' };

  const allPaid = orders.every((o) => o.status === 'paid' || o.status === 'delivered');
  if (allPaid) return { ok: true, already: true };

  await pool.query(
    `UPDATE product_orders
     SET status = 'paid', confirmed_at = NOW(), transaction_ref = ?, flw_charge_id = ?
     WHERE order_group_id = ? AND status IN ('payment_pending', 'placed')`,
    [transactionRef, chargeId, orderGroupId]
  );

  await recordProductOrderGroupCommissions(orderGroupId);

  return { ok: true };
};

const processSuccessfulCharge = async (charge) => {
  const reference = charge.reference;
  const meta = charge.meta || {};

  if (meta.entity_type === 'booking' && meta.payment_id) {
    return confirmBookingPayment(parseInt(meta.payment_id, 10), charge.id, reference);
  }
  if (meta.entity_type === 'product_order' && meta.order_group_id) {
    return confirmProductOrders(meta.order_group_id, charge.id, reference);
  }

  const [payments] = await pool.query(
    'SELECT id FROM payments WHERE transaction_ref = ? OR flw_charge_id = ? LIMIT 1',
    [reference, charge.id]
  );
  if (payments.length) {
    return confirmBookingPayment(payments[0].id, charge.id, reference);
  }

  const [orders] = await pool.query(
    'SELECT order_group_id FROM product_orders WHERE transaction_ref = ? OR flw_charge_id = ? LIMIT 1',
    [reference, charge.id]
  );
  if (orders.length) {
    return confirmProductOrders(orders[0].order_group_id, charge.id, reference);
  }

  return { ok: false, reason: 'unknown_reference' };
};

const initiateBookingPayment = async (req, res) => {
  try {
    if (!isConfigured()) {
      return sendError(res, 'Flutterwave is not configured on the server', 503);
    }

    const { booking_id, phone, network, contact_email } = req.body;
    const customerId = req.user.id;

    const [bookingRows] = await pool.query(
      `SELECT b.*, bs.name AS status, c.full_name, c.email
       FROM bookings b
       JOIN booking_status bs ON b.status_id = bs.id
       JOIN customers c ON b.customer_id = c.id
       WHERE b.id = ? AND b.customer_id = ?`,
      [booking_id, customerId]
    );
    if (!bookingRows.length) return sendError(res, 'Booking not found', 404);

    const booking = bookingRows[0];
    if (['cancelled', 'rejected', 'completed'].includes(booking.status)) {
      return sendError(res, 'Cannot pay for this booking', 400);
    }

    const [existing] = await pool.query(
      `SELECT id, status, payment_method FROM payments WHERE booking_id = ? AND status IN ${PENDING_OR_CONFIRMED_DB}`,
      [booking_id]
    );
    if (existing.length) {
      if (existing[0].status === DB_CONFIRMED) {
        return sendError(res, 'This booking has already been paid', 409);
      }
      if (existing[0].payment_method === 'flutterwave') {
        await pool.query('DELETE FROM payments WHERE id = ? AND status = ?', [existing[0].id, 'pending']);
      } else {
        return sendError(res, 'A payment is already pending for this booking', 409);
      }
    }

    const customerEmail = (contact_email || booking.email || '').trim();
    if (!customerEmail) {
      return sendError(res, 'Email is required for payment', 400);
    }
    if (!phone) {
      return sendError(res, 'Phone number is required for Flutterwave payment', 400);
    }

    const [result] = await pool.query(
      `INSERT INTO payments (tenant_id, booking_id, customer_id, amount, payment_method, transaction_ref, status)
       VALUES (?, ?, ?, ?, 'flutterwave', 'pending', 'pending')`,
      [booking.tenant_id, booking_id, customerId, booking.total_amount]
    );

    const paymentId = result.insertId;
    const reference = uuidv4();

    await pool.query('UPDATE payments SET transaction_ref = ? WHERE id = ?', [reference, paymentId]);

    let flwResponse;
    try {
      flwResponse = await createDirectCharge({
        amount: booking.total_amount,
        reference,
        customerEmail,
        customerName: booking.full_name,
        phone,
        network,
        meta: {
          entity_type: 'booking',
          booking_id: String(booking_id),
          payment_id: String(paymentId),
        },
      });
    } catch (flwError) {
      await pool.query(`UPDATE payments SET status = 'failed' WHERE id = ?`, [paymentId]);
      throw flwError;
    }

    const charge = flwResponse.data;
    await pool.query('UPDATE payments SET flw_charge_id = ? WHERE id = ?', [charge.id, paymentId]);

    sendSuccess(res, {
      payment_id: paymentId,
      reference,
      charge_id: charge.id,
      status: charge.status,
      next_action: charge.next_action || null,
    }, 'Flutterwave payment initiated', 201);
  } catch (error) {
    console.error('initiateBookingPayment error:', error.message);
    sendError(res, error.message || 'Failed to initiate Flutterwave payment', 500);
  }
};

const initiateProductOrderPayment = async (req, res) => {
  try {
    if (!isConfigured()) {
      return sendError(res, 'Flutterwave is not configured on the server', 503);
    }

    const { order_group_id, phone, network, contact_email } = req.body;
    const customerId = req.user.id;

    const [orders] = await pool.query(
      `SELECT o.*, c.full_name, c.email
       FROM product_orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.order_group_id = ? AND o.customer_id = ?`,
      [order_group_id, customerId]
    );
    if (!orders.length) return sendError(res, 'Order not found', 404);

    const customerEmail = (contact_email || orders[0].email || '').trim();
    if (!customerEmail) {
      return sendError(res, 'Email is required for payment', 400);
    }
    if (!phone) {
      return sendError(res, 'Phone number is required for Flutterwave payment', 400);
    }

    const totalAmount = orders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
    const reference = uuidv4();

    await pool.query(
      'UPDATE product_orders SET transaction_ref = ? WHERE order_group_id = ?',
      [reference, order_group_id]
    );

    let flwResponse;
    try {
      flwResponse = await createDirectCharge({
        amount: totalAmount,
        reference,
        customerEmail,
        customerName: orders[0].full_name,
        phone,
        network,
        meta: {
          entity_type: 'product_order',
          order_group_id: String(order_group_id),
        },
      });
    } catch (chargeError) {
      // Restock and cancel so the customer can retry cleanly
      for (const order of orders) {
        if (order.product_id && order.quantity) {
          await pool.query(
            'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
            [order.quantity, order.product_id]
          );
        }
      }
      await pool.query(
        `UPDATE product_orders SET status = 'cancelled', transaction_ref = ? WHERE order_group_id = ?`,
        [reference, order_group_id]
      );
      throw chargeError;
    }

    const charge = flwResponse.data;
    await pool.query(
      'UPDATE product_orders SET flw_charge_id = ? WHERE order_group_id = ?',
      [charge.id, order_group_id]
    );

    sendSuccess(res, {
      order_group_id,
      reference,
      charge_id: charge.id,
      status: charge.status,
      next_action: charge.next_action || null,
      total_amount: totalAmount,
    }, 'Flutterwave payment initiated', 201);
  } catch (error) {
    console.error('initiateProductOrderPayment error:', error.message);
    sendError(res, error.message || 'Failed to initiate Flutterwave payment', 500);
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { ref } = req.params;
    if (!ref) return sendError(res, 'Payment reference is required', 400);

    let chargeId = null;

    const [paymentRows] = await pool.query(
      'SELECT id, flw_charge_id, status FROM payments WHERE transaction_ref = ? LIMIT 1',
      [ref]
    );
    if (paymentRows.length) {
      chargeId = paymentRows[0].flw_charge_id;
      if (paymentRows[0].status === DB_CONFIRMED) {
        return sendSuccess(res, { reference: ref, status: 'successful', confirmed: true });
      }
    }

    if (!chargeId) {
      const [orderRows] = await pool.query(
        'SELECT flw_charge_id, status FROM product_orders WHERE transaction_ref = ? LIMIT 1',
        [ref]
      );
      if (orderRows.length) {
        chargeId = orderRows[0].flw_charge_id;
        if (orderRows[0].status === 'paid' || orderRows[0].status === 'delivered') {
          return sendSuccess(res, { reference: ref, status: 'successful', confirmed: true });
        }
      }
    }

    if (!chargeId) {
      return sendError(res, 'Payment not found or not initiated yet', 404);
    }

    let charge;
    try {
      const verified = await verifyCharge(chargeId);
      charge = verified.data;
    } catch {
      return sendError(res, 'Unable to verify payment', 502);
    }

    if (isSuccessfulCharge(charge)) {
      await processSuccessfulCharge(charge);
    }

    sendSuccess(res, {
      reference: ref,
      status: charge.status,
      amount: charge.amount,
      currency: charge.currency,
      confirmed: isSuccessfulCharge(charge),
    });
  } catch (error) {
    console.error('verifyPayment error:', error.message);
    sendError(res, 'Failed to verify payment', 500);
  }
};

const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['flutterwave-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const payload = req.body;
    if (payload?.type !== 'charge.completed') {
      return res.status(200).json({ success: true, message: 'Ignored' });
    }

    const charge = payload.data;
    if (!charge?.id) {
      return res.status(200).json({ success: true, message: 'No charge data' });
    }

    let verifiedCharge = charge;
    try {
      const verified = await verifyCharge(charge.id);
      verifiedCharge = verified.data || charge;
    } catch (err) {
      console.error('Webhook charge verify failed:', err.message);
    }

    if (!isSuccessfulCharge(verifiedCharge)) {
      return res.status(200).json({ success: true, message: 'Charge not successful' });
    }

    await processSuccessfulCharge(verifiedCharge);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('handleWebhook error:', error.message);
    return res.status(200).json({ success: true });
  }
};

module.exports = {
  initiateBookingPayment,
  initiateProductOrderPayment,
  verifyPayment,
  handleWebhook,
  processSuccessfulCharge,
};
