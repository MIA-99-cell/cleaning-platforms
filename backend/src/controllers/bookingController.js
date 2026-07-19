const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { paginate } = require('../utils/auth');
const { sendCleanerJobAssignmentEmail } = require('../services/cleanerEmailService');
const { notifyServiceBookingPlaced, notifyServiceCompleted } = require('../services/bookingNotificationService');
const { storeUploadedFile } = require('../services/storageService');

const getBookings = async (req, res) => {
  try {
    const { page, limit, status, date } = req.query;
    const { offset, limit: lim, page: p } = paginate(page, limit);

    let where = 'b.tenant_id = ?';
    const params = [req.tenantId];
    if (status) { where += ' AND bs.name = ?'; params.push(status); }
    if (date) { where += ' AND b.scheduled_date = ?'; params.push(date); }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM bookings b JOIN booking_status bs ON b.status_id = bs.id WHERE ${where}`,
      params
    );

    const [bookings] = await pool.query(
      `SELECT b.*, bs.name AS status, s.name AS service_name, c.full_name AS customer_name, c.phone AS customer_phone,
        cl.full_name AS cleaner_name, ca.status AS assignment_status
       FROM bookings b
       JOIN booking_status bs ON b.status_id = bs.id
       JOIN services s ON b.service_id = s.id
       JOIN customers c ON b.customer_id = c.id
       LEFT JOIN cleaner_assignments ca ON ca.booking_id = b.id
       LEFT JOIN cleaners cl ON ca.cleaner_id = cl.id
       WHERE ${where}
       ORDER BY b.scheduled_date DESC, b.scheduled_time DESC
       LIMIT ? OFFSET ?`,
      [...params, lim, offset]
    );

    sendPaginated(res, bookings, { page: p, limit: lim, total });
  } catch (error) {
    sendError(res, 'Failed to fetch bookings', 500);
  }
};

const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, cleaner_id, rejection_reason, cancellation_reason } = req.body;

    const statusMap = {
      accept: 'accepted',
      reject: 'rejected',
      cancel: 'cancelled',
      complete: 'completed',
      assign: 'assigned',
    };

    const statusName = statusMap[action];
    if (!statusName) return sendError(res, 'Invalid action', 400);

    const [statusRow] = await pool.query('SELECT id FROM booking_status WHERE name = ?', [statusName]);
    if (!statusRow.length) return sendError(res, 'Invalid status', 400);

    const updates = { status_id: statusRow[0].id };
    if (rejection_reason) updates.rejection_reason = rejection_reason;
    if (cancellation_reason) updates.cancellation_reason = cancellation_reason;
    if (action === 'complete') updates.completed_at = new Date();

    const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    await pool.query(
      `UPDATE bookings SET ${setClause} WHERE id = ? AND tenant_id = ?`,
      [...Object.values(updates), id, req.tenantId]
    );

    if (action === 'complete') {
      notifyServiceCompleted({ bookingId: id }).catch((err) => {
        console.error('[Completion Notify] Failed:', err.message);
      });
    }

    if (action === 'assign' && cleaner_id) {
      await pool.query(
        `INSERT INTO cleaner_assignments (tenant_id, booking_id, cleaner_id) VALUES (?, ?, ?)
         ON CONFLICT (booking_id, cleaner_id) DO UPDATE SET cleaner_id = EXCLUDED.cleaner_id, status = 'assigned'`,
        [req.tenantId, id, cleaner_id]
      );

      await pool.query(
        `INSERT INTO notifications (tenant_id, user_type, user_id, title, message, type)
         VALUES (?, 'cleaner', ?, 'New Job Assignment', 'You have been assigned a new cleaning job', 'info')`,
        [req.tenantId, cleaner_id]
      );

      const [assignmentDetails] = await pool.query(
        `SELECT cl.full_name AS cleaner_name, cl.email AS cleaner_email,
                s.name AS service_name, co.company_name,
                b.scheduled_date, b.scheduled_time, b.address, b.special_instructions,
                cu.full_name AS customer_name
         FROM bookings b
         JOIN services s ON b.service_id = s.id
         JOIN companies co ON b.tenant_id = co.tenant_id
         JOIN customers cu ON b.customer_id = cu.id
         JOIN cleaners cl ON cl.id = ?
         WHERE b.id = ? AND b.tenant_id = ?`,
        [cleaner_id, id, req.tenantId]
      );

      const details = assignmentDetails[0];
      if (details?.cleaner_email) {
        sendCleanerJobAssignmentEmail({
          cleanerName: details.cleaner_name,
          cleanerEmail: details.cleaner_email,
          companyName: details.company_name,
          serviceName: details.service_name,
          scheduledDate: details.scheduled_date,
          scheduledTime: details.scheduled_time,
          address: details.address,
          customerName: details.customer_name,
          specialInstructions: details.special_instructions,
        }).catch((err) => {
          console.error('[Cleaner Email] Job assignment send error:', err.message);
        });
      }
    }

    sendSuccess(res, null, `Booking ${action}ed successfully`);
  } catch (error) {
    sendError(res, 'Failed to update booking', 500);
  }
};

const createBooking = async (req, res) => {
  try {
    const { service_id, scheduled_date, scheduled_time, address, special_instructions } = req.body;
    const customerId = req.user.id;

    const [service] = await pool.query(
      'SELECT s.*, c.tenant_id FROM services s JOIN companies c ON s.tenant_id = c.tenant_id WHERE s.id = ? AND s.is_active = TRUE',
      [service_id]
    );
    if (!service.length) return sendError(res, 'Service not found', 404);

    const [customer] = await pool.query('SELECT is_blacklisted FROM customers WHERE id = ?', [customerId]);
    if (customer[0]?.is_blacklisted) return sendError(res, 'You are not allowed to make bookings', 403);

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

    sendSuccess(res, { id: result.insertId }, 'Booking created successfully', 201);
  } catch (error) {
    console.error('createBooking error:', error.message);
    sendError(res, 'Failed to create booking', 500);
  }
};

const getCleanerJobs = async (req, res) => {
  try {
    const cleanerId = req.user.id;
    const { status } = req.query;

    let where = 'ca.cleaner_id = ?';
    const params = [cleanerId];
    if (status) { where += ' AND ca.status = ?'; params.push(status); }

    const [jobs] = await pool.query(
      `SELECT b.*, bs.name AS booking_status, s.name AS service_name, c.full_name AS customer_name,
        c.phone AS customer_phone, ca.id AS assignment_id, ca.status AS assignment_status, ca.notes, ca.completion_photo_url
       FROM cleaner_assignments ca
       JOIN bookings b ON ca.booking_id = b.id
       JOIN booking_status bs ON b.status_id = bs.id
       JOIN services s ON b.service_id = s.id
       JOIN customers c ON b.customer_id = c.id
       WHERE ${where}
       ORDER BY b.scheduled_date ASC, b.scheduled_time ASC`,
      params
    );

    sendSuccess(res, jobs);
  } catch (error) {
    sendError(res, 'Failed to fetch jobs', 500);
  }
};

const updateJobStatus = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { action, notes } = req.body;
    const cleanerId = req.user.id;

    const validActions = ['accepted', 'rejected', 'in_progress', 'completed'];
    if (!validActions.includes(action)) return sendError(res, 'Invalid action', 400);

    const [assignment] = await pool.query(
      'SELECT * FROM cleaner_assignments WHERE id = ? AND cleaner_id = ?',
      [assignmentId, cleanerId]
    );
    if (!assignment.length) return sendError(res, 'Assignment not found', 404);

    const updates = { status: action };
    if (action === 'in_progress') updates.started_at = new Date();
    if (action === 'completed') updates.completed_at = new Date();
    if (notes) updates.notes = notes;

    const completion_photo_url = req.file ? await storeUploadedFile(req.file, 'completions') : undefined;
    if (completion_photo_url) updates.completion_photo_url = completion_photo_url;

    const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    await pool.query(
      `UPDATE cleaner_assignments SET ${setClause} WHERE id = ?`,
      [...Object.values(updates), assignmentId]
    );

    if (action === 'completed') {
      const [completedStatus] = await pool.query("SELECT id FROM booking_status WHERE name = 'completed'");
      await pool.query('UPDATE bookings SET status_id = ?, completed_at = NOW() WHERE id = ?', [
        completedStatus[0].id,
        assignment[0].booking_id,
      ]);
      await pool.query(
        'UPDATE cleaners SET total_jobs_completed = total_jobs_completed + 1 WHERE id = ?',
        [cleanerId]
      );

      notifyServiceCompleted({ bookingId: assignment[0].booking_id }).catch((err) => {
        console.error('[Completion Notify] Failed:', err.message);
      });
    }

    sendSuccess(res, null, 'Job status updated');
  } catch (error) {
    sendError(res, 'Failed to update job', 500);
  }
};

const getCustomerBookings = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { status } = req.query;

    let where = 'b.customer_id = ?';
    const params = [customerId];
    if (status) { where += ' AND bs.name = ?'; params.push(status); }

    const [bookings] = await pool.query(
      `SELECT b.*, bs.name AS status, s.name AS service_name, co.company_name,
        (SELECT cl.full_name FROM cleaner_assignments ca
         JOIN cleaners cl ON ca.cleaner_id = cl.id
         WHERE ca.booking_id = b.id
         ORDER BY ca.created_at DESC LIMIT 1) AS cleaner_name,
        (SELECT id FROM reviews r WHERE r.booking_id = b.id LIMIT 1) AS review_id,
        (SELECT CASE WHEN p.status = 'successful' THEN 'confirmed' ELSE p.status END FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status
       FROM bookings b
       JOIN booking_status bs ON b.status_id = bs.id
       JOIN services s ON b.service_id = s.id
       LEFT JOIN companies co ON b.tenant_id = co.tenant_id
       WHERE ${where}
       ORDER BY b.scheduled_date DESC, b.scheduled_time DESC`,
      params
    );

    sendSuccess(res, bookings);
  } catch (error) {
    console.error('getCustomerBookings error:', error.message);
    sendError(res, 'Failed to fetch bookings', 500);
  }
};

module.exports = {
  getBookings,
  updateBookingStatus,
  createBooking,
  getCleanerJobs,
  updateJobStatus,
  getCustomerBookings,
};
