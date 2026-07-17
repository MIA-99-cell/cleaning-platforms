const pool = require('../config/database');
const { sendSms } = require('./smsService');
const { sendTransactionalEmail, emailTemplates } = require('./emailService');
const { formatCFA } = require('../utils/currencyFormat');
const config = require('../config');

const getTenantContact = async (tenantId) => {
  const [rows] = await pool.query(
    `SELECT t.phone AS tenant_phone, t.email AS tenant_email, t.full_name,
            c.phone AS company_phone, c.email AS company_email, c.company_name
     FROM tenants t
     LEFT JOIN companies c ON c.tenant_id = t.id
     WHERE t.id = ?`,
    [tenantId]
  );
  const row = rows[0] || {};
  return {
    phone: row.company_phone || row.tenant_phone,
    email: row.company_email || row.tenant_email,
    name: row.full_name || row.company_name || 'Tenant',
    companyName: row.company_name || 'Your company',
  };
};

const getCustomerContact = async (customerId) => {
  const [rows] = await pool.query(
    'SELECT full_name, phone, email FROM customers WHERE id = ?',
    [customerId]
  );
  return rows[0] || {};
};

const summarizeItems = (items) => items
  .map((i) => `${i.product_name} x${i.quantity}`)
  .join(', ');

const notifyProductOrderPlaced = async ({
  tenantId,
  customerId,
  customerName,
  deliveryPhone,
  deliveryAddress,
  paymentMethod,
  items,
  totalAmount,
  orderGroupId,
}) => {
  const customer = await getCustomerContact(customerId);
  const tenant = await getTenantContact(tenantId);
  const itemSummary = summarizeItems(items);
  const paymentLabel = paymentMethod === 'flutterwave'
    ? 'Flutterwave (MoMo)'
    : paymentMethod === 'mobile_money'
      ? 'Mobile Money'
      : 'Pay on delivery';
  const amountLabel = formatCFA(totalAmount);
  const customerPhone = deliveryPhone || customer.phone;
  const resolvedCustomerName = customerName || customer.full_name || 'Customer';

  const emailData = {
    itemSummary,
    totalAmount: amountLabel,
    paymentMethod: paymentLabel,
    orderGroupId,
    deliveryAddress,
    customerPhone,
    customerName: resolvedCustomerName,
    companyName: tenant.companyName,
  };

  const emailTasks = [];

  if (!tenant.email) {
    console.warn(`[Product Order Email] No email for tenant ${tenantId}`);
  } else {
    const template = emailTemplates.productOrderPlaced({
      ...emailData,
      recipientName: tenant.name,
      isTenant: true,
    });
    emailTasks.push(sendTransactionalEmail({ to: tenant.email, ...template }));
  }

  if (!customer.email) {
    console.warn(`[Product Order Email] No email for customer ${customerId}`);
  } else {
    const template = emailTemplates.productOrderPlaced({
      ...emailData,
      recipientName: customer.full_name || 'Customer',
      isTenant: false,
    });
    emailTasks.push(sendTransactionalEmail({ to: customer.email, ...template }));
  }

  await Promise.all(emailTasks);

  const tenantMessage = `CleanPro: New order #${orderGroupId?.slice(0, 8) || ''} from ${resolvedCustomerName}. ${itemSummary}. Total ${amountLabel}. Payment: ${paymentLabel}.`;
  const customerMessage = `CleanPro: Your order is confirmed. ${itemSummary}. Total ${amountLabel}. Payment: ${paymentLabel}.`;

  const smsTasks = [];
  if (tenant.phone) smsTasks.push(sendSms({ to: tenant.phone, message: tenantMessage }));
  if (customerPhone) smsTasks.push(sendSms({ to: customerPhone, message: customerMessage }));
  await Promise.all(smsTasks);

  return {
    tenantEmail: !!tenant.email,
    customerEmail: !!customer.email,
    tenantSms: !!tenant.phone,
    customerSms: !!customerPhone,
  };
};

const notifyTenantNewReview = async ({
  tenantId,
  customerName,
  companyRating,
  cleanerRating,
  comment,
}) => {
  const tenant = await getTenantContact(tenantId);
  if (!tenant.email) return { emailSent: false };

  const template = emailTemplates.newCustomerReview({
    tenantName: tenant.name,
    customerName,
    companyRating,
    cleanerRating,
    comment,
    reviewsUrl: `${config.frontendUrl}/tenant/reviews`,
  });

  const result = await sendTransactionalEmail({ to: tenant.email, ...template });
  return { emailSent: result.success };
};

module.exports = { notifyProductOrderPlaced, notifyTenantNewReview };
