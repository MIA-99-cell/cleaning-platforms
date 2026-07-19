const pool = require('../config/database');
const { hashPassword, generateRandomPassword } = require('../utils/auth');
const { sendCleanerCredentialsEmail } = require('../services/cleanerEmailService');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { paginate } = require('../utils/auth');
const { storeUploadedFile } = require('../services/storageService');

const getCleaners = async (req, res) => {
  try {
    const { page, limit, status, search } = req.query;
    const { offset, limit: lim, page: p } = paginate(page, limit);

    let where = 'tenant_id = ?';
    const params = [req.tenantId];
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (search) { where += ' AND (full_name LIKE ? OR email LIKE ?)'; const s = `%${search}%`; params.push(s, s); }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM cleaners WHERE ${where}`, params);
    const [cleaners] = await pool.query(
      `SELECT id, email, full_name, phone, photo_url, status, performance_rating, total_jobs_completed, created_at
       FROM cleaners WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, lim, offset]
    );

    sendPaginated(res, cleaners, { page: p, limit: lim, total });
  } catch (error) {
    sendError(res, 'Failed to fetch cleaners', 500);
  }
};

const createCleaner = async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    const tenantId = req.tenantId;

    const [existing] = await pool.query('SELECT id FROM cleaners WHERE tenant_id = ? AND email = ?', [tenantId, email]);
    if (existing.length) return sendError(res, 'Cleaner email already exists', 409);

    const tempPassword = generateRandomPassword();
    const passwordHash = await hashPassword(tempPassword);

    const [result] = await pool.query(
      `INSERT INTO cleaners (tenant_id, email, password_hash, full_name, phone, must_change_password)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [tenantId, email, passwordHash, full_name, phone]
    );

    const [company] = await pool.query('SELECT company_name FROM companies WHERE tenant_id = ?', [tenantId]);
    const companyName = company[0]?.company_name || 'Cleaning Company';

    let emailSent = false;
    let emailError = null;
    let emailResult = {};
    if (req.body.send_email !== false) {
      try {
        emailResult = await sendCleanerCredentialsEmail({
          name: full_name,
          email,
          password: tempPassword,
          companyName,
          isReset: false,
        });
        emailSent = emailResult.emailSent;
        emailError = emailResult.error || null;

        if (!emailSent) {
          console.log(`[Dev] Cleaner credentials for ${email}:`);
          console.log(`  Password: ${tempPassword}`);
          console.error('[Cleaner Email] Reason:', emailError || 'unknown');
        }
      } catch (emailErr) {
        emailError = emailErr.message;
        console.error('Cleaner email error:', emailErr.message);
      }
    }

    sendSuccess(res, {
      id: result.insertId,
      email,
      tempPassword,
      emailSent,
      emailError,
    }, emailSent
      ? 'Cleaner created. Password sent to their email.'
      : 'Cleaner created. Email not sent — share the password below.', 201);
  } catch (error) {
    console.error('Create cleaner error:', error);
    sendError(res, 'Failed to create cleaner', 500);
  }
};

const updateCleaner = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, status } = req.body;
    const photo_url = req.file ? await storeUploadedFile(req.file, 'cleaners') : undefined;

    const updates = [];
    const params = [];
    if (full_name) { updates.push('full_name = ?'); params.push(full_name); }
    if (phone) { updates.push('phone = ?'); params.push(phone); }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (photo_url) { updates.push('photo_url = ?'); params.push(photo_url); }

    if (updates.length) {
      params.push(id, req.tenantId);
      await pool.query(`UPDATE cleaners SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
    }

    sendSuccess(res, null, 'Cleaner updated');
  } catch (error) {
    sendError(res, 'Failed to update cleaner', 500);
  }
};

const deleteCleaner = async (req, res) => {
  try {
    await pool.query('DELETE FROM cleaners WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
    sendSuccess(res, null, 'Cleaner deleted');
  } catch (error) {
    sendError(res, 'Failed to delete cleaner', 500);
  }
};

const resetCleanerPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const tempPassword = generateRandomPassword();
    const passwordHash = await hashPassword(tempPassword);

    const [cleaner] = await pool.query('SELECT * FROM cleaners WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    if (!cleaner.length) return sendError(res, 'Cleaner not found', 404);

    await pool.query(
      'UPDATE cleaners SET password_hash = ?, must_change_password = TRUE WHERE id = ?',
      [passwordHash, id]
    );

    const [company] = await pool.query('SELECT company_name FROM companies WHERE tenant_id = ?', [req.tenantId]);
    const companyName = company[0]?.company_name || 'Company';
    let emailSent = false;
    let emailError = null;
    let emailResult = {};
    try {
      emailResult = await sendCleanerCredentialsEmail({
        name: cleaner[0].full_name,
        email: cleaner[0].email,
        password: tempPassword,
        companyName,
        isReset: true,
      });
      emailSent = emailResult.emailSent;
      emailError = emailResult.error || null;

      if (!emailSent) {
        console.log(`[Dev] Reset password for ${cleaner[0].email}: ${tempPassword}`);
        console.error('[Cleaner Email] Reason:', emailError || 'unknown');
      }
    } catch (emailErr) {
      emailError = emailErr.message;
      console.error('Cleaner reset email error:', emailErr.message);
    }

    sendSuccess(res, {
      email: cleaner[0].email,
      tempPassword,
      emailSent,
      emailError,
    }, emailSent ? 'New password sent to cleaner email' : 'Password reset. Email not sent — share password below');
  } catch (error) {
    sendError(res, 'Failed to reset password', 500);
  }
};

module.exports = { getCleaners, createCleaner, updateCleaner, deleteCleaner, resetCleanerPassword };
