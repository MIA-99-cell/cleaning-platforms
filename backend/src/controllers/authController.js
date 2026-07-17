const pool = require('../config/database');
const {
  hashPassword,
  comparePassword,
  generateToken,
  generateResetToken,
  generateRandomPassword,
} = require('../utils/auth');
const { sendEmail, sendNotificationEmail, emailTemplates } = require('../services/emailService');
const { notifySuperAdminsNewRegistration, notifySuperAdminsApprovalNeeded } = require('../services/notificationService');
const {
  provisionSupabaseAuthUser,
  sendSupabaseVerificationEmail,
  sendSupabaseResetPasswordEmail,
  verifySupabaseAccessToken,
  isSupabaseConfigured,
} = require('../services/supabaseService');
const { logActivity } = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');
const { isTruthy } = require('../utils/pgCompat');
const { v4: uuidv4 } = require('uuid');
const {
  getCredentialDelivery,
  markCredentialDeliveryUsed,
} = require('../services/cleanerEmailService');
const config = require('../config');

const USER_TABLES = {
  super_admin: { table: 'super_admin', role: 'super_admin' },
  tenant: { table: 'tenants', role: 'tenant' },
  cleaner: { table: 'cleaners', role: 'cleaner' },
  customer: { table: 'customers', role: 'customer' },
};

const findUser = async (userType, email) => {
  const tableConfig = USER_TABLES[userType];
  if (!tableConfig) return null;

  // Keep this PostgreSQL-safe (avoid mixed boolean/text IN lists)
  const [rows] = await pool.query(
    `SELECT * FROM ${tableConfig.table}
     WHERE LOWER(email) = LOWER(?)
       AND (is_active IS TRUE OR is_active = 1 OR CAST(is_active AS TEXT) IN ('true', 't', '1', 'yes'))`,
    [email]
  );
  return rows[0] || null;
};

const login = async (req, res) => {
  try {
    const { email, password, userType } = req.body;

    const user = await findUser(userType, email);
    if (!user) return sendError(res, 'Invalid email or password', 401);

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return sendError(res, 'Invalid email or password', 401);

    if (userType === 'tenant' && !isTruthy(user.email_verified)) {
      return sendError(res, 'Please verify your email before logging in', 403);
    }
    if (userType === 'tenant' && user.status === 'pending') {
      return sendError(res, 'Your account is pending approval', 403);
    }
    if (userType === 'tenant' && user.status === 'suspended') {
      return sendError(res, 'Your account has been suspended', 403);
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: userType,
      name: user.full_name,
    };

    if (userType === 'cleaner') {
      tokenPayload.tenantId = user.tenant_id;
      tokenPayload.mustChangePassword = user.must_change_password;
    }
    if (userType === 'customer' && user.tenant_id) {
      tokenPayload.tenantId = user.tenant_id;
    }

    const token = generateToken(tokenPayload);

    const table = USER_TABLES[userType].table;
    await pool.query(`UPDATE ${table} SET last_login = NOW() WHERE id = ?`, [user.id]);

    await logActivity({
      tenantId: user.tenant_id || null,
      userType,
      userId: user.id,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip,
    });

    sendSuccess(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: userType,
        mustChangePassword: user.must_change_password || false,
        status: user.status,
      },
    }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    const dbRelated = /ENOTFOUND|ECONNREFUSED|ECONNRESET|timeout|password authentication|database/i.test(
      String(error.message || '')
    );
    sendError(
      res,
      dbRelated
        ? 'Login failed: cannot reach database. Check DATABASE_URL on the server.'
        : 'Login failed',
      500
    );
  }
};

