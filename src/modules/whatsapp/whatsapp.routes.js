const express = require('express');
const router = express.Router();
const { sendMessage, getLogs, verifyWebhook, handleWebhook } = require('./whatsapp.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { logActivity } = require('../../middleware/activity.middleware');

// Public Webhook endpoints for Meta
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);

// Protected endpoints
router.post('/send', verifyToken, logActivity('Sent WhatsApp Message'), sendMessage);
router.get('/logs', verifyToken, getLogs);

module.exports = router;
