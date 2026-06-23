const db = require('../../config/db');
const axios = require('axios');
const socketManager = require('../../sockets/socketManager');

const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Memory storage for simple session handling (In production, use Redis or DB)
const chatSessions = {};

const SYSTEM_PROMPT = `You are an education counselor assistant for a student counseling website.
Your goal is to collect the following details from the user sequentially, ONE AT A TIME:
1. Name
2. Phone Number
3. Email Address
4. Interested Country
5. Highest Qualification
6. IELTS Score (if any, otherwise 'None')

DO NOT ask for multiple details at once. Be conversational, friendly, and concise.
Once you have ALL the details, your final message must include the exact text: "[LEAD_COMPLETE]" followed by a summary of the details in JSON format like this:
{"name": "...", "phone": "...", "email": "...", "country": "...", "qualification": "...", "ielts": "..."}
If the user asks questions outside of this, politely guide them back to providing their details.`;

exports.handleWebsiteChat = async (req, res, next) => {
    try {
        const { sessionId, message } = req.body;

        if (!sessionId || !message) {
            return res.status(400).json({ success: false, message: 'Session ID and message are required' });
        }

        // Initialize session if not exists
        if (!chatSessions[sessionId]) {
            chatSessions[sessionId] = [
                { role: 'system', content: SYSTEM_PROMPT }
            ];
        }

        // Add user message to history
        chatSessions[sessionId].push({ role: 'user', content: message });

        // Call OpenAI API
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: chatSessions[sessionId]
            },
            {
                headers: { Authorization: `Bearer ${OPENAI_KEY}` }
            }
        );

        const aiReply = response.data.choices[0].message.content;

        // Check if lead collection is complete
        if (aiReply.includes('[LEAD_COMPLETE]')) {
            try {
                // Extract JSON from reply
                const jsonStrMatch = aiReply.match(/\\{.*\\}/s);
                if (jsonStrMatch) {
                    const leadData = JSON.parse(jsonStrMatch[0]);

                    // Insert Lead into DB
                    const [result] = await db.execute(
                        `INSERT INTO leads (name, phone, email, country, source, stage, qualification, ielts_score) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            leadData.name || 'Unknown', 
                            leadData.phone || 'Unknown', 
                            leadData.email || null, 
                            leadData.country || null, 
                            'AI_CHAT', 
                            'New', 
                            leadData.qualification || null, 
                            leadData.ielts || null
                        ]
                    );

                    const leadId = result.insertId;

                    // Create open conversation for Shared Inbox
                    const [convResult] = await db.execute(
                        'INSERT INTO conversations (lead_id, source, status, unread_count, last_message, last_message_time) VALUES (?, ?, ?, ?, ?, NOW())',
                        [leadId, 'WEBSITE', 'Open', 1, 'New AI Lead Generated']
                    );
                    
                    const conversationId = convResult.insertId;

                    // Save the chat history as messages
                    for (const msg of chatSessions[sessionId]) {
                        if (msg.role !== 'system') {
                            const senderType = msg.role === 'user' ? 'Customer' : 'Bot';
                            const senderName = msg.role === 'user' ? (leadData.name || 'Website Visitor') : 'AI Assistant';
                            let textToSave = msg.content;
                            if (textToSave.includes('[LEAD_COMPLETE]')) {
                                textToSave = "Lead details successfully collected and forwarded to a counselor.";
                            }

                            await db.execute(
                                'INSERT INTO messages (conversation_id, message, message_type, sender_type, sender_name) VALUES (?, ?, ?, ?, ?)',
                                [conversationId, textToSave, 'text', senderType, senderName]
                            );
                        }
                    }

                    await db.execute(
                        'INSERT INTO activity_logs (user_id, lead_id, action, details) VALUES (?, ?, ?, ?)',
                        [null, leadId, 'Lead Created', 'Lead generated via Website AI Chat']
                    );

                    socketManager.events.inboxUpdate({ conversationId, leadId, message: 'New AI Lead Generated', sender: 'System' });

                    // Clear session
                    delete chatSessions[sessionId];

                    return res.json({ 
                        success: true, 
                        reply: "Thank you! I have forwarded your details to our expert counselors. They will reach out to you shortly." 
                    });
                }
            } catch (err) {
                console.error("Failed to parse AI JSON or insert lead:", err);
            }
        }

        // Add AI reply to history
        chatSessions[sessionId].push({ role: 'assistant', content: aiReply });

        res.json({ success: true, reply: aiReply });
    } catch (error) {
        console.error('AI Chat Error:', error.response ? error.response.data : error.message);
        next(error);
    }
};
