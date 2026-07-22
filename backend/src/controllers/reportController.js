const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { logError } = require('../utils/logger');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const getReportData = async (tenantId, reportType, startDate, endDate) => {
  const dateFilter = startDate && endDate ? 'AND b.created_at BETWEEN ? AND ?' : '';
  const dateParams = startDate && endDate ? [startDate, endDate] : [];
  const tenantFilter = tenantId ? 'AND b.tenant_id = ?' : '';
  const tenantParam = tenantId ? [tenantId] : [];

  switch (reportType) {
    case 'bookings': {
      const [bookings] = await pool.query(
        `SELECT b.id, b.scheduled_date, b.scheduled_time, b.total_amount, bs.name AS status,
          s.name AS service, c.full_name AS customer, co.company_name
         FROM bookings b
         JOIN booking_status bs ON b.status_id = bs.id
         JOIN services s ON b.service_id = s.id
         JOIN customers c ON b.customer_id = c.id
         LEFT JOIN companies co ON b.tenant_id = co.tenant_id
         WHERE 1=1 ${tenantFilter} ${dateFilter}
         ORDER BY b.created_at DESC`,
        [...tenantParam, ...dateParams]
      );
      return bookings;
    }

    case 'revenue': {
      const paymentTenantFilter = tenantId ? 'AND p.tenant_id = ?' : '';
      const paymentDateFilter = startDate && endDate ? 'AND p.created_at BETWEEN ? AND ?' : '';
      const [revenue] = await pool.query(
        `SELECT p.id, p.amount, p.payment_method, p.status, p.created_at,
          c.full_name AS customer, s.name AS service
         FROM payments p
         JOIN bookings b ON p.booking_id = b.id
         JOIN customers c ON p.customer_id = c.id
         JOIN services s ON b.service_id = s.id
         WHERE p.status IN ('successful', 'confirmed') ${paymentTenantFilter} ${paymentDateFilter}
         ORDER BY p.created_at DESC`,
        [...tenantParam, ...dateParams]
      );
      return revenue;
    }

    case 'cleaners': {
      const cleanerTenantFilter = tenantId ? 'AND cl.tenant_id = ?' : '';
      const [cleaners] = await pool.query(
        `SELECT cl.full_name, cl.email, cl.performance_rating, cl.total_jobs_completed, cl.status,
          (SELECT COUNT(*) FROM cleaner_assignments ca WHERE ca.cleaner_id = cl.id AND ca.status = 'completed') AS completed_assignments
         FROM cleaners cl
         WHERE 1=1 ${cleanerTenantFilter}
         ORDER BY cl.total_jobs_completed DESC`,
        tenantParam
      );
      return cleaners;
    }

    case 'customers': {
      if (!tenantId) {
        const [customers] = await pool.query(
          `SELECT c.full_name, c.email, c.phone,
            COUNT(DISTINCT b.id) AS total_bookings,
            COALESCE(SUM(CASE WHEN p.status IN ('successful', 'confirmed') THEN p.amount ELSE 0 END), 0) AS total_spent
           FROM customers c
           INNER JOIN bookings b ON b.customer_id = c.id
           LEFT JOIN payments p ON p.booking_id = b.id
           GROUP BY c.id, c.full_name, c.email, c.phone
           HAVING COUNT(DISTINCT b.id) > 0
           ORDER BY total_spent DESC`
        );
        return customers;
      }

      const [customers] = await pool.query(
        `SELECT c.full_name, c.email, c.phone,
          COUNT(DISTINCT b.id) AS total_bookings,
          COALESCE(SUM(CASE WHEN p.status IN ('successful', 'confirmed') THEN p.amount ELSE 0 END), 0) AS total_spent
         FROM customers c
         INNER JOIN bookings b ON b.customer_id = c.id AND b.tenant_id = ?
         LEFT JOIN payments p ON p.booking_id = b.id
         GROUP BY c.id, c.full_name, c.email, c.phone
         HAVING COUNT(DISTINCT b.id) > 0
         ORDER BY total_spent DESC`,
        [tenantId]
      );
      return customers;
    }

    default:
      return [];
  }
};

const generateReport = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query;
    const tenantId = req.user.role === 'super_admin' ? req.query.tenant_id : req.tenantId;

    const data = await getReportData(tenantId, reportType, startDate, endDate);
    sendSuccess(res, data);
  } catch (error) {
    logError('report.generateReport', error);
    sendError(res, 'Failed to generate report', 500);
  }
};

const exportExcel = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query;
    const tenantId = req.user.role === 'super_admin' ? req.query.tenant_id : req.tenantId;
    const data = await getReportData(tenantId, reportType, startDate, endDate);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(reportType);

    if (data.length) {
      sheet.columns = Object.keys(data[0]).map((key) => ({ header: key, key, width: 20 }));
      data.forEach((row) => sheet.addRow(row));
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logError('report.exportExcel', error);
    if (res.headersSent) {
      res.destroy(error);
    } else {
      sendError(res, 'Failed to export Excel', 500);
    }
  }
};

const exportPDF = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query;
    const tenantId = req.user.role === 'super_admin' ? req.query.tenant_id : req.tenantId;
    const data = await getReportData(tenantId, reportType, startDate, endDate);

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report.pdf`);
    doc.pipe(res);

    doc.fontSize(18).text(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, { align: 'center' });
    doc.moveDown();

    data.forEach((row, i) => {
      doc.fontSize(10).text(`${i + 1}. ${JSON.stringify(row)}`);
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (error) {
    logError('report.exportPDF', error);
    if (res.headersSent) {
      res.destroy(error);
    } else {
      sendError(res, 'Failed to export PDF', 500);
    }
  }
};

module.exports = { generateReport, exportExcel, exportPDF };
