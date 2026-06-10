const express = require('express');
const router = express.Router();
const {
    getLeads, createLead, updateLead, deleteLead,
    exportLeads, assignLead, autoAssignLeads
} = require('./lead.controller');
const { verifyToken, roleGuard, scopeLeads } = require('../../middleware/auth.middleware');
const { checkLeadQuota } = require('../../middleware/quota.middleware');
const { auditLog } = require('../../middleware/audit.middleware');

// All routes require authentication + role scope
router.get('/', verifyToken, scopeLeads, getLeads);
router.post('/', verifyToken, roleGuard('ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'MANAGER'), checkLeadQuota, auditLog('CREATE_LEAD', 'leads'), createLead);
router.post('/export', verifyToken, scopeLeads, exportLeads);
router.post('/auto-assign', verifyToken, roleGuard('ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER'), autoAssignLeads);
router.put('/:id', verifyToken, scopeLeads, updateLead);
router.put('/:id/assign', verifyToken, roleGuard('TEAM_LEADER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'), assignLead);
router.delete('/:id', verifyToken, roleGuard('SUPER_ADMIN', 'ADMIN'), deleteLead);

module.exports = router;
