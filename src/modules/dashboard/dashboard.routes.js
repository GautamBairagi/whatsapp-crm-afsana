const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('./dashboard.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);

router.get('/kpi', getDashboardStats);
router.get('/stats', getDashboardStats);

// Role-Based Specific Dashboards
router.get('/superadmin', roleGuard('SUPER_ADMIN'), getDashboardStats);
router.get('/admin', roleGuard('ADMIN', 'SUPER_ADMIN'), getDashboardStats);
router.get('/manager', roleGuard('MANAGER', 'SUPER_ADMIN'), getDashboardStats);
router.get('/teamleader', roleGuard('TEAM_LEADER', 'SUPER_ADMIN'), getDashboardStats);
router.get('/counselor', roleGuard('COUNSELOR', 'SUPER_ADMIN'), getDashboardStats);
router.get('/support', roleGuard('SUPPORT', 'SUPER_ADMIN'), getDashboardStats);

module.exports = router;
