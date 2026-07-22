const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { logError } = require('../utils/logger');

const getNotifications = async (req, res) => {
  try {
    const { role, id, tenantId } = req.user;

    const [notifications] = await pool.query(
      `SELECT * FROM notifications
       WHERE (user_type = ? AND user_id = ?)
          OR (user_type = ? AND (tenant_id = ? OR tenant_id IS NULL))
          OR user_type = 'all'
       ORDER BY created_at DESC
       LIMIT 50`,
      [role, id, role, tenantId || null]
    );

    sendSuccess(res, notifications);
  } catch (error) {
    logError('notification.getNotifications', error);
    sendError(res, 'Failed to fetch notifications', 500);
  }
};

const markAsRead = async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [req.params.id]);
    sendSuccess(res, null, 'Marked as read');
  } catch (error) {
    logError('notification.markAsRead', error);
    sendError(res, 'Failed to update notification', 500);
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const { role, id } = req.user;
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_type = ? AND user_id = ? AND is_read = FALSE`,
      [role, id]
    );
    sendSuccess(res, null, 'All marked as read');
  } catch (error) {
    logError('notification.markAllAsRead', error);
    sendError(res, 'Failed to update notifications', 500);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead };
