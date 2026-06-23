const express = require('express');
const router = express.Router();
const { getLeads, getLead, createLead, updateLead, deleteLead } = require('./lead.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');
const { logActivity } = require('../../middleware/activity.middleware');

router.post('/public', createLead);

router.use(verifyToken);

router.get('/', getLeads);
router.get('/:id', getLead);
router.post('/', roleGuard('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CUSTOMER_SUPPORT'), logActivity('Created Lead'), createLead);
router.put('/:id', logActivity('Updated Lead'), updateLead);
router.delete('/:id', roleGuard('SUPER_ADMIN'), logActivity('Deleted Lead'), deleteLead);

module.exports = router;
