const db = require('../../config/db');
const socketManager = require('../../sockets/socketManager');

const withDerivedStatus = (followup) => {
    const isPast = new Date(followup.scheduled_time) < new Date();
    const isNotCompleted = followup.status !== 'Completed' && followup.status !== 'Cancelled';
    return {
        ...followup,
        isOverdue: isPast && isNotCompleted
    };
};

exports.createFollowup = async (req, res, next) => {
    try {
        const leadId = req.params.id;
        const { scheduledTime, notes } = req.body;
        const userId = req.user.id;

        const [leads] = await db.execute('SELECT assigned_to, name FROM leads WHERE id = ?', [leadId]);
        if (leads.length === 0) return res.status(404).json({ success: false, message: 'Lead not found' });
        
        const lead = leads[0];
        const counselorId = lead.assigned_to || userId;

        const [result] = await db.execute(
            'INSERT INTO followups (lead_id, counselor_id, scheduled_time, status, notes) VALUES (?, ?, ?, ?, ?)',
            [leadId, counselorId, new Date(scheduledTime), 'Pending', notes || null]
        );

        await db.execute('UPDATE leads SET next_followup_date = ? WHERE id = ?', [new Date(scheduledTime), leadId]);

        await db.execute(
             'INSERT INTO activity_logs (user_id, lead_id, action, details) VALUES (?, ?, ?, ?)',
             [userId, leadId, 'Follow-up Created', `Follow-up scheduled on ${new Date(scheduledTime).toLocaleString()}`]
        );

        socketManager.events.dashboardRefresh({ trigger: 'followup_created', leadId });

        res.status(201).json({
            success: true,
            message: 'Follow-up scheduled successfully',
            data: { id: result.insertId }
        });
    } catch (error) {
        next(error);
    }
};

exports.completeFollowup = async (req, res, next) => {
    try {
        const { id: leadId, followupId } = req.params;
        const { notes } = req.body;
        const userId = req.user.id;

        await db.execute(
            'UPDATE followups SET status = ?, notes = ? WHERE id = ? AND lead_id = ?',
            ['Completed', notes, followupId, leadId]
        );

        await db.execute(
             'INSERT INTO activity_logs (user_id, lead_id, action, details) VALUES (?, ?, ?, ?)',
             [userId, leadId, 'Follow-up Completed', `Notes: ${notes}`]
        );

        socketManager.events.dashboardRefresh({ trigger: 'followup_completed', leadId });

        res.json({ success: true, message: 'Follow-up marked as completed' });
    } catch (error) {
        next(error);
    }
};

exports.rescheduleFollowup = async (req, res, next) => {
    try {
        const { id: leadId, followupId } = req.params;
        const { scheduledTime, notes } = req.body;
        const userId = req.user.id;

        // Mark existing as Rescheduled
        await db.execute('UPDATE followups SET status = ?, notes = ? WHERE id = ? AND lead_id = ?', ['Rescheduled', `Rescheduled: ${notes}`, followupId, leadId]);

        // Get counselor id from existing
        const [existing] = await db.execute('SELECT counselor_id FROM followups WHERE id = ?', [followupId]);
        const counselorId = existing.length > 0 ? existing[0].counselor_id : userId;

        // Create new
        const [result] = await db.execute(
            'INSERT INTO followups (lead_id, counselor_id, scheduled_time, status) VALUES (?, ?, ?, ?)',
            [leadId, counselorId, new Date(scheduledTime), 'Pending']
        );

        await db.execute('UPDATE leads SET next_followup_date = ? WHERE id = ?', [new Date(scheduledTime), leadId]);

        await db.execute(
             'INSERT INTO activity_logs (user_id, lead_id, action, details) VALUES (?, ?, ?, ?)',
             [userId, leadId, 'Follow-up Rescheduled', `New date: ${new Date(scheduledTime).toLocaleString()}. Reason: ${notes}`]
        );

        socketManager.events.dashboardRefresh({ trigger: 'followup_rescheduled', leadId });

        res.json({ success: true, message: 'Follow-up rescheduled successfully' });
    } catch (error) {
        next(error);
    }
};

exports.cancelFollowup = async (req, res, next) => {
    try {
        const { id: leadId, followupId } = req.params;
        const { notes } = req.body;
        const userId = req.user.id;

        await db.execute(
            'UPDATE followups SET status = ?, notes = ? WHERE id = ? AND lead_id = ?',
            ['Cancelled', notes, followupId, leadId]
        );

        await db.execute(
             'INSERT INTO activity_logs (user_id, lead_id, action, details) VALUES (?, ?, ?, ?)',
             [userId, leadId, 'Follow-up Cancelled', `Reason: ${notes}`]
        );

        socketManager.events.dashboardRefresh({ trigger: 'followup_cancelled', leadId });

        next(error);
    }
};

// ─────────────────────────────────────────────────
// GET FOLLOW-UPS FOR LEAD
// ─────────────────────────────────────────────────
exports.getLeadFollowups = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.id);
        const followups = await prisma.leadFollowup.findMany({
            where: { leadId },
            orderBy: { scheduledTime: 'asc' }
        });

        res.json({
            success: true,
            data: followups.map(withDerivedStatus)
        });
    } catch (error) {
        next(error);
    }
};
