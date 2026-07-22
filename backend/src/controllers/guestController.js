const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { findOrCreateGuestCustomer } = require('../utils/guestCustomer');
const { notifyServiceBookingPlaced } = require('../services/bookingNotificationService');
const { placeOrdersForTenant } = require('./productOrderController');
const { PENDING_OR_CONFIRMED_DB, DB_CONFIRMED } = require('../utils/paymentStatus');
const {
  createDirectCharge,
  isConfigured: isFlutterwaveConfigured,
} = require('../services/flutterwaveService');

const loadProduct = async (productId) => {
  const [rows] = await pool.query(
    `SELECT p.*, c.company_name FROM products p
     JOIN companies c ON p.tenant_id = c.tenant_id
     WHERE p.id = ? AND p.is_active = TRUE`,
    [productId]
  );
  return rows[0] || null;
};

const createGuestBooking = async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      service_id,
      scheduled_date,
      scheduled_time,
      address,
      special_instructions,
    } = req.body;

    const customerId = await findOrCreateGuestCustomer({
      full_name,
      email,
      phone,
      address,
    });

    const [service] = await pool.query(
      'SELECT s.*, c.tenant_id FROM services s JOIN companies c ON s.tenant_id = c.tenant_id WHERE s.id = ? AND s.is_active = TRUE',
      [service_id]
    );
    if (!service.length) return sendError(res, 'Service not found', 404);

    const [pendingStatus] = await pool.query("SELECT id FROM booking_status WHERE name = 'pending'");

    const [result] = await pool.query(
      `INSERT INTO bookings (tenant_id, customer_id, service_id, status_id, scheduled_date, scheduled_time, address, special_instructions, total_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [service[0].tenant_id, customerId, service_id, pendingStatus[0].id, scheduled_date, scheduled_time, address, special_instructions, service[0].price]
    );

    await pool.query(
      `INSERT INTO notifications (tenant_id, user_type, user_id, title, message, type)
       VALUES (?, 'tenant', ?, 'New Booking', 'A new booking has been received', 'info')`,
      [service[0].tenant_id, service[0].tenant_id]
    );

    notifyServiceBookingPlaced({
      tenantId: service[0].tenant_id,
      customerId,
      bookingId: result.insertId,
      serviceName: service[0].name,
      scheduledDate: scheduled_date,
      scheduledTime: scheduled_time,
      address,
      totalAmount: service[0].price,
      specialInstructions: special_instructions,
    }).catch((err) => {
      console.error('[Booking Notify] Failed:', err.message);
    });

    sendSuccess(res, {
      id: result.insertId,
      customer_email: email,
    }, 'Booking created successfully', 201);
  } catch (error) {
    console.error('createGuestBooking error:', error.message);
    sendError(res, error.message || 'Failed to create booking', 500);
  }
};

const createGuestPayment = async (req, res) => {
  try {
    const { booking_id, email, payment_method, transaction_ref } = req.body;
    const customerEmail = String(email || '').trim().toLowerCase();
    if (!customerEmail) return sendError(res, 'Email is required', 400);

    const [customer] = await pool.query('SELECT id FROM customers WHERE LOWER(email) = ?', [customerEmail]);
    if (!customer.length) return sendError(res, 'Booking not found', 404);
    const customerId = customer[0].id;

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
    console.error('createGuestPayment error:', error.message);
    sendError(res, 'Failed to create payment', 500);
  }
};

const initiateGuestBookingFlutterwave = async (req, res) => {
  try {
    if (!isFlutterwaveConfigured()) {
      return sendError(res, 'Flutterwave is not configured on the server', 503);
    }

    const { booking_id, email, phone, network, contact_email } = req.body;
    const customerEmail = String(contact_email || email || '').trim().toLowerCase();
    if (!customerEmail) return sendError(res, 'Email is required for payment', 400);
    if (!phone) return sendError(res, 'Phone number is required for Flutterwave payment', 400);

    const [customer] = await pool.query('SELECT id FROM customers WHERE LOWER(email) = ?', [customerEmail]);
    if (!customer.length) return sendError(res, 'Booking not found', 404);
    const customerId = customer[0].id;

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
    console.error('initiateGuestBookingFlutterwave error:', error.message);
    sendError(res, error.message || 'Failed to initiate Flutterwave payment', 500);
  }
};

const createGuestCartOrders = async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      items,
      payment_method,
      delivery_address,
      delivery_phone,
      contact_email,
      transaction_ref,
      notes,
    } = req.body;

    const customerId = await findOrCreateGuestCustomer({
      full_name,
      email: contact_email || email,
      phone: delivery_phone || phone,
      address: delivery_address,
    });

    const customerEmail = String(contact_email || email || '').trim();
    if (!customerEmail) return sendError(res, 'Email is required for order confirmation', 400);

    if (!Array.isArray(items) || !items.length) {
      return sendError(res, 'Cart is empty', 400);
    }

    const validMethods = ['cash_on_delivery', 'mobile_money', 'flutterwave'];
    if (!validMethods.includes(payment_method)) {
      return sendError(res, 'Invalid payment method', 400);
    }
    if (payment_method === 'flutterwave' && !delivery_phone) {
      return sendError(res, 'Phone number is required for Flutterwave payment', 400);
    }

    const grouped = items.reduce((acc, item) => {
      const pid = parseInt(item.product_id, 10);
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      if (!acc[pid]) acc[pid] = { product_id: pid, quantity: 0 };
      acc[pid].quantity += qty;
      return acc;
    }, {});

    const mergedItems = Object.values(grouped);
    const productsByTenant = {};

    for (const item of mergedItems) {
      const product = await loadProduct(item.product_id);
      if (!product) return sendError(res, `Product ${item.product_id} not found`, 404);
      if (!productsByTenant[product.tenant_id]) productsByTenant[product.tenant_id] = [];
      productsByTenant[product.tenant_id].push(item);
    }

    const orderGroupId = uuidv4();
    const allOrders = [];
    let grandTotal = 0;

    for (const [tenantId, tenantItems] of Object.entries(productsByTenant)) {
      const result = await placeOrdersForTenant({
        tenantId: parseInt(tenantId, 10),
        customerId,
        items: tenantItems,
        paymentMethod: payment_method,
        deliveryAddress: delivery_address,
        deliveryPhone: delivery_phone,
        transactionRef: transaction_ref,
        notes,
        orderGroupId,
      });
      allOrders.push(...result.orders);
      grandTotal += result.total_amount;
    }

    sendSuccess(res, {
      order_group_id: orderGroupId,
      orders: allOrders,
      total_amount: grandTotal,
      payment_method,
      customer_email: customerEmail,
      status: payment_method === 'mobile_money' || payment_method === 'flutterwave'
        ? 'payment_pending'
        : 'placed',
      transaction_ref: transaction_ref || (
        payment_method === 'mobile_money' || payment_method === 'flutterwave'
          ? `MOMO-${Date.now()}`
          : null
      ),
    }, 'Cart order placed successfully', 201);
  } catch (error) {
    console.error('createGuestCartOrders error:', error.message);
    sendError(res, error.message || 'Failed to place cart order', 500);
  }
};

const initiateGuestProductOrderFlutterwave = async (req, res) => {
  try {
    if (!isFlutterwaveConfigured()) {
      return sendError(res, 'Flutterwave is not configured on the server', 503);
    }

    const { order_group_id, email, phone, network, contact_email } = req.body;
    const customerEmail = String(contact_email || email || '').trim().toLowerCase();
    if (!customerEmail) return sendError(res, 'Email is required for payment', 400);
    if (!phone) return sendError(res, 'Phone number is required for Flutterwave payment', 400);

    const [customer] = await pool.query('SELECT id, full_name FROM customers WHERE LOWER(email) = ?', [customerEmail]);
    if (!customer.length) return sendError(res, 'Order not found', 404);
    const customerId = customer[0].id;

    const [orders] = await pool.query(
      `SELECT * FROM product_orders WHERE order_group_id = ? AND customer_id = ?`,
      [order_group_id, customerId]
    );
    if (!orders.length) return sendError(res, 'Order not found', 404);

    const totalAmount = orders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
    const reference = uuidv4();

    let flwResponse;
    try {
      flwResponse = await createDirectCharge({
        amount: totalAmount,
        reference,
        customerEmail,
        customerName: customer[0].full_name,
        phone,
        network,
        meta: {
          entity_type: 'product_order',
          order_group_id,
        },
      });
    } catch (flwError) {
      throw flwError;
    }

    const charge = flwResponse.data;
    await pool.query(
      `UPDATE product_orders SET transaction_ref = ?, flw_charge_id = ? WHERE order_group_id = ? AND customer_id = ?`,
      [reference, charge.id, order_group_id, customerId]
    );

    sendSuccess(res, {
      reference,
      charge_id: charge.id,
      status: charge.status,
      next_action: charge.next_action || null,
      total_amount: totalAmount,
    }, 'Flutterwave payment initiated', 201);
  } catch (error) {
    console.error('initiateGuestProductOrderFlutterwave error:', error.message);
    sendError(res, error.message || 'Failed to initiate Flutterwave payment', 500);
  }
};

module.exports = {
  createGuestBooking,
  createGuestPayment,
  initiateGuestBookingFlutterwave,
  createGuestCartOrders,
  initiateGuestProductOrderFlutterwave,
};
