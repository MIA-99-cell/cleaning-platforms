const router = require('express').Router();
const controller = require('../controllers/superAdminController');
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('super_admin'));

router.get('/dashboard', controller.getDashboard);
router.get('/companies', controller.getCompanies);
router.patch('/companies/:id/status', controller.updateCompanyStatus);
router.delete('/companies/:id', controller.deleteCompany);
router.post('/announcements', controller.sendAnnouncement);

router.get('/reports', reportController.generateReport);
router.get('/reports/export/excel', reportController.exportExcel);
router.get('/reports/export/pdf', reportController.exportPDF);

module.exports = router;