const registerTenant = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { email, password, full_name, phone, company_name, license_number, address } = req.body;

    const [existing] = await connection.query('SELECT id FROM tenants WHERE email = ?', [email]);
    if (existing.length) return sendError(res, 'Email already registered', 409);

    const [existingLicense] = await connection.query(
      'SELECT id FROM companies WHERE license_number = ?',
      [license_number]
    );
    if (existingLicense.length) return sendError(res, 'License number already registered', 409);

    const passwordHash = await hashPassword(password);
    const verificationToken = uuidv4();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO tenants (email, password_hash, full_name, phone, email_verification_token, email_verification_expires)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, passwordHash, full_name, phone, verificationToken, expires]
    );

    await connection.query(
      `INSERT INTO companies (tenant_id, company_name, license_number, address, phone, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [result.insertId, company_name, license_number, address || null, phone, email]
    );

    await connection.commit();

    const useSupabaseEmail = config.supabase.useEmail && isSupabaseConfigured();
    const verifyUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
    const isDev = process.env.NODE_ENV !== 'production';
    let emailResult = { success: true };

    if (useSupabaseEmail) {
      const supabaseSend = await provisionSupabaseAuthUser({
        email,
        password,
        metadata: { role: 'tenant', full_name, company_name },
        redirectTo: `${config.frontendUrl}/verify-email`,
      });
      if (!supabaseSend.success) {
        const template = emailTemplates.emailVerification(full_name, verificationToken);
        emailResult = await sendEmail({ to: email, ...template });
      }
    } else {
      const template = emailTemplates.emailVerification(full_name, verificationToken);
      emailResult = await sendEmail({ to: email, ...template });
    }

    if (!useSupabaseEmail && (emailResult.dev || !emailResult.success)) {
      console.log(`[Dev] Email verification link for ${email}: ${verifyUrl}`);
    }

    await notifySuperAdminsNewRegistration({
      companyName: company_name,
      contactName: full_name,
      email,
      licenseNumber: license_number,
      phone,
    });

    sendSuccess(res, {
      id: result.insertId,
      ...(isDev && !useSupabaseEmail && { verificationUrl: verifyUrl }),
    }, emailResult.success
      ? 'Registration successful. Please verify your email.'
      : 'Registration successful. Check console/server for verification link.', 201);
  } catch (error) {
    await connection.rollback();
    console.error('Tenant registration error:', error);
    sendError(res, 'Registration failed', 500);
  } finally {
    connection.release();
  }
};

const registerCustomer = async (req, res) => {
  try {
    const { email, password, full_name, phone, address } = req.body;

    const [existing] = await pool.query('SELECT id FROM customers WHERE email = ?', [email]);
    if (existing.length) return sendError(res, 'Email already registered', 409);

    const passwordHash = await hashPassword(password);

    const [result] = await pool.query(
      `INSERT INTO customers (email, password_hash, full_name, phone, address) VALUES (?, ?, ?, ?, ?)`,
      [email, passwordHash, full_name, phone, address]
    );

    if (config.supabase.useEmail && isSupabaseConfigured()) {
      await provisionSupabaseAuthUser({
        email,
        password,
        metadata: { role: 'customer', full_name },
        redirectTo: `${config.frontendUrl}/verify-email`,
      });
    }

    sendSuccess(res, { id: result.insertId }, 'Registration successful', 201);
  } catch (error) {
    console.error('Customer registration error:', error);
    sendError(res, 'Registration failed', 500);
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    const [rows] = await pool.query(
      `SELECT * FROM tenants WHERE email_verification_token = ?`,
      [token]
    );

    if (!rows.length) {
      return sendError(res, 'Invalid verification link. It may have already been used or expired.', 400);
    }

    const tenant = rows[0];

    if (tenant.email_verified) {
      if (tenant.status === 'pending') {
        const approvalToken = tenant.admin_approval_token || uuidv4();
        const approvalExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        if (!tenant.admin_approval_token) {
          await pool.query(
            `UPDATE tenants SET admin_approval_token = ?, admin_approval_token_expires = ? WHERE id = ?`,
            [approvalToken, approvalExpires, tenant.id]
          );
        }
        const [company] = await pool.query(
          'SELECT company_name, license_number FROM companies WHERE tenant_id = ?',
          [tenant.id]
        );
        await notifySuperAdminsApprovalNeeded({
          tenantId: tenant.id,
          companyName: company[0]?.company_name || tenant.full_name,
          contactName: tenant.full_name,
          email: tenant.email,
          licenseNumber: company[0]?.license_number || 'N/A',
          phone: tenant.phone,
          approvalToken: tenant.admin_approval_token || approvalToken,
        });
        return sendSuccess(res, { alreadyVerified: true }, 'Email already verified. Admin has been re-notified to approve your account.');
      }
      return sendSuccess(res, { alreadyVerified: true }, 'Email is already verified. You can log in once your account is approved.');
    }

    if (tenant.email_verification_expires && new Date(tenant.email_verification_expires) < new Date()) {
      return sendError(res, 'Verification link has expired. Please request a new one.', 400);
    }

    const approvalToken = uuidv4();
    const approvalExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE tenants SET email_verified = TRUE, admin_approval_token = ?, admin_approval_token_expires = ? WHERE id = ?`,
      [approvalToken, approvalExpires, tenant.id]
    );

    const [company] = await pool.query(
      'SELECT company_name, license_number FROM companies WHERE tenant_id = ?',
      [tenant.id]
    );

    const notifyResult = await notifySuperAdminsApprovalNeeded({
      tenantId: tenant.id,
      companyName: company[0]?.company_name || tenant.full_name,
      contactName: tenant.full_name,
      email: tenant.email,
      licenseNumber: company[0]?.license_number || 'N/A',
      phone: tenant.phone,
      approvalToken,
    });

    const isDev = process.env.NODE_ENV !== 'production';
    sendSuccess(res, {
      ...(isDev && notifyResult.isDev && { adminApprovalUrl: notifyResult.approveUrl }),
    }, 'Email verified! The platform admin has been notified by email/SMS to approve your account.');
  } catch (error) {
    console.error('Verify email error:', error);
    sendError(res, 'Verification failed', 500);
  }
};

