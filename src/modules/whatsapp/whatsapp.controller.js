const db = require('../../config/db');
const axios = require('axios');
const socketManager = require('../../sockets/socketManager');

const META_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'my_secure_verify_token_123';

// Verify Webhook
exports.verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
};

// Handle Incoming Messages
exports.handleWebhook = async (req, res) => {
    try {
        if (req.body.object) {
            if (
                req.body.entry &&
                req.body.entry[0].changes &&
                req.body.entry[0].changes[0] &&
                req.body.entry[0].changes[0].value.messages &&
                req.body.entry[0].changes[0].value.messages[0]
            ) {
                const messageData = req.body.entry[0].changes[0].value.messages[0];
                const contactData = req.body.entry[0].changes[0].value.contacts ? req.body.entry[0].changes[0].value.contacts[0] : null;
                
                const phone = messageData.from; 
                
                let messageText = '';
                let messageType = 'text';
                let mediaUrl = null;

                if (messageData.type === 'text') {
                    messageText = messageData.text.body;
                } else if (messageData.type === 'image') {
                    messageType = 'image';
                    messageText = 'Image received';
                    // Need media fetching logic here using messageData.image.id
                } else if (messageData.type === 'document') {
                    messageType = 'document';
                    messageText = 'Document received';
                } else if (messageData.type === 'audio') {
                    messageType = 'audio';
                    messageText = 'Voice note received';
                }

                const senderName = contactData ? contactData.profile.name : 'Unknown WhatsApp User';

                // 1. Check if lead exists
                let [leads] = await db.execute('SELECT id, stage, assigned_to FROM leads WHERE phone = ?', [phone]);
                let leadId;

                if (leads.length === 0) {
                    // Create new lead
                    const [result] = await db.execute(
                        'INSERT INTO leads (name, phone, source, stage) VALUES (?, ?, ?, ?)',
                        [senderName, phone, 'WHATSAPP', 'New']
                    );
                    leadId = result.insertId;
                } else {
                    leadId = leads[0].id;
                }

                // 2. Check if open conversation exists for this lead
                let [conversations] = await db.execute('SELECT id FROM conversations WHERE lead_id = ? AND source = ?', [leadId, 'WHATSAPP']);
                let conversationId;

                if (conversations.length === 0) {
                    const [convResult] = await db.execute(
                        'INSERT INTO conversations (lead_id, source, status, unread_count, last_message, last_message_time) VALUES (?, ?, ?, ?, ?, NOW())',
                        [leadId, 'WHATSAPP', 'Open', 1, messageText]
                    );
                    conversationId = convResult.insertId;
                } else {
                    conversationId = conversations[0].id;
                    await db.execute(
                        'UPDATE conversations SET unread_count = unread_count + 1, last_message = ?, last_message_time = NOW() WHERE id = ?',
                        [messageText, conversationId]
                    );
                }

                // 3. Save incoming message
                await db.execute(
                    'INSERT INTO messages (conversation_id, message, message_type, media_url, sender_type, sender_name) VALUES (?, ?, ?, ?, ?, ?)',
                    [conversationId, messageText, messageType, mediaUrl, 'Customer', senderName]
                );

                // 4. Emit socket event
                socketManager.events.inboxUpdate({ conversationId, leadId, message: messageText, sender: 'Customer' });
            }
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('Webhook Error:', error);
        res.sendStatus(500);
    }
};

// Send outgoing message via Meta API
exports.sendMessage = async (req, res, next) => {
    try {
        const { conversationId, leadId, phone, message, type = 'text', mediaUrl = null } = req.body;
        const senderId = req.user ? req.user.id : null;
        const senderName = req.user ? req.user.name : 'System';

        if (!phone || !message || !conversationId) {
             return res.status(400).json({ success: false, message: 'Missing required parameters' });
        }

        // Send via Meta API
        await sendMetaMessage(phone, message);

        // Save in DB
        await db.execute(
            'INSERT INTO messages (conversation_id, message, message_type, media_url, sender_type, sender_id, sender_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [conversationId, message, type, mediaUrl, 'Agent', senderId, senderName]
        );

        // Update conversation last message
        await db.execute(
            'UPDATE conversations SET last_message = ?, last_message_time = NOW() WHERE id = ?',
            [message, conversationId]
        );

        // Add to timeline
        await db.execute(
             'INSERT INTO activity_logs (user_id, lead_id, action, details) VALUES (?, ?, ?, ?)',
             [senderId, leadId, 'Message Sent', message]
        );

        socketManager.events.inboxUpdate({ conversationId, leadId, message, sender: 'Agent', senderName });

        res.json({ success: true, message: 'Message sent' });
    } catch (error) {
        next(error);
    }
};

// --- Helper Functions ---
async function sendMetaMessage(phone, text) {
    try {
        await axios.post(
            `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: phone,
                text: { body: text }
            },
            {
                headers: { Authorization: `Bearer ${META_TOKEN}` }
            }
        );
    } catch (e) {
        console.error('Failed to send Meta message:', e.response ? e.response.data : e.message);
    }
}

exports.getLogs = async (req, res, next) => {
    res.status(200).json({ success: true, data: [] });
};

