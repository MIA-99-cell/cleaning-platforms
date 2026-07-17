const pool = require('../config/database');
const config = require('../config');
const { sendNotificationEmail, emailTemplates } = require('./emailService');
const { sendSms } = require('./smsService');

const getSuperAdminContacts = async () => {
  const [admins] = await pool.query(
    'SELECT email, phone, full_name FROM super_admin WHERE is_active = TRUE'
  );

  const emails = new Set(admins.map((a) => a.email).filter(Boolean));
  const phones = new Set(admins.filter((a) => a.phone).map((a) => a.phone));

  if (config.superAdmin.notifyEmail) emails.add(config.superAdmin.notifyEmail);
  if (config.superAdmin.notifyPhone) phones.add(config.superAdmin.notifyPhone);

  return { emails: [...emails], phones: [...phones] };
};

const notifySuperAdminsNewRegistration = async ({
  companyName, contactName, email, licenseNumber, phone,
}) => {
  const { emails, phones } = await getSuperAdminContacts();
  const dashboardUrl = `${config.frontendUrl}/super-admin/companies`;
  const template = emailTemplates.adminNewRegistration({
    companyName, contactName, email, licenseNumber, phone,
  });

  const results = await Promise.all([
    ...emails.map((to) => sendNotificationEmail({
      to,
      ...template,
      actionUrl: dashboardUrl,
    })),
    ...phones.map((to) => sendSms({
      to,
      message: `New company registered: ${companyName} (${email}). Awaiting email verification.`,
    })),
  ]);

  await pool.query(
    `INSERT INTO notifications (user_type, title, message, type, link)
     VALUES ('super_admin', ?, ?, 'info', '/super-admin/companies')`,
    [
      'New Company Registration',
      `${companyName} registered and is awaiting email verification.`,
    ]
  );

  return { results, isDev: results.some((r) => r?.dev) };
};

const notifySuperAdminsApprovalNeeded = async ({
  tenantId, companyName, contactName, email, licenseNumber, phone, approvalToken,
}) => {
  const { emails, phones } = await getSuperAdminContacts();
  const approveUrl = `${config.frontendUrl}/approve-company?token=${approvalToken}`;

  const template = emailTemplates.adminApprovalRequest({
    companyName, contactName, email, licenseNumber, phone, approveUrl,
  });

  const smsMessage = `Action required: ${companyName} verified email and needs approval. Approve: ${approveUrl}`;

  const results = await Promise.all([
    ...emails.map((to) => sendNotificationEmail({
      to,
      ...template,
      actionUrl: approveUrl,
    })),
    ...phones.map((to) => sendSms({ to, message: smsMessage })),
  ]);

  const isDev = results.some((r) => r?.dev);
  if (isDev) {
    console.log(`[Dev] Admin approval link for ${companyName}: ${approveUrl}`);
  }

  await pool.query(
    `INSERT INTO notifications (user_type, user_id, title, message, type, link)
     VALUES ('super_admin', NULL, ?, ?, 'warning', ?)`,
    [
      'Company Awaiting Approval',
      `${companyName} has verified their email and needs your approval.`,
      `/super-admin/companies`,
    ]
  );

  return { approveUrl, isDev, results };
};

module.exports = { notifySuperAdminsNewRegistration, notifySuperAdminsApprovalNeeded };
