const express = require('express');
const router = express.Router();
const { handleWebsiteChat } = require('./ai.controller');

// Public Website Chat Endpoint
router.post('/website-chat', handleWebsiteChat);

module.exports = router;
