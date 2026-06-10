const prisma = require('../../config/prisma');
const socketManager = require('../../sockets/socketManager');

// ─────────────────────────────────────────────────
// ROUND ROBIN ASSIGNMENT ENGINE
// ─────────────────────────────────────────────────

/**
 * Get next available counselor using Round Robin logic
 * - Only picks Active counselors with COUNSELOR role
 * - Distributes based on least leads assigned
 */
const getNextCounselor = async (tx, team = null) => {
    const where = {
        status: 'Active',
        role: { name: 'COUNSELOR' }
    };

    if (team) where.team = team;

    // Strict Round Robin: Pick counselor with oldest lastAssignedAt
    // Atomic: We perform this within the provided transaction context
    const counselor = await tx.user.findFirst({
        where,
        orderBy: [
            { lastAssignedAt: 'asc' },
            { createdAt: 'asc' }
        ]
    });

    if (!counselor) return null;

    // Mark as assigned NOW to prevent race conditions in same transaction block
    const updated = await tx.user.update({
        where: { id: counselor.id },
        data: { lastAssignedAt: new Date() }
    });

    return updated;
};

// ─────────────────────────────────────────────────
// GET ALL LEADS (with Role Scope)
// ─────────────────────────────────────────────────
exports.getLeads = async (req, res, next) => {
    try {
        const { country, status, dateRange, search } = req.query;
        const role = req.user?.roleName || req.user?.role?.name || '';

        const where = { ...req.leadScope };

        if (country && country !== 'Global') where.country = country;
        if (status && status !== 'All Stages') where.stage = status;

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } }
            ];
        }

        const leads = await prisma.lead.findMany({
            where,
            include: {
                assignedUser: { select: { name: true, id: true } },
                status: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const flattenedLeads = leads.map(l => {
            const { assignedUser, ...rest } = l;
            return {
                ...rest,
                handlerName: assignedUser ? assignedUser.name : null
            };
        });

        res.json({
            success: true,
            message: 'Leads retrieved successfully',
            data: flattenedLeads,
            total: flattenedLeads.length
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// CREATE LEAD + AUTO ASSIGN (BULLETPROOF VERSION)
// ─────────────────────────────────────────────────
exports.createLead = async (req, res, next) => {
    try {
        const { name, country, phone, email, program, stage, score, source, assignedTo, team, priority } = req.body;

        // Atomic Transaction Start
        const result = await prisma.$transaction(async (tx) => {
            
            // 1. Resolve Status
            let statusEntity = await tx.leadStatus.findUnique({
                where: { name: stage || 'New' }
            });
            if (!statusEntity) {
                statusEntity = await tx.leadStatus.findFirst({ where: { name: 'New' } });
            }

            // 2. Auto-assignment Logic (Atomic inside transaction)
            let finalAssignedTo = assignedTo ? parseInt(assignedTo) : null;
            let autoAssigned = false;

            if (!finalAssignedTo) {
                const counselor = await getNextCounselor(tx, team);
                if (counselor) {
                    finalAssignedTo = counselor.id;
                    autoAssigned = true;
                }
            } else {
                // Manual assignment still updates the timestamp to keep them in the loop
                await tx.user.update({
                    where: { id: finalAssignedTo },
                    data: { lastAssignedAt: new Date() }
                }).catch(() => {}); // Ignore if user doesn't exist or isn't a counselor
            }

            // 3. Create Lead
            const newLead = await tx.lead.create({
                data: {
                    name,
                    country,
                    phone,
                    email,
                    program,
                    statusId: statusEntity ? statusEntity.id : null,
                    stage: stage || 'New',
                    score: score || 0,
                    source: source || 'Website',
                    assignedTo: finalAssignedTo,
                    team: team || 'General',
                    priority: priority || 'Medium'
                },
                include: { status: true }
            });

            // 4. Atomic Audit Log
            await tx.activityLog.create({
                data: {
                    userId: req.user?.id || null,
                    action: 'LEAD_CREATED',
                    module: 'leads',
                    details: `Lead "${name}" created. ${autoAssigned ? 'Auto-assigned.' : 'Manual.'} ID: ${newLead.id}`,
                    status: 'Success'
                }
            });

            return { newLead, autoAssigned };
        }, {
            timeout: 10000 // 10s timeout for safety
        });

        // Outside transaction: Async tasks
        socketManager.events.leadNew(result.newLead);
        socketManager.events.dashboardRefresh({ trigger: 'lead_created' });

        res.status(201).json({
            success: true,
            message: `Lead created successfully${result.autoAssigned ? ' (auto-assigned)' : ''}`,
            data: result.newLead,
            autoAssigned: result.autoAssigned
        });
    } catch (error) {
        console.error('[LEAD CREATION CRITICAL ERROR]:', error.message);
        next(error);
    }
};

// ─────────────────────────────────────────────────
// UPDATE LEAD
// ─────────────────────────────────────────────────
exports.updateLead = async (req, res, next) => {
    try {
        const { name, country, phone, email, program, stage, score, source, assignedTo, team, priority, followUpDate } = req.body;
        const leadId = parseInt(req.params.id);
        const role = req.user?.roleName || req.user?.role?.name || '';

        // Counselors can only update their own leads
        if (role === 'COUNSELOR') {
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (!lead || lead.assignedTo !== req.user.id) {
                return res.status(403).json({ success: false, message: 'You can only update your own leads.' });
            }
        }

        let data = {};
        if (name) data.name = name;
        if (country) data.country = country;
        if (phone) data.phone = phone;
        if (email) data.email = email;
        if (program) data.program = program;
        if (stage) {
            data.stage = stage;
            const statusEntity = await prisma.leadStatus.findUnique({ where: { name: stage } });
            if (statusEntity) data.statusId = statusEntity.id;
        }
        if (score !== undefined) data.score = score;
        if (source) data.source = source;
        if (assignedTo !== undefined) data.assignedTo = assignedTo || null;
        if (team) data.team = team;
        if (priority) data.priority = priority;
        if (followUpDate) data.followUpDate = new Date(followUpDate);

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        const updatedLead = await prisma.lead.update({ where: { id: leadId }, data });

        // SLA Tracking: Resolution
        if (['Converted', 'Lost'].includes(stage)) {
            const { trackSLA } = require('../../middleware/sla.middleware');
            await trackSLA(leadId, 'RESOLUTION', req.user?.id);
        }

        // Audit log
        await prisma.activityLog.create({
            data: {
                userId: req.user?.id || null,
                action: 'LEAD_UPDATED',
                module: 'leads',
                details: `Lead ID ${leadId} updated. Stage: ${stage || 'unchanged'}`,
                status: 'Success'
            }
        }).catch(() => {});

        socketManager.events.leadUpdate(updatedLead);
        if (stage) socketManager.events.dashboardRefresh({ trigger: 'lead_stage_changed', stage });

        res.json({ success: true, message: 'Lead updated successfully', data: updatedLead });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// DELETE LEAD
// ─────────────────────────────────────────────────
exports.deleteLead = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.id);

        await prisma.lead.delete({ where: { id: leadId } });

        await prisma.activityLog.create({
            data: {
                userId: req.user?.id || null,
                action: 'LEAD_DELETED',
                module: 'leads',
                details: `Lead ID ${leadId} deleted by ${req.user?.name}`,
                status: 'Success'
            }
        }).catch(() => {});

        socketManager.events.leadDelete(leadId);
        socketManager.events.dashboardRefresh({ trigger: 'lead_deleted' });

        res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }
        next(error);
    }
};

// ─────────────────────────────────────────────────
// ASSIGN LEAD (Manual — Team Leader/Admin)
// ─────────────────────────────────────────────────
exports.assignLead = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.id);
        const { userId } = req.body;

        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                assignedTo: userId ? parseInt(userId) : null,
                stage: 'Assigned'
            }
        });

        await prisma.activityLog.create({
            data: {
                userId: req.user?.id || null,
                action: 'LEAD_ASSIGNED',
                module: 'leads',
                details: `Lead ID ${leadId} manually assigned to User ID ${userId} by ${req.user?.name}`,
                status: 'Success'
            }
        }).catch(() => {});

        socketManager.events.leadUpdate(updatedLead);

        res.json({ success: true, data: updatedLead, message: 'Lead assigned successfully' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }
        next(error);
    }
};

