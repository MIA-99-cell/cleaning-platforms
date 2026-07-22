const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { notifyProductOrderPlaced } = require('../services/productOrderNotificationService');
const { recordProductOrderCommission } = require('../services/platformCommissionService');

const loadProduct = async (productId) => {
  const [rows] = await pool.query(
    `SELECT p.*, c.company_name FROM products p
     JOIN companies c ON p.tenant_id = c.tenant_id
     WHERE p.id = ? AND p.is_active = TRUE`,
    [productId]
  );
  return rows[0] || null;
};

const placeOrdersForTenant = async ({
  tenantId,
  customerId,
  items,
  paymentMethod,
  deliveryAddress,
  deliveryPhone,
  transactionRef,
  notes,
  orderGroupId,
}) => {
  const createdOrders = [];
  let tenantTotal = 0;

  for (const item of items) {
    const product = await loadProduct(item.product_id);
    if (!product || product.tenant_id !== tenantId) {
      throw new Error(`Product ${item.product_id} not found`);
    }

    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    if (product.stock_quantity > 0 && qty > product.stock_quantity) {
      throw new Error(`Not enough stock for ${product.name}`);
    }

    const totalAmount = parseFloat(product.price) * qty;
    const status = paymentMethod === 'mobile_money' || paymentMethod === 'flutterwave'
      ? 'payment_pending'
      : 'placed';
    const ref = transactionRef || (
      paymentMethod === 'mobile_money' || paymentMethod === 'flutterwave'
        ? `MOMO-${Date.now()}`
        : null
    );

    const [result] = await pool.query(
      `INSERT INTO product_orders (
        tenant_id, product_id, customer_id, quantity, unit_price, total_amount,
        payment_method, status, delivery_address, delivery_phone, transaction_ref, notes, order_group_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        item.product_id,
        customerId,
        qty,
        product.price,
        totalAmount,
        paymentMethod,
        status,
        deliveryAddress,
        deliveryPhone || null,
        ref,
        notes || null,
        orderGroupId,
      ]
    );

    if (product.stock_quantity > 0) {
      await pool.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?',
        [qty, item.product_id, qty]
      );
    }

    createdOrders.push({
      id: result.insertId,
      product_id: item.product_id,
      product_name: product.name,
      company_name: product.company_name,
      quantity: qty,
      total_amount: totalAmount,
      status,
      transaction_ref: ref,
    });
    tenantTotal += totalAmount;
  }

  const [customerRows] = await pool.query('SELECT full_name FROM customers WHERE id = ?', [customerId]);
  const customerName = customerRows[0]?.full_name;

  await pool.query(
    `INSERT INTO notifications (tenant_id, user_type, user_id, title, message, type)
     VALUES (?, 'tenant', ?, 'New Product Order', ?, 'info')`,
    [
      tenantId,
      tenantId,
      `New order with ${items.length} item(s) — ${paymentMethod.replace(/_/g, ' ')}`,
    ]
  );

  notifyProductOrderPlaced({
    tenantId,
    customerId,
    customerName,
    deliveryPhone,
    deliveryAddress,
    paymentMethod,
    items: createdOrders,
    totalAmount: tenantTotal,
    orderGroupId,
  }).catch((err) => {
    console.error('[Product Order Notify] Failed:', err.message);
  });

  return { orders: createdOrders, total_amount: tenantTotal };
};

const createProductOrder = async (req, res) => {
  try {
    const {
      product_id,
      quantity,
      payment_method,
      delivery_address,
      delivery_phone,
      contact_email,
      transaction_ref,
      notes,
    } = req.body;
    const customerId = req.user.id;

    const [customerRows] = await pool.query('SELECT email FROM customers WHERE id = ?', [customerId]);
    const customerEmail = (contact_email || customerRows[0]?.email || '').trim();
    if (!customerEmail) {
      return sendError(res, 'Email is required for order confirmation', 400);
    }
    if (contact_email && contact_email.trim() !== customerRows[0]?.email) {
      await pool.query('UPDATE customers SET email = ? WHERE id = ?', [contact_email.trim(), customerId]);
    }

    const validMethods = ['cash_on_delivery', 'mobile_money', 'flutterwave'];
    if (!validMethods.includes(payment_method)) {
      return sendError(res, 'Invalid payment method', 400);
    }
    if (payment_method === 'flutterwave' && !delivery_phone) {
      return sendError(res, 'Phone number is required for Flutterwave payment', 400);
    }

    const product = await loadProduct(product_id);
    if (!product) return sendError(res, 'Product not found', 404);

    const orderGroupId = uuidv4();
    const result = await placeOrdersForTenant({
      tenantId: product.tenant_id,
      customerId,
      items: [{ product_id, quantity }],
      paymentMethod: payment_method,
      deliveryAddress: delivery_address,
      deliveryPhone: delivery_phone,
      transactionRef: transaction_ref,
      notes,
      orderGroupId,
    });

    const order = result.orders[0];
    sendSuccess(res, {
      ...order,
      order_group_id: orderGroupId,
      payment_method,
    }, 'Order placed successfully', 201);
  } catch (error) {
    console.error('createProductOrder error:', error.message);
    sendError(res, error.message || 'Failed to place order', 500);
  }
};

const createCartProductOrders = async (req, res) => {
  try {
    const {
      items,
      payment_method,
      delivery_address,
      delivery_phone,
      contact_email,
      transaction_ref,
      notes,
    } = req.body;
    const customerId = req.user.id;

    const [customerRows] = await pool.query('SELECT email, full_name FROM customers WHERE id = ?', [customerId]);
    const customerEmail = (contact_email || customerRows[0]?.email || '').trim();
    if (!customerEmail) {
      return sendError(res, 'Email is required for order confirmation', 400);
    }
    if (contact_email && contact_email !== customerRows[0]?.email) {
      await pool.query('UPDATE customers SET email = ? WHERE id = ?', [contact_email.trim(), customerId]);
    }

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
        customerId: req.user.id,
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
    console.error('createCartProductOrders error:', error.message);
    sendError(res, error.message || 'Failed to place cart order', 500);
  }
};

const getTenantProductOrders = async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.*, p.name AS product_name, p.image_url AS product_image,
              c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
       FROM product_orders o
       JOIN products p ON o.product_id = p.id
       JOIN customers c ON o.customer_id = c.id
       WHERE o.tenant_id = ?
       ORDER BY o.created_at DESC`,
      [req.tenantId]
    );
    sendSuccess(res, orders);
  } catch (error) {
    console.error('getTenantProductOrders error:', error.message);
    sendError(res, 'Failed to fetch orders', 500);
  }
};

