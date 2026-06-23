const db = require('../../config/db');
const axios = require('axios');
const socketManager = require('../../sockets/socketManager');

const META_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

exports.getConversations = async (req, res, next) => {
    try {
        const [conversations] = await db.execute(`
            SELECT c.*, l.name as lead_name, l.phone as lead_phone, l.assigned_to 
            FROM conversations c
            JOIN leads l ON c.lead_id = l.id
            ORDER BY c.last_message_time DESC
        `);
        res.json({ success: true, data: conversations });
    } catch (error) {
        next(error);
    }
};

exports.getMessages = async (req, res, next) => {
    try {
        const { conversationId } = req.query;
        if (!conversationId) return res.status(400).json({ success: false, message: 'conversationId is required' });

        const [messages] = await db.execute('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [conversationId]);
        res.json({ success: true, data: messages });
    } catch (error) {
        next(error);
    }
};

exports.sendMessage = async (req, res, next) => {
    try {
        const { conversationId, leadId, message, type = 'text', mediaUrl = null } = req.body;
        const senderId = req.user ? req.user.id : null;
        const senderName = req.user ? req.user.name : 'Agent';

        // Fetch lead's phone number
        const [leads] = await db.execute('SELECT phone FROM leads WHERE id = ?', [leadId]);
        if (leads.length === 0) return res.status(404).json({ success: false, message: 'Lead not found' });
        const phone = leads[0].phone;

        if (META_TOKEN && PHONE_NUMBER_ID) {
            try {
                await axios.post(
                    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
                    {
                        messaging_product: 'whatsapp',
                        to: phone,
                        text: { body: message }
                    },
                    { headers: { Authorization: `Bearer ${META_TOKEN}` } }
                );
            } catch (metaErr) {
                console.error('Failed to send Meta message:', metaErr.response ? metaErr.response.data : metaErr.message);
            }
        }

        const [result] = await db.execute(
            'INSERT INTO messages (conversation_id, message, message_type, media_url, sender_type, sender_id, sender_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [conversationId, message, type, mediaUrl, 'Agent', senderId, senderName]
        );

        await db.execute(
            'UPDATE conversations SET last_message = ?, last_message_time = NOW() WHERE id = ?',
            [message, conversationId]
        );

        await db.execute(
             'INSERT INTO activity_logs (user_id, lead_id, action, details) VALUES (?, ?, ?, ?)',
             [senderId, leadId, 'Message Sent', message]
        );

        socketManager.events.inboxUpdate({ conversationId, leadId, message, sender: 'Agent', senderName });

        res.json({ success: true, data: { id: result.insertId, conversationId, message, senderType: 'Agent' } });
    } catch (error) {
        next(error);
    }
};

exports.markAsRead = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        await db.execute('UPDATE messages SET is_read = TRUE WHERE conversation_id = ?', [conversationId]);
        await db.execute('UPDATE conversations SET unread_count = 0 WHERE id = ?', [conversationId]);
        res.json({ success: true, message: 'Messages marked as read' });
    } catch (error) {
        next(error);
    }
};

exports.addNote = async (req, res, next) => {
    try {
        const { leadId, note } = req.body;
        const userId = req.user.id;

        const [result] = await db.execute(
            'INSERT INTO notes (lead_id, user_id, note) VALUES (?, ?, ?)',
            [leadId, userId, note]
        );

        await db.execute(
             'INSERT INTO activity_logs (user_id, lead_id, action, details) VALUES (?, ?, ?, ?)',
             [userId, leadId, 'Note Added', note]
        );

        res.json({ success: true, data: { id: result.insertId, leadId, note } });
    } catch (error) {
        next(error);
    }
};
