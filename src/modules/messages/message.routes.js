const express = require('express');
const router = express.Router();
const { getConversations, getMessages, sendMessage, markAsRead, addNote } = require('./message.controller');
const { verifyToken } = require('../../middleware/auth.middleware');

router.use(verifyToken);

router.get('/conversations', getConversations);
router.get('/', getMessages);
router.post('/', sendMessage);
router.post('/note', addNote);
router.put('/:conversationId/read', markAsRead);

module.exports = router;
