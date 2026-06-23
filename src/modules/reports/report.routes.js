const express = require('express');
const router = express.Router();
const { getDailyReport } = require('./report.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);

// Only Managers and Admins can view reports
router.get('/daily', roleGuard('SUPER_ADMIN', 'ADMIN', 'MANAGER'), getDailyReport);

module.exports = router;
