const pool = require('../config/database');
const { sendSms } = require('./smsService');
const { sendTransactionalEmail, emailTemplates } = require('./emailService');
const { formatCFA } = require('../utils/currencyFormat');
const { getTenantContact, sendSmsAndReport } = require('./notificationHelpers');

const notifyServiceBookingPlaced = async ({
  tenantId,
  customerId,
  bookingId,
  serviceName,
  scheduledDate,
  scheduledTime,
  address,
  totalAmount,
  specialInstructions,
}) => {
  const [customerRows] = await pool.query(
    'SELECT full_name, phone, email FROM customers WHERE id = ?',
    [customerId]
  );
  const customer = customerRows[0] || {};
  const tenant = await getTenantContact(tenantId);
  const amountLabel = formatCFA(totalAmount);

  const emailData = {
    companyName: tenant.companyName,
    customerName: customer.full_name || 'Customer',
    customerPhone: customer.phone || '',
    customerEmail: customer.email || '',
    serviceName,
    scheduledDate,
    scheduledTime,
    address,
    totalAmount: amountLabel,
    specialInstructions: specialInstructions || '',
    bookingId,
  };

  const emailTasks = [];

  if (!tenant.email) {
    console.warn(`[Booking Email] No email for tenant ${tenantId}`);
  } else {
    const template = emailTemplates.newServiceBooking({
      ...emailData,
      recipientName: tenant.name,
      isTenant: true,
    });
    emailTasks.push(sendTransactionalEmail({ to: tenant.email, ...template }));
  }

  if (customer.email) {
    const template = emailTemplates.newServiceBooking({
      ...emailData,
      recipientName: customer.full_name || 'Customer',
      isTenant: false,
    });
    emailTasks.push(sendTransactionalEmail({ to: customer.email, ...template }));
  }

  const tenantSms = `CleanPro: New booking #${bookingId} from ${customer.full_name || 'Customer'}. ${serviceName} on ${scheduledDate} at ${scheduledTime}. ${amountLabel}. Address: ${address}`;
  const customerSms = `CleanPro: Booking #${bookingId} confirmed with ${tenant.companyName}. ${serviceName} on ${scheduledDate} at ${scheduledTime}. ${amountLabel}.`;

  const smsTasks = [];
  if (tenant.phone) smsTasks.push(sendSms({ to: tenant.phone, message: tenantSms }));
  smsTasks.push(sendSmsAndReport({
    to: customer.phone,
    message: customerSms,
    label: 'Booking Customer SMS',
  }));

  // SMS and email are independent: an email failure must not block the text message.
  await Promise.allSettled([...smsTasks, ...emailTasks]);

  return {
    tenantEmail: !!tenant.email,
    customerEmail: !!customer.email,
    tenantSms: !!tenant.phone,
    customerSms: !!customer.phone,
  };
};

const notifyServiceCompleted = async ({ bookingId }) => {
  const [rows] = await pool.query(
    `SELECT b.id, b.scheduled_date, b.address,
            s.name AS service_name,
            co.company_name,
            cu.full_name AS customer_name, cu.email AS customer_email, cu.phone AS customer_phone,
            (SELECT cl.full_name FROM cleaner_assignments ca
             JOIN cleaners cl ON ca.cleaner_id = cl.id
             WHERE ca.booking_id = b.id
             ORDER BY ca.created_at DESC LIMIT 1) AS cleaner_name
     FROM bookings b
     JOIN services s ON b.service_id = s.id
     JOIN customers cu ON b.customer_id = cu.id
     LEFT JOIN companies co ON b.tenant_id = co.tenant_id
     WHERE b.id = ?`,
    [bookingId]
  );
  const booking = rows[0];
  if (!booking) {
    console.warn(`[Completion Notify] Booking ${bookingId} not found`);
    return;
  }

  const companyName = booking.company_name || 'Your cleaning company';

  // In-app notification for the customer
  await pool.query(
    `INSERT INTO notifications (tenant_id, user_type, user_id, title, message, type)
     SELECT tenant_id, 'customer', customer_id, 'Service Completed', ?, 'success'
     FROM bookings WHERE id = ?`,
    [`Your ${booking.service_name} service has been completed. You can now leave a review.`, bookingId]
  );

  const emailTasks = [];

  if (booking.customer_email) {
    const template = emailTemplates.serviceCompleted({
      customerName: booking.customer_name || 'Customer',
      companyName,
      serviceName: booking.service_name,
      cleanerName: booking.cleaner_name || '',
      scheduledDate: booking.scheduled_date,
      address: booking.address,
      bookingId: booking.id,
    });
    emailTasks.push(sendTransactionalEmail({ to: booking.customer_email, ...template }));
  }

  const smsResult = await sendSmsAndReport({
    to: booking.customer_phone,
    message: `CleanPro: Your ${booking.service_name} service (booking #${booking.id}) has been completed by ${companyName}. Thank you! Log in to leave a review.`,
    label: 'Completion Customer SMS',
  });

  // Email remains best-effort and cannot prevent or delay the customer SMS.
  await Promise.allSettled(emailTasks);

  return {
    email: !!booking.customer_email,
    sms: smsResult.success,
  };
};

module.exports = { notifyServiceBookingPlaced, notifyServiceCompleted };
