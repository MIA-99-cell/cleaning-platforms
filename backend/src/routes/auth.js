const { body } = require('express-validator');
const router = require('express').Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty(),
  body('userType').isIn(['super_admin', 'tenant', 'cleaner', 'customer']),
  validate,
], authController.login);

router.post('/register/tenant', [
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('full_name').notEmpty(),
  body('company_name').notEmpty().withMessage('Company name is required'),
  body('license_number').notEmpty().withMessage('License number is required'),
  validate,
], authController.registerTenant);

router.post('/register/customer', [
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('full_name').notEmpty(),
  validate,
], authController.registerCustomer);

router.post('/verify-email', [body('token').notEmpty(), validate], authController.verifyEmail);
router.post('/verify-email-by-email', [body('email').isEmail(), validate], authController.verifyEmailByAddress);

router.post('/resend-verification', [
  body('email').isEmail(),
  validate,
], authController.resendVerification);

router.post('/approve-company', [
  body('token').notEmpty(),
  validate,
], authController.approveTenantByToken);

router.post('/request-approval', [
  body('email').isEmail(),
  validate,
], authController.requestApproval);

router.post('/forgot-password', [
  body('email').isEmail(),
  body('userType').isIn(['super_admin', 'tenant', 'cleaner', 'customer']),
  validate,
], authController.forgotPassword);

router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
  body('userType').isIn(['super_admin', 'tenant', 'cleaner', 'customer']),
  validate,
], authController.resetPassword);

router.get('/cleaner-credentials', authController.getCleanerCredentials);

router.post('/sync-password', [
  body('access_token').notEmpty(),
  body('password').isLength({ min: 8 }),
  body('userType').isIn(['super_admin', 'tenant', 'cleaner', 'customer']),
  validate,
], authController.syncPasswordFromSupabase);

router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  validate,
], authController.changePassword);

router.get('/me', authenticate, authController.getMe);

module.exports = router;