// ─────────────────────────────────────────────────
// AUTO ASSIGN LEADS (Bulk — Round Robin)
// ─────────────────────────────────────────────────
exports.autoAssignLeads = async (req, res, next) => {
    try {
        // Get all unassigned leads
        const unassignedLeads = await prisma.lead.findMany({
            where: { assignedTo: null }
        });

        if (!unassignedLeads.length) {
            return res.json({ success: true, message: 'No unassigned leads found', data: [] });
        }

        const results = [];
        
        // Process unassigned leads sequentially in a transaction to maintain RR order
        await prisma.$transaction(async (tx) => {
            for (const lead of unassignedLeads) {
                const counselor = await getNextCounselor(tx, lead.team);
                if (counselor) {
                    const updated = await tx.lead.update({
                        where: { id: lead.id },
                        data: { assignedTo: counselor.id, stage: 'Assigned' }
                    });
                    results.push({ leadId: lead.id, assignedTo: counselor.id, counselorName: counselor.name });
                }
            }
        }, { timeout: 15000 });

        await prisma.activityLog.create({
            data: {
                userId: req.user?.id || null,
                action: 'BULK_AUTO_ASSIGN',
                module: 'leads',
                details: `${results.length} leads auto-assigned via Round Robin`,
                status: 'Success'
            }
        }).catch(() => {});

        res.json({
            success: true,
            message: `${results.length} leads auto-assigned successfully`,
            data: results
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// EXPORT LEADS
// ─────────────────────────────────────────────────
exports.exportLeads = async (req, res, next) => {
    try {
        const role = req.user?.roleName || req.user?.role?.name || '';
        const where = req.leadScope || {};

        const leads = await prisma.lead.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        let csvContent = 'ID,Name,Country,Phone,Email,Program,Stage,Priority,Source,Created At\n';
        leads.forEach(l => {
            const row = [
                l.id,
                `"${l.name || ''}"`,
                `"${l.country || ''}"`,
                `"${l.phone || ''}"`,
                `"${l.email || ''}"`,
                `"${l.program || ''}"`,
                `"${l.stage || 'New'}"`,
                `"${l.priority || 'Medium'}"`,
                `"${l.source || 'Website'}"`,
                new Date(l.createdAt).toISOString()
            ].join(',');
            csvContent += row + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="leads-export-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
    } catch (error) {
        next(error);
    }
};
