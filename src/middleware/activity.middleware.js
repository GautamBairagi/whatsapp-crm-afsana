const db = require('../config/db');

exports.logActivity = (actionDescription) => {
    return async (req, res, next) => {
        // We override the res.json to capture the response, so we know if it was successful before logging
        const originalJson = res.json;
        res.json = function (data) {
            if (data && data.success) {
                // If successful, log the activity
                const userId = req.user ? req.user.id : null;
                const details = JSON.stringify(req.body || req.params || req.query || {});
                
                // Fire and forget
                db.execute(
                    'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
                    [userId, actionDescription, details]
                ).catch(err => console.error('Failed to log activity:', err));
            }
            originalJson.call(this, data);
        };
        next();
    };
};
