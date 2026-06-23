const axios = require('axios');

const simulateMessage = async () => {
    // A sample Meta Webhook Payload
    const payload = {
        object: 'whatsapp_business_account',
        entry: [
            {
                id: '1234567890',
                changes: [
                    {
                        value: {
                            messaging_product: 'whatsapp',
                            metadata: {
                                display_phone_number: '16505551111',
                                phone_number_id: '1234567890'
                            },
                            contacts: [
                                {
                                    profile: {
                                        name: 'Rahul Sharma (Test Student)'
                                    },
                                    wa_id: '919876543210'
                                }
                            ],
                            messages: [
                                {
                                    from: '919876543210',
                                    id: 'wamid.HBgLOTkxOTg3NjU0MzIxMBUCABEYEFQ3QzE3QzBBM0MxMjI1QUMAA',
                                    timestamp: '1689255282',
                                    text: {
                                        body: 'Hi, I want to study in Canada. Please send details.'
                                    },
                                    type: 'text'
                                }
                            ]
                        },
                        field: 'messages'
                    }
                ]
            }
        ]
    };

    try {
        console.log('Sending Simulated WhatsApp Message to Local CRM...');
        const res = await axios.post('http://localhost:5000/api/whatsapp/webhook', payload);
        console.log('Response Status:', res.status);
        console.log('✅ Message successfully injected into CRM!');
        console.log('👉 Now check the "Unified Inbox" and "Leads Directory" in the Frontend.');
    } catch (error) {
        console.error('❌ Failed to simulate message:', error.message);
    }
};

simulateMessage();
