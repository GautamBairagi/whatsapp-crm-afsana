const db = require('../../config/db');

exports.getLeads = async (req, res, next) => {
    try {
        let query = 'SELECT l.*, u.name as assigned_counselor FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE 1=1';
        let queryParams = [];

        // Enforce RBAC: Super Admin and Admin can see all leads. Everyone else sees only their own.
        if (req.user && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
            query += ' AND l.assigned_to = ?';
            queryParams.push(req.user.id);
        } else if (req.query.assigned_to) { 
            query += ' AND l.assigned_to = ?'; 
            queryParams.push(req.query.assigned_to); 
        }

        if (req.query.stage) { query += ' AND l.stage = ?'; queryParams.push(req.query.stage); }
        if (req.query.country) { query += ' AND l.country = ?'; queryParams.push(req.query.country); }
        if (req.query.source) { query += ' AND l.source = ?'; queryParams.push(req.query.source); }
        
        if (req.query.search) {
            query += ' AND (l.name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)';
            const searchPattern = `%${req.query.search}%`;
            queryParams.push(searchPattern, searchPattern, searchPattern);
        }

        query += ' ORDER BY l.created_at DESC';

        const [leads] = await db.execute(query, queryParams);
        res.json({ success: true, data: leads });
    } catch (error) {
        next(error);
    }
};

exports.getLead = async (req, res, next) => {
    try {
        const leadId = req.params.id;
        const [leads] = await db.execute('SELECT l.*, u.name as assigned_counselor FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.id = ?', [leadId]);
        if (leads.length === 0) return res.status(404).json({ success: false, message: 'Lead not found' });
        
        const lead = leads[0];

        // Fetch Notes
        const [notes] = await db.execute('SELECT n.*, u.name as user_name FROM notes n JOIN users u ON n.user_id = u.id WHERE lead_id = ? ORDER BY created_at DESC', [leadId]);
        
        // Fetch Follow-ups
        const [followups] = await db.execute('SELECT f.*, u.name as counselor_name FROM followups f JOIN users u ON f.counselor_id = u.id WHERE lead_id = ? ORDER BY scheduled_time ASC', [leadId]);
        
        // Fetch Timeline (Activity Logs)
        const [timeline] = await db.execute('SELECT a.*, u.name as user_name FROM activity_logs a LEFT JOIN users u ON a.user_id = u.id WHERE lead_id = ? ORDER BY created_at DESC', [leadId]);

        res.json({ 
            success: true, 
            data: {
                ...lead,
                notes,
                followups,
                timeline
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.createLead = async (req, res, next) => {
    try {
        const { 
            name, phone, email, country, source, stage, assigned_to, 
            qualification, ielts_score 
        } = req.body;
        const userId = req.user ? req.user.id : null;

        const [result] = await db.execute(
            `INSERT INTO leads (
                name, phone, email, country, source, stage, assigned_to, 
                qualification, ielts_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, phone, email || null, country || null, source || 'MANUAL', stage || 'New', assigned_to || null,
                qualification || null, ielts_score || null
            ]
        );

        const leadId = result.insertId;

        await db.execute(
             'INSERT INTO activity_logs (user_id, lead_id, action, details) VALUES (?, ?, ?, ?)',
             [userId, leadId, 'Lead Created', `Lead created via ${source || 'MANUAL'}`]
        );

        res.status(201).json({ success: true, data: { id: leadId, name, phone } });
    } catch (error) {
        next(error);
    }
};

exports.updateLead = async (req, res, next) => {
    try {
        const updates = req.body;
        const leadId = req.params.id;
        const userId = req.user ? req.user.id : null;

        const allowedFields = [
            'name', 'phone', 'email', 'country', 'source', 'stage', 'assigned_to', 
            'qualification', 'ielts_score', 'next_followup_date'
        ];

        // Get current lead to compare for assignment logs or status changes
        const [currentLeads] = await db.execute('SELECT stage, assigned_to FROM leads WHERE id = ?', [leadId]);
        if (currentLeads.length === 0) return res.status(404).json({ success: false, message: 'Lead not found' });
        const currentLead = currentLeads[0];

        let updateClauses = [];
        let queryParams = [];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateClauses.push(`${field} = ?`);
                queryParams.push(updates[field]);
            }
        }

        if (updateClauses.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields provided to update.' });
        }

        queryParams.push(leadId);

        await db.execute(
            `UPDATE leads SET ${updateClauses.join(', ')} WHERE id = ?`,
            queryParams
        );

        // Track Assignment
        if (updates.assigned_to !== undefined && updates.assigned_to !== currentLead.assigned_to) {
            await db.execute(
                'INSERT INTO assignment_logs (lead_id, assigned_to, assigned_by, previous_owner) VALUES (?, ?, ?, ?)',
                [leadId, updates.assigned_to, userId, currentLead.assigned_to]
            );
            await db.execute(
                'INSERT INTO activity_logs (user_id, lead_id, action, details) VALUES (?, ?, ?, ?)',
                [userId, leadId, 'Assigned Lead', `Lead assigned to user ID ${updates.assigned_to}`]
            );
        }

        // Track Stage Change
        if (updates.stage !== undefined && updates.stage !== currentLead.stage) {
            await db.execute(
                'INSERT INTO activity_logs (user_id, lead_id, action, details) VALUES (?, ?, ?, ?)',
                [userId, leadId, 'Status Changed', `Status changed from ${currentLead.stage} to ${updates.stage}`]
            );
        }

        res.json({ success: true, message: 'Lead updated successfully' });
    } catch (error) {
        next(error);
    }
};

exports.deleteLead = async (req, res, next) => {
    try {
        await db.execute('DELETE FROM leads WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Lead deleted' });
    } catch (error) {
        next(error);
    }
};
