const { body } = require('express-validator');
const router = require('express').Router();
const flutterwaveController = require('../controllers/flutterwaveController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Browser return from Flutterwave → bounce to local frontend
router.get('/return/:ref', (req, res) => {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const ref = encodeURIComponent(req.params.ref || '');
  return res.redirect(302, `${frontend}/payment/return/${ref}`);
});

router.post('/initiate/booking', authenticate, authorize('customer'), [
  body('booking_id').isInt(),
  body('phone').notEmpty(),
  body('network').optional().isString(),
  body('contact_email').optional().isEmail(),
  validate,
], flutterwaveController.initiateBookingPayment);

router.post('/initiate/product-order', authenticate, authorize('customer'), [
  body('order_group_id').notEmpty(),
  body('phone').notEmpty(),
  body('network').optional().isString(),
  body('contact_email').optional().isEmail(),
  validate,
], flutterwaveController.initiateProductOrderPayment);

router.get('/verify/:ref', flutterwaveController.verifyPayment);

module.exports = router;
