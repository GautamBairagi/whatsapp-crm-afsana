const db = require('../config/db');
/**
 * Production Logger & Alert System
 */
const logger = {
    info: (message, context = {}) => {
        console.log(`[INFO] ${message}`, context);
    },
    
    warn: (message, context = {}) => {
        console.warn(`[WARN] ${message}`, context);
    },
    
    error: async (message, error, context = {}) => {
        console.error(`[CRITICAL ERROR] ${message}:`, error);
        
        try {
            await db.execute(
                'INSERT INTO activity_logs (action, details) VALUES (?, ?)',
                ['SYSTEM_CRITICAL_ERROR', `${message} | Error: ${error.message}`]
            );

            // MOCK: Send Alert Webhook (e.g. to Slack/Discord/Email)
            if (process.env.ALERT_WEBHOOK_URL) {
                console.log('[ALERT] Dispatching to external monitoring service...');
                // fetch(process.env.ALERT_WEBHOOK_URL, { method: 'POST', body: JSON.stringify({ message, error: error.message }) });
            }
        } catch (logErr) {
            console.error('[LOGGER FAILURE]: Could not log error to DB', logErr.message);
        }
    }
};

module.exports = logger;
