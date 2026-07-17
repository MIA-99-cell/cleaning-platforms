const router = require('express').Router();
const bookingController = require('../controllers/bookingController');
const searchController = require('../controllers/searchController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate, authorize('cleaner'));

router.get('/dashboard', searchController.getCleanerDashboard);
router.get('/jobs', bookingController.getCleanerJobs);
router.patch('/jobs/:assignmentId', upload.single('completion_photo'), bookingController.updateJobStatus);

module.exports = router;
