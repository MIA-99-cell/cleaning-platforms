const nodemailer = require('nodemailer');
const config = require('../config');
const {
  isSupabaseConfigured,
  sendSupabaseMagicLinkEmail,
} = require('./supabaseService');

let transporter = null;

const isSmtpConfigured = () => {
  const { host, user, pass } = config.email;
  return !!(host && user && pass && !user.includes('your-email') && !pass.includes('your-app'));
};

const getTransporter = () => {
  if (!transporter && isSmtpConfigured()) {
    const { host, user, pass, port } = config.email;
    if (host === 'smtp.gmail.com' || host?.includes('gmail')) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    } else {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }
  return isSmtpConfigured() ? transporter : null;
};

const sendViaResend = async ({ to, subject, html, text }) => {
  if (!config.email.resendApiKey) return { success: false, error: 'resend_not_configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.email.from,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data?.message || 'resend_failed' };
    return { success: true, via: 'resend' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[Email - Dev Mode] To: ${to}`);
    console.log(`[Email - Dev Mode] Subject: ${subject}`);
    if (text) console.log(`[Email - Dev Mode] Body: ${text.slice(0, 200)}...`);
    return { success: true, dev: true };
  }
  try {
    await transport.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });
    return { success: true, via: 'smtp' };
  } catch (error) {
    console.error('[Email Error]', error.message);
    return { success: false, error: error.message };
  }
};

/** Sends a real email with custom content (password, etc.). Requires SMTP or Resend. */
const sendTransactionalEmail = async ({ to, subject, html, text }) => {
  const smtpResult = await sendEmail({ to, subject, html, text });
  if (smtpResult.success && !smtpResult.dev) return smtpResult;

  const resendResult = await sendViaResend({ to, subject, html, text });
  if (resendResult.success) return resendResult;

  if (smtpResult.dev) {
    console.error('[Email] Not configured. Set SMTP_USER + SMTP_PASS or RESEND_API_KEY in backend/.env');
  }
  return {
    success: false,
    error: smtpResult.error || resendResult.error || 'email_not_configured',
    dev: smtpResult.dev,
  };
};

const sendNotificationEmail = async ({ to, subject, html, text, actionUrl }) => {
  const smtpResult = await sendEmail({ to, subject, html, text });
  if (smtpResult.success && !smtpResult.dev) return smtpResult;

  if (config.supabase.useEmail && isSupabaseConfigured() && actionUrl) {
    const supabaseResult = await sendSupabaseMagicLinkEmail({
      email: to,
      redirectTo: actionUrl,
      createUser: true,
    });
    if (supabaseResult.success) {
      console.log(`[Email] Supabase magic link sent to ${to} -> ${actionUrl}`);
      return supabaseResult;
    }
    console.warn(`[Email] Supabase fallback failed for ${to}:`, supabaseResult.error);
  }

  return smtpResult;
};

const emailTemplates = {
  cleanerCredentials: (name, email, password, companyName, isReset = false) => ({
    subject: isReset
      ? `Your New Password - ${companyName}`
      : `Your Cleaner Login - ${companyName}`,
    html: `
      <h2>${isReset ? 'Password Reset' : `Welcome to ${companyName}`}</h2>
      <p>Hello ${name},</p>
      <p>${isReset
        ? 'Your cleaning company has reset your account password. Use these details to log in:'
        : 'Your cleaning company has created a cleaner account for you on Mycleaning. Use these details to log in:'}</p>
      <table style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0;">
        <tr><td><strong>Login page:</strong></td><td><a href="${config.frontendUrl}/login">${config.frontendUrl}/login</a></td></tr>
        <tr><td><strong>Login as:</strong></td><td>Cleaner</td></tr>
        <tr><td><strong>Email:</strong></td><td>${email}</td></tr>
        <tr><td><strong>Password:</strong></td><td><code style="font-size:16px;font-weight:bold;">${password}</code></td></tr>
      </table>
      <p><strong>Important:</strong> You must change your password after first login.</p>
      <p><a href="${config.frontendUrl}/login" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Login Now</a></p>
    `,
    text: `${isReset ? 'Password reset' : 'Welcome'} - ${companyName}\n\nHello ${name},\n\nLogin: ${config.frontendUrl}/login\nLogin as: Cleaner\nEmail: ${email}\nPassword: ${password}\n\nChange your password after first login.`,
  }),
  emailVerification: (name, token) => ({
    subject: 'Verify Your Email - Cleaning Platform',
    html: `
      <h2>Email Verification</h2>
      <p>Hello ${name},</p>
      <p>Please verify your email by clicking the link below:</p>
      <p><a href="${config.frontendUrl}/verify-email?token=${token}">Verify Email</a></p>
      <p>This link expires in 24 hours.</p>
    `,
    text: `Hello ${name},\n\nVerify your email: ${config.frontendUrl}/verify-email?token=${token}`,
  }),
  passwordReset: (name, token, userType) => ({
    subject: 'Password Reset - Cleaning Platform',
    html: `
      <h2>Password Reset</h2>
      <p>Hello ${name},</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${config.frontendUrl}/reset-password?token=${token}&userType=${userType}">Reset Password</a></p>
      <p>This link expires in 1 hour.</p>
    `,
    text: `Hello ${name},\n\nReset password: ${config.frontendUrl}/reset-password?token=${token}&userType=${userType}`,
  }),
  bookingConfirmation: (customerName, serviceName, date, time) => ({
    subject: 'Booking Confirmation',
    html: `
      <h2>Booking Confirmed</h2>
      <p>Hello ${customerName},</p>
      <p>Your booking for <strong>${serviceName}</strong> on ${date} at ${time} has been confirmed.</p>
    `,
  }),
  companyApproval: (companyName) => ({
    subject: 'Company Approved - Cleaning Platform',
    html: `
      <h2>Congratulations!</h2>
      <p>Your company <strong>${companyName}</strong> has been approved. You can now log in and start managing your business.</p>
      <p><a href="${config.frontendUrl}/login">Login Now</a></p>
    `,
    text: `Your company ${companyName} has been approved. Login at ${config.frontendUrl}/login`,
  }),
  cleanerJobAssignment: ({
    cleanerName,
    companyName,
    serviceName,
    scheduledDate,
    scheduledTime,
    address,
    customerName,
    specialInstructions,
    jobsUrl,
  }) => ({
    subject: `New Job Assignment - ${serviceName}`,
    html: `
      <h2>New Cleaning Job Assigned</h2>
      <p>Hello ${cleanerName},</p>
      <p><strong>${companyName}</strong> has assigned you to a new cleaning job:</p>
      <table style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0;width:100%;max-width:520px;">
        <tr><td style="padding:4px 8px;"><strong>Service:</strong></td><td style="padding:4px 8px;">${serviceName}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Date:</strong></td><td style="padding:4px 8px;">${scheduledDate}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Time:</strong></td><td style="padding:4px 8px;">${scheduledTime}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Location:</strong></td><td style="padding:4px 8px;">${address}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Customer:</strong></td><td style="padding:4px 8px;">${customerName}</td></tr>
        ${specialInstructions ? `<tr><td style="padding:4px 8px;"><strong>Notes:</strong></td><td style="padding:4px 8px;">${specialInstructions}</td></tr>` : ''}
      </table>
      <p>Please log in to view full job details and accept or update the assignment.</p>
      <p><a href="${jobsUrl}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">View My Jobs</a></p>
    `,
    text: `Hello ${cleanerName},\n\n${companyName} assigned you to: ${serviceName}\nDate: ${scheduledDate}\nTime: ${scheduledTime}\nLocation: ${address}\nCustomer: ${customerName}${specialInstructions ? `\nNotes: ${specialInstructions}` : ''}\n\nView jobs: ${jobsUrl}`,
  }),
  productOrderPlaced: ({
    recipientName,
    isTenant,
    companyName,
    customerName,
    itemSummary,
    totalAmount,
    paymentMethod,
    orderGroupId,
    deliveryAddress,
    customerPhone,
  }) => ({
    subject: isTenant
      ? `New Marketplace Order - ${companyName}`
      : `Order Confirmation - CleanPro`,
    html: `
      <h2>${isTenant ? 'New Product Order' : 'Your Order is Confirmed'}</h2>
      <p>Hello ${recipientName},</p>
      <p>${isTenant
        ? `You received a new marketplace order from <strong>${customerName}</strong>.`
        : 'Thank you for your purchase on CleanPro marketplace.'}</p>
      <table style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0;">
        <tr><td><strong>Order #</strong></td><td>${orderGroupId?.slice(0, 8) || '—'}</td></tr>
        <tr><td><strong>Items</strong></td><td>${itemSummary}</td></tr>
        <tr><td><strong>Total</strong></td><td>${totalAmount}</td></tr>
        <tr><td><strong>Payment</strong></td><td>${paymentMethod}</td></tr>
        ${deliveryAddress ? `<tr><td><strong>Delivery</strong></td><td>${deliveryAddress}</td></tr>` : ''}
        ${isTenant && customerPhone ? `<tr><td><strong>Customer Phone</strong></td><td>${customerPhone}</td></tr>` : ''}
      </table>
      <p><a href="${config.frontendUrl}/login">View in Dashboard</a></p>
    `,
    text: `${isTenant ? 'New order' : 'Order confirmed'}: ${itemSummary}. Total ${totalAmount}. Payment: ${paymentMethod}.`,
  }),
  newServiceBooking: ({
    recipientName,
    isTenant,
    companyName,
    customerName,
    customerPhone,
    customerEmail,
    serviceName,
    scheduledDate,
    scheduledTime,
    address,
    totalAmount,
    specialInstructions,
    bookingId,
  }) => ({
    subject: isTenant
      ? `New Service Booking - ${serviceName}`
      : `Booking Confirmation - ${serviceName}`,
    html: `
      <h2>${isTenant ? 'New Service Booking' : 'Your Booking is Confirmed'}</h2>
      <p>Hello ${recipientName},</p>
      <p>${isTenant
        ? `<strong>${customerName}</strong> booked a service with <strong>${companyName}</strong>.`
        : `Thank you for booking with <strong>${companyName}</strong>.`}</p>
      <table style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0;">
        <tr><td style="padding:4px 8px;"><strong>Booking #</strong></td><td style="padding:4px 8px;">${bookingId}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Service</strong></td><td style="padding:4px 8px;">${serviceName}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Date</strong></td><td style="padding:4px 8px;">${scheduledDate}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Time</strong></td><td style="padding:4px 8px;">${scheduledTime}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Address</strong></td><td style="padding:4px 8px;">${address}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Amount</strong></td><td style="padding:4px 8px;">${totalAmount}</td></tr>
        ${isTenant ? `<tr><td style="padding:4px 8px;"><strong>Customer</strong></td><td style="padding:4px 8px;">${customerName}</td></tr>` : ''}
        ${isTenant && customerPhone ? `<tr><td style="padding:4px 8px;"><strong>Phone</strong></td><td style="padding:4px 8px;">${customerPhone}</td></tr>` : ''}
        ${isTenant && customerEmail ? `<tr><td style="padding:4px 8px;"><strong>Email</strong></td><td style="padding:4px 8px;">${customerEmail}</td></tr>` : ''}
        ${specialInstructions ? `<tr><td style="padding:4px 8px;"><strong>Notes</strong></td><td style="padding:4px 8px;">${specialInstructions}</td></tr>` : ''}
      </table>
      <p><a href="${config.frontendUrl}/login" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Open Dashboard</a></p>
    `,
    text: `${isTenant ? 'New booking' : 'Booking confirmed'}: ${serviceName} on ${scheduledDate} at ${scheduledTime}. Address: ${address}. Amount: ${totalAmount}.`,
  }),
  serviceCompleted: ({
    customerName,
    companyName,
    serviceName,
    cleanerName,
    scheduledDate,
    address,
    bookingId,
  }) => ({
    subject: `Service Completed - ${serviceName}`,
    html: `
      <h2>Your Service is Complete</h2>
      <p>Hello ${customerName},</p>
      <p><strong>${companyName}</strong> has completed your service. Thank you for choosing us!</p>
      <table style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0;">
        <tr><td style="padding:4px 8px;"><strong>Booking #</strong></td><td style="padding:4px 8px;">${bookingId}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Service</strong></td><td style="padding:4px 8px;">${serviceName}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Date</strong></td><td style="padding:4px 8px;">${scheduledDate}</td></tr>
        <tr><td style="padding:4px 8px;"><strong>Address</strong></td><td style="padding:4px 8px;">${address}</td></tr>
        ${cleanerName ? `<tr><td style="padding:4px 8px;"><strong>Cleaner</strong></td><td style="padding:4px 8px;">${cleanerName}</td></tr>` : ''}
      </table>
      <p>We would love to hear your feedback. Log in to leave a review.</p>
      <p><a href="${config.frontendUrl}/login" style="background:#16a34a;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Leave a Review</a></p>
    `,
    text: `Hello ${customerName}, ${companyName} has completed your ${serviceName} service (booking #${bookingId}). Log in to leave a review: ${config.frontendUrl}/login`,
  }),
  newCustomerReview: ({ tenantName, customerName, companyRating, cleanerRating, comment, reviewsUrl }) => ({
    subject: `New Customer Review - ${companyRating}★`,
    html: `
      <h2>New Customer Review</h2>
      <p>Hello ${tenantName},</p>
      <p><strong>${customerName}</strong> left a review for your company:</p>
      <p>Company rating: ${'★'.repeat(companyRating)} (${companyRating}/5)</p>
      ${cleanerRating ? `<p>Cleaner rating: ${'★'.repeat(cleanerRating)} (${cleanerRating}/5)</p>` : ''}
      ${comment ? `<p><em>"${comment}"</em></p>` : ''}
      <p><a href="${reviewsUrl}">View & Reply</a></p>
    `,
    text: `${customerName} rated your company ${companyRating}/5. ${comment || ''}`,
  }),
  adminNewRegistration: ({ companyName, contactName, email, licenseNumber, phone }) => ({
    subject: `New Company Registration - ${companyName}`,
    html: `
      <h2>New Company Registered</h2>
      <p>A new cleaning company has registered on the platform:</p>
      <ul>
        <li><strong>Company:</strong> ${companyName}</li>
        <li><strong>Contact:</strong> ${contactName}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>License:</strong> ${licenseNumber}</li>
        <li><strong>Phone:</strong> ${phone || 'N/A'}</li>
      </ul>
      <p>Status: <strong>Awaiting email verification</strong></p>
      <p>You will receive another notification once they verify their email and are ready for approval.</p>
    `,
    text: `New company registered: ${companyName} (${email}). Awaiting email verification.`,
  }),
  adminApprovalRequest: ({ companyName, contactName, email, licenseNumber, phone, approveUrl }) => ({
    subject: `Action Required: Approve ${companyName}`,
    html: `
      <h2>Company Ready for Approval</h2>
      <p><strong>${companyName}</strong> has verified their email and is ready for your approval:</p>
      <ul>
        <li><strong>Contact:</strong> ${contactName}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>License:</strong> ${licenseNumber}</li>
        <li><strong>Phone:</strong> ${phone || 'N/A'}</li>
      </ul>
      <p style="margin: 24px 0;">
        <a href="${approveUrl}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
          Approve Company
        </a>
      </p>
      <p style="color:#64748b;font-size:14px;">Or copy this link: ${approveUrl}</p>
      <p style="color:#64748b;font-size:14px;">This approval link expires in 7 days.</p>
    `,
    text: `Approve ${companyName}: ${approveUrl}`,
  }),
};

module.exports = {
  sendEmail,
  sendTransactionalEmail,
  sendNotificationEmail,
  emailTemplates,
  isSmtpConfigured,
};
