const { body } = require('express-validator');
const router = require('express').Router();
const guestController = require('../controllers/guestController');
const searchController = require('../controllers/searchController');
const productController = require('../controllers/productController');
const { validate } = require('../middleware/validate');

router.get('/services', searchController.listPublicServices);
router.get('/products', productController.listMarketplaceProducts);

router.post('/bookings', [  body('full_name').notEmpty(),
  body('email').isEmail(),
  body('phone').notEmpty(),
  body('service_id').isInt(),
  body('scheduled_date').notEmpty(),
  body('scheduled_time').notEmpty(),
  body('address').notEmpty(),
  validate,
], guestController.createGuestBooking);

router.post('/payments', [
  body('booking_id').isInt(),
  body('email').isEmail(),
  body('payment_method').isIn(['mobile_money', 'card', 'cash', 'flutterwave']),
  validate,
], guestController.createGuestPayment);

router.post('/flutterwave/initiate/booking', [
  body('booking_id').isInt(),
  body('email').isEmail(),
  body('phone').notEmpty(),
  body('network').optional().isString(),
  validate,
], guestController.initiateGuestBookingFlutterwave);

router.post('/product-orders/cart', [
  body('full_name').notEmpty(),
  body('email').isEmail(),
  body('items').isArray({ min: 1 }),
  body('payment_method').isIn(['cash_on_delivery', 'mobile_money', 'flutterwave']),
  body('delivery_address').notEmpty(),
  body('delivery_phone').notEmpty(),
  validate,
], guestController.createGuestCartOrders);

router.post('/flutterwave/initiate/product-order', [
  body('order_group_id').notEmpty(),
  body('email').isEmail(),
  body('phone').notEmpty(),
  body('network').optional().isString(),
  validate,
], guestController.initiateGuestProductOrderFlutterwave);

module.exports = router;
