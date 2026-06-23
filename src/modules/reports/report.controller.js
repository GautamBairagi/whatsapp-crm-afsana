const db = require('../../config/db');

exports.getDailyReport = async (req, res, next) => {
    try {
        const { date } = req.query; // optional date filter YYYY-MM-DD
        
        let dateCondition = "DATE(created_at) = CURDATE()";
        let params = [];
        
        if (date) {
            dateCondition = "DATE(created_at) = ?";
            params.push(date);
        }

        // Query to get stats per agent
        // We will fetch: total leads assigned, messages sent, and conversions
        let userQuery = 'SELECT id, name, role FROM users WHERE role IN ("COUNSELOR", "CUSTOMER_SUPPORT", "TEAM_LEADER")';
        let userParams = [];

        // Enforce RBAC: Non-admin users can only see their own report
        if (req.user && ['COUNSELOR', 'CUSTOMER_SUPPORT', 'TEAM_LEADER'].includes(req.user.role)) {
            userQuery += ' AND id = ?';
            userParams.push(req.user.id);
        }
        
        const [users] = await db.execute(userQuery, userParams);
        
        const reportData = await Promise.all(users.map(async (user) => {
            // 1. Leads assigned today
            let leadQuery = `SELECT COUNT(*) as count FROM leads WHERE assigned_to = ? AND ${dateCondition}`;
            const [leadsResult] = await db.execute(leadQuery, [user.id, ...params]);
            
            // 2. Messages sent today
            let msgQuery = `SELECT COUNT(*) as count FROM messages WHERE sender_name = ? AND ${dateCondition}`;
            const [msgResult] = await db.execute(msgQuery, [user.name, ...params]);
            
            // 3. Conversions today
            let convQuery = `SELECT COUNT(*) as count FROM leads WHERE assigned_to = ? AND stage = 'Converted' AND ${dateCondition}`;
            const [convResult] = await db.execute(convQuery, [user.id, ...params]);
            
            // 4. Follow-ups done today
            let fwQuery = `SELECT COUNT(*) as count FROM followups WHERE counselor_id = ? AND status = 'Completed' AND DATE(scheduled_time) = ${date ? '?' : 'CURDATE()'}`;
            const fwParams = date ? [user.id, date] : [user.id];
            const [fwResult] = await db.execute(fwQuery, fwParams);

            return {
                agentId: user.id,
                agentName: user.name,
                role: user.role,
                assignedLeads: leadsResult[0].count,
                replyCount: msgResult[0].count,
                conversions: convResult[0].count,
                followupsCompleted: fwResult[0].count
            };
        }));

        res.json({ success: true, data: reportData });
    } catch (error) {
        next(error);
    }
};