const verifyEmailByAddress = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 'Email is required', 400);

    const [rows] = await pool.query('SELECT * FROM tenants WHERE email = ?', [email]);
    if (!rows.length) return sendError(res, 'Tenant not found', 404);
    const tenant = rows[0];

    if (tenant.email_verified) {
      return sendSuccess(res, { alreadyVerified: true }, 'Email already verified.');
    }

    const approvalToken = uuidv4();
    const approvalExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE tenants SET email_verified = TRUE, admin_approval_token = ?, admin_approval_token_expires = ? WHERE id = ?`,
      [approvalToken, approvalExpires, tenant.id]
    );

    const [company] = await pool.query(
      'SELECT company_name, license_number FROM companies WHERE tenant_id = ?',
      [tenant.id]
    );

    await notifySuperAdminsApprovalNeeded({
      tenantId: tenant.id,
      companyName: company[0]?.company_name || tenant.full_name,
      contactName: tenant.full_name,
      email: tenant.email,
      licenseNumber: company[0]?.license_number || 'N/A',
      phone: tenant.phone,
      approvalToken,
    });

    return sendSuccess(res, null, 'Email verified and admin notified for approval.');
  } catch (error) {
    console.error('Verify email by address error:', error);
    return sendError(res, 'Verification failed', 500);
  }
};

const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const [rows] = await pool.query('SELECT * FROM tenants WHERE email = ?', [email]);
    if (!rows.length) {
      return sendSuccess(res, null, 'If the email exists, a new verification link has been sent.');
    }

    const tenant = rows[0];

    if (tenant.email_verified) {
      return sendSuccess(res, null, 'Email is already verified. Please wait for admin approval or contact support.');
    }

    const verificationToken = uuidv4();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE tenants SET email_verification_token = ?, email_verification_expires = ? WHERE id = ?`,
      [verificationToken, expires, tenant.id]
    );

    const useSupabaseEmail = config.supabase.useEmail && isSupabaseConfigured();
    let emailResult = { success: true };
    const verifyUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
    const isDev = process.env.NODE_ENV !== 'production';

    if (useSupabaseEmail) {
      const supabaseSend = await sendSupabaseVerificationEmail({
        email,
        redirectTo: `${config.frontendUrl}/verify-email`,
      });
      if (!supabaseSend.success) {
        const template = emailTemplates.emailVerification(tenant.full_name, verificationToken);
        emailResult = await sendEmail({ to: email, ...template });
      }
    } else {
      const template = emailTemplates.emailVerification(tenant.full_name, verificationToken);
      emailResult = await sendEmail({ to: email, ...template });
    }

    if (!useSupabaseEmail && (emailResult.dev || !emailResult.success)) {
      console.log(`[Dev] New verification link for ${email}: ${verifyUrl}`);
    }

    sendSuccess(res, {
      ...(isDev && !useSupabaseEmail && { verificationUrl: verifyUrl }),
    }, emailResult.success
      ? 'A new verification link has been sent to your email.'
      : 'Verification link generated. Check below or server console.');
  } catch (error) {
    console.error('Resend verification error:', error);
    sendError(res, 'Failed to resend verification', 500);
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email, userType } = req.body;
    const user = await findUser(userType, email);

    if (!user) {
      return sendSuccess(res, null, 'If the email exists, a reset link has been sent');
    }

    const token = generateResetToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO password_resets (user_type, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
      [userType, user.id, token, expires]
    );

    if (config.supabase.useEmail && isSupabaseConfigured()) {
      const supabaseReset = await sendSupabaseResetPasswordEmail({
        email,
        redirectTo: `${config.frontendUrl}/reset-password?userType=${userType}`,
      });
      if (!supabaseReset.success) {
        const template = emailTemplates.passwordReset(user.full_name, token, userType);
        await sendEmail({ to: email, ...template });
      }
    } else {
      const template = emailTemplates.passwordReset(user.full_name, token, userType);
      await sendEmail({ to: email, ...template });
    }

    sendSuccess(res, null, 'If the email exists, a reset link has been sent');
  } catch (error) {
    sendError(res, 'Request failed', 500);
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password, userType } = req.body;

    const [rows] = await pool.query(
      `SELECT * FROM password_resets WHERE token = ? AND user_type = ? AND used = FALSE AND expires_at > NOW()`,
      [token, userType]
    );
    if (!rows.length) return sendError(res, 'Invalid or expired reset token', 400);

    const reset = rows[0];
    const table = USER_TABLES[userType].table;
    const passwordHash = await hashPassword(password);

    await pool.query(`UPDATE ${table} SET password_hash = ? WHERE id = ?`, [passwordHash, reset.user_id]);
    await pool.query(`UPDATE password_resets SET used = TRUE WHERE id = ?`, [reset.id]);

    if (userType === 'cleaner') {
      await pool.query(`UPDATE cleaners SET must_change_password = FALSE WHERE id = ?`, [reset.user_id]);
    }

    sendSuccess(res, null, 'Password reset successful');
  } catch (error) {
    sendError(res, 'Reset failed', 500);
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { id, role } = req.user;

    const table = USER_TABLES[role].table;
    const [rows] = await pool.query(`SELECT password_hash FROM ${table} WHERE id = ?`, [id]);
    if (!rows.length) return sendError(res, 'User not found', 404);

    const valid = await comparePassword(currentPassword, rows[0].password_hash);
    if (!valid) return sendError(res, 'Current password is incorrect', 400);

    const passwordHash = await hashPassword(newPassword);
    await pool.query(`UPDATE ${table} SET password_hash = ? WHERE id = ?`, [passwordHash, id]);

    if (role === 'cleaner') {
      await pool.query(`UPDATE cleaners SET must_change_password = FALSE WHERE id = ?`, [id]);
    }

    sendSuccess(res, { mustChangePassword: false }, 'Password changed successfully');
  } catch (error) {
    sendError(res, 'Password change failed', 500);
  }
};