const getCustomerProductOrders = async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.*, p.name AS product_name, p.image_url AS product_image,
              co.company_name
       FROM product_orders o
       JOIN products p ON o.product_id = p.id
       JOIN companies co ON o.tenant_id = co.tenant_id
       WHERE o.customer_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    sendSuccess(res, orders);
  } catch (error) {
    console.error('getCustomerProductOrders error:', error.message);
    sendError(res, 'Failed to fetch orders', 500);
  }
};

const confirmProductOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT * FROM product_orders WHERE id = ? AND tenant_id = ?',
      [id, req.tenantId]
    );
    if (!existing.length) return sendError(res, 'Order not found', 404);

    const order = existing[0];
    if (order.status === 'paid' || order.status === 'delivered') {
      return sendSuccess(res, null, 'Order already confirmed');
    }
    if (!['payment_pending', 'placed'].includes(order.status)) {
      return sendError(res, 'This order cannot be confirmed', 400);
    }
    if (!['mobile_money', 'flutterwave'].includes(order.payment_method) && order.status !== 'placed') {
      return sendError(res, 'This order cannot be confirmed', 400);
    }

    await pool.query(
      `UPDATE product_orders SET status = 'paid', confirmed_at = NOW(), confirmed_by = ? WHERE id = ? AND tenant_id = ?`,
      [String(req.user.id), id, req.tenantId]
    );

    await recordProductOrderCommission({
      ...order,
      confirmed_at: new Date(),
    });

    sendSuccess(res, null, order.payment_method === 'flutterwave'
      ? 'Flutterwave payment confirmed'
      : 'Payment confirmed');
  } catch (error) {
    console.error('confirmProductOrder error:', error.message);
    sendError(res, 'Failed to confirm order', 500);
  }
};

const markProductOrderDelivered = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT * FROM product_orders WHERE id = ? AND tenant_id = ?',
      [id, req.tenantId]
    );
    if (!existing.length) return sendError(res, 'Order not found', 404);

    const order = existing[0];
    if (order.status === 'cancelled') return sendError(res, 'Cannot deliver cancelled order', 400);
    if (order.payment_method === 'mobile_money' && order.status !== 'paid') {
      return sendError(res, 'Confirm mobile money payment before delivery', 400);
    }
    if (order.payment_method === 'flutterwave' && order.status !== 'paid') {
      return sendError(res, 'Complete Flutterwave payment before delivery', 400);
    }

    await pool.query(
      `UPDATE product_orders SET status = 'delivered' WHERE id = ? AND tenant_id = ?`,
      [id, req.tenantId]
    );

    if (order.payment_method === 'cash_on_delivery') {
      await recordProductOrderCommission({
        ...order,
        confirmed_at: new Date(),
      });
    }

    sendSuccess(res, null, 'Order marked as delivered');
  } catch (error) {
    console.error('markProductOrderDelivered error:', error.message);
    sendError(res, 'Failed to update order', 500);
  }
};

module.exports = {
  createProductOrder,
  createCartProductOrders,
  getTenantProductOrders,
  getCustomerProductOrders,
  confirmProductOrder,
  markProductOrderDelivered,
  placeOrdersForTenant,
};
