const { body } = require('express-validator');
const router = require('express').Router();
const bookingController = require('../controllers/bookingController');
const paymentController = require('../controllers/paymentController');
const reviewController = require('../controllers/reviewController');
const searchController = require('../controllers/searchController');
const productController = require('../controllers/productController');
const productOrderController = require('../controllers/productOrderController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.get('/companies', searchController.searchCompanies);
router.get('/services', searchController.searchServices);
router.get('/products', productController.listMarketplaceProducts);

router.use(authenticate, authorize('customer'));

router.get('/dashboard', searchController.getCustomerDashboard);
router.get('/bookings', bookingController.getCustomerBookings);
router.post('/bookings', [
  body('service_id').isInt(),
  body('scheduled_date').notEmpty(),
  body('scheduled_time').notEmpty(),
  body('address').notEmpty(),
  validate,
], bookingController.createBooking);

router.post('/payments', [
  body('booking_id').isInt(),
  body('payment_method').isIn(['mobile_money', 'card', 'cash', 'flutterwave']),
  validate,
], paymentController.createPayment);
router.get('/payments', paymentController.getCustomerPayments);

router.post('/reviews', [
  body('booking_id').isInt(),
  body('company_rating').isInt({ min: 1, max: 5 }),
  validate,
], reviewController.createReview);

router.post('/product-orders', [
  body('product_id').isInt(),
  body('payment_method').isIn(['cash_on_delivery', 'mobile_money', 'flutterwave']),
  body('delivery_address').notEmpty(),
  body('contact_email').optional().isEmail(),
  validate,
], productOrderController.createProductOrder);
router.post('/product-orders/cart', [
  body('items').isArray({ min: 1 }),
  body('payment_method').isIn(['cash_on_delivery', 'mobile_money', 'flutterwave']),
  body('delivery_address').notEmpty(),
  body('contact_email').optional().isEmail(),
  validate,
], productOrderController.createCartProductOrders);
router.get('/product-orders', productOrderController.getCustomerProductOrders);

module.exports = router;