const getMe = async (req, res) => {
  try {
    const { id, role } = req.user;
    const table = USER_TABLES[role].table;
    const [rows] = await pool.query(
      `SELECT id, email, full_name, phone, created_at FROM ${table} WHERE id = ?`,
      [id]
    );
    if (!rows.length) return sendError(res, 'User not found', 404);

    const user = rows[0];
    user.role = role;

    if (role === 'tenant') {
      const [company] = await pool.query('SELECT * FROM companies WHERE tenant_id = ?', [id]);
      user.company = company[0] || null;
    }

    sendSuccess(res, user);
  } catch (error) {
    sendError(res, 'Failed to fetch profile', 500);
  }
};

const requestApproval = async (req, res) => {
  try {
    const { email } = req.body;

    const [rows] = await pool.query(
      `SELECT t.*, c.company_name, c.license_number FROM tenants t
       LEFT JOIN companies c ON t.id = c.tenant_id WHERE t.email = ?`,
      [email]
    );

    if (!rows.length) {
      return sendSuccess(res, null, 'If your account exists and is verified, the admin has been notified.');
    }

    const tenant = rows[0];

    if (!tenant.email_verified) {
      return sendError(res, 'Please verify your email first before requesting approval.', 400);
    }

    if (tenant.status === 'approved') {
      return sendSuccess(res, null, 'Your account is already approved. You can log in.');
    }

    if (tenant.status !== 'pending') {
      return sendError(res, `Your account status is: ${tenant.status}. Contact support.`, 400);
    }

    const approvalToken = uuidv4();
    const approvalExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE tenants SET admin_approval_token = ?, admin_approval_token_expires = ? WHERE id = ?`,
      [approvalToken, approvalExpires, tenant.id]
    );

    const notifyResult = await notifySuperAdminsApprovalNeeded({
      tenantId: tenant.id,
      companyName: tenant.company_name || tenant.full_name,
      contactName: tenant.full_name,
      email: tenant.email,
      licenseNumber: tenant.license_number || 'N/A',
      phone: tenant.phone,
      approvalToken,
    });

    const isDev = process.env.NODE_ENV !== 'production';
    sendSuccess(res, {
      ...(isDev && notifyResult.isDev && { adminApprovalUrl: notifyResult.approveUrl }),
    }, 'Admin has been notified by email/SMS to approve your company.');
  } catch (error) {
    console.error('Request approval error:', error);
    sendError(res, 'Failed to send approval request', 500);
  }
};

const approveTenantByToken = async (req, res) => {
  try {
    const { token } = req.body;

    const [rows] = await pool.query(
      `SELECT t.*, c.company_name FROM tenants t
       LEFT JOIN companies c ON t.id = c.tenant_id
       WHERE t.admin_approval_token = ?`,
      [token]
    );

    if (!rows.length) {
      return sendError(res, 'Invalid or expired approval link', 400);
    }

    const tenant = rows[0];

    if (tenant.status === 'approved') {
      return sendSuccess(res, { companyName: tenant.company_name }, 'Company is already approved');
    }

    if (tenant.admin_approval_token_expires && new Date(tenant.admin_approval_token_expires) < new Date()) {
      return sendError(res, 'Approval link has expired. Please log in to the admin panel to approve manually.', 400);
    }

    if (!tenant.email_verified) {
      return sendError(res, 'Company has not verified their email yet', 400);
    }

    await pool.query(
      `UPDATE tenants SET status = 'approved', admin_approval_token = NULL, admin_approval_token_expires = NULL WHERE id = ?`,
      [tenant.id]
    );

    const template = emailTemplates.companyApproval(tenant.company_name || tenant.full_name);
    await sendNotificationEmail({
      to: tenant.email,
      ...template,
      actionUrl: `${config.frontendUrl}/login`,
    });

    await pool.query(
      `INSERT INTO notifications (tenant_id, user_type, user_id, title, message, type)
       VALUES (?, 'tenant', ?, 'Company Approved', 'Your company has been approved! You can now log in.', 'success')`,
      [tenant.id, tenant.id]
    );

    sendSuccess(res, { companyName: tenant.company_name || tenant.full_name }, 'Company approved successfully');
  } catch (error) {
    console.error('Approve tenant error:', error);
    sendError(res, 'Approval failed', 500);
  }
};

const getCleanerCredentials = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return sendError(res, 'Token is required', 400);

    const delivery = await getCredentialDelivery(token);
    if (!delivery) return sendError(res, 'Invalid or expired credentials link', 400);

    await markCredentialDeliveryUsed(token);

    sendSuccess(res, {
      email: delivery.email,
      password: delivery.temp_password,
      fullName: delivery.full_name,
      companyName: delivery.company_name,
      loginUrl: `${config.frontendUrl}/login`,
    }, 'Credentials retrieved. Please save them now — this link can only be used once.');
  } catch (error) {
    console.error('Get cleaner credentials error:', error);
    sendError(res, 'Failed to retrieve credentials', 500);
  }
};

const syncPasswordFromSupabase = async (req, res) => {
  try {
    const { access_token: accessToken, password, userType } = req.body;
    if (!accessToken || !password || !userType) {
      return sendError(res, 'access_token, password, and userType are required', 400);
    }

    const verified = await verifySupabaseAccessToken(accessToken);
    if (!verified.success) {
      return sendError(res, 'Invalid or expired session', 401);
    }

    const email = verified.user?.email;
    if (!email) return sendError(res, 'Could not resolve user email', 400);

    const user = await findUser(userType, email);
    if (!user) return sendError(res, 'User not found in application', 404);

    const table = USER_TABLES[userType].table;
    const passwordHash = await hashPassword(password);
    await pool.query(`UPDATE ${table} SET password_hash = ? WHERE id = ?`, [passwordHash, user.id]);

    if (userType === 'cleaner') {
      await pool.query(`UPDATE cleaners SET must_change_password = FALSE WHERE id = ?`, [user.id]);
    }

    sendSuccess(res, null, 'Password synced successfully');
  } catch (error) {
    console.error('Sync password error:', error);
    sendError(res, 'Password sync failed', 500);
  }
};

module.exports = {
  login,
  registerTenant,
  registerCustomer,
  verifyEmail,
  verifyEmailByAddress,
  resendVerification,
  requestApproval,
  approveTenantByToken,
  forgotPassword,
  resetPassword,
  syncPasswordFromSupabase,
  getCleanerCredentials,
  changePassword,
  getMe,
  generateRandomPassword,
};
