const { body } = require('express-validator');
const router = require('express').Router();
const tenantController = require('../controllers/tenantController');
const cleanerController = require('../controllers/cleanerController');
const bookingController = require('../controllers/bookingController');
const paymentController = require('../controllers/paymentController');
const reviewController = require('../controllers/reviewController');
const reportController = require('../controllers/reportController');
const productController = require('../controllers/productController');
const productOrderController = require('../controllers/productOrderController');
const { authenticate, authorize, tenantScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const upload = require('../middleware/upload');
const { setUploadType } = require('../middleware/setUploadType');

router.use(authenticate, authorize('tenant'), tenantScope);

router.get('/dashboard', tenantController.getDashboard);

router.get('/company', tenantController.getCompanyProfile);
router.put('/company', upload.single('logo'), tenantController.updateCompanyProfile);

router.get('/services', tenantController.getServices);
router.post('/services', upload.single('image'), [
  body('name').notEmpty(),
  body('price').isFloat({ min: 0 }),
  validate,
], tenantController.createService);
router.put('/services/:id', upload.single('image'), tenantController.updateService);
router.delete('/services/:id', tenantController.deleteService);

router.get('/cleaners', cleanerController.getCleaners);
router.post('/cleaners', [
  body('full_name').notEmpty(),
  body('email').isEmail(),
  validate,
], cleanerController.createCleaner);
router.put('/cleaners/:id', upload.single('photo'), cleanerController.updateCleaner);
router.delete('/cleaners/:id', cleanerController.deleteCleaner);
router.post('/cleaners/:id/reset-password', cleanerController.resetCleanerPassword);

router.get('/bookings', bookingController.getBookings);
router.patch('/bookings/:id', bookingController.updateBookingStatus);

router.get('/payments', paymentController.getPayments);
router.patch('/payments/:id/confirm', paymentController.confirmPayment);

router.get('/products', productController.getTenantProducts);
router.post('/products', setUploadType('products'), upload.single('image'), [
  body('name').notEmpty(),
  body('price').isFloat({ min: 0 }),
  validate,
], productController.createProduct);
router.put('/products/:id', setUploadType('products'), upload.single('image'), productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

router.get('/product-orders', productOrderController.getTenantProductOrders);
router.patch('/product-orders/:id/confirm', productOrderController.confirmProductOrder);
router.patch('/product-orders/:id/deliver', productOrderController.markProductOrderDelivered);

router.get('/reviews', reviewController.getReviews);
router.post('/reviews/:id/reply', reviewController.replyToReview);
router.delete('/reviews/:id', reviewController.deleteReview);

router.get('/customers', tenantController.getCustomers);
router.patch('/customers/:id/blacklist', tenantController.toggleCustomerBlacklist);

router.get('/reports', reportController.generateReport);
router.get('/reports/export/excel', reportController.exportExcel);
router.get('/reports/export/pdf', reportController.exportPDF);

module.exports = router;
