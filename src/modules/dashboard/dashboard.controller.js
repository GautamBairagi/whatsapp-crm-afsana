const db = require('../../config/db');

exports.getDashboardStats = async (req, res, next) => {
    try {
        const [leadsCount] = await db.execute('SELECT COUNT(*) as count FROM leads');
        const [usersCount] = await db.execute('SELECT COUNT(*) as count FROM users');
        const [messagesCount] = await db.execute('SELECT COUNT(*) as count FROM messages WHERE is_read = FALSE');

        res.json({
            success: true, 
            data: {
                totalLeads: leadsCount[0].count,
                totalUsers: usersCount[0].count,
                unreadMessages: messagesCount[0].count
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getKpiStats = exports.getDashboardStats;
exports.getSuperAdminDashboard = exports.getDashboardStats;
exports.getAdminDashboard = exports.getDashboardStats;
exports.getManagerDashboard = exports.getDashboardStats;
exports.getTeamLeaderDashboard = exports.getDashboardStats;
exports.getCounselorDashboard = exports.getDashboardStats;
exports.getSupportDashboard = exports.getDashboardStats;
