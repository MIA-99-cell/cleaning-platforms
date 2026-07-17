const { sendTransactionalEmail, emailTemplates } = require('./emailService');
const config = require('../config');

const sendCleanerCredentialsEmail = async ({
  name, email, password, companyName, isReset = false,
}) => {
  const template = emailTemplates.cleanerCredentials(name, email, password, companyName, isReset);
  const result = await sendTransactionalEmail({ to: email, ...template });

  if (result.success) {
    console.log(`[Cleaner Email] Password sent to ${email} via ${result.via}`);
    return { success: true, emailSent: true, via: result.via };
  }

  console.error(`[Cleaner Email] Failed for ${email}:`, result.error);
  console.log(`[Cleaner Email] Password (share manually): ${password}`);
  return { success: false, emailSent: false, error: result.error, password };
};

const formatJobDate = (value) => {
  if (!value) return 'TBD';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).split('T')[0];
  return date.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const formatJobTime = (value) => {
  if (!value) return 'TBD';
  const str = String(value);
  return str.length >= 5 ? str.slice(0, 5) : str;
};

const sendCleanerJobAssignmentEmail = async ({
  cleanerName,
  cleanerEmail,
  companyName,
  serviceName,
  scheduledDate,
  scheduledTime,
  address,
  customerName,
  specialInstructions,
}) => {
  const template = emailTemplates.cleanerJobAssignment({
    cleanerName,
    companyName,
    serviceName,
    scheduledDate: formatJobDate(scheduledDate),
    scheduledTime: formatJobTime(scheduledTime),
    address: address || 'See job details in the app',
    customerName: customerName || 'Customer',
    specialInstructions: specialInstructions || '',
    jobsUrl: `${config.frontendUrl}/cleaner/jobs`,
  });

  const result = await sendTransactionalEmail({ to: cleanerEmail, ...template });

  if (result.success) {
    console.log(`[Cleaner Email] Job assignment sent to ${cleanerEmail} via ${result.via || 'smtp'}`);
    return { success: true, emailSent: true, via: result.via };
  }

  console.error(`[Cleaner Email] Job assignment failed for ${cleanerEmail}:`, result.error);
  return { success: false, emailSent: false, error: result.error };
};

// Kept for /cleaner/setup route if old links exist
const getCredentialDelivery = async () => null;
const markCredentialDeliveryUsed = async () => {};

module.exports = {
  sendCleanerCredentialsEmail,
  sendCleanerJobAssignmentEmail,
  getCredentialDelivery,
  markCredentialDeliveryUsed,
};
