const prisma = require('../../config/prisma');

// @desc    Assign lead to counselor (Support action)
// @route   POST /api/support/assign
exports.assignLead = async (req, res, next) => {
    try {
        const { leadId, counselorId } = req.body;
        await prisma.lead.update({
            where: { id: parseInt(leadId) },
            data: { assignedTo: parseInt(counselorId) }
        });
        res.json({ success: true, message: 'Lead assigned successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new lead (Support action)
// @route   POST /api/support/leads
exports.createLead = async (req, res, next) => {
    try {
        const { name, phone, email, program, source } = req.body;
        const newLead = await prisma.lead.create({
            data: {
                name,
                phone,
                email,
                program,
                source: source || 'Social',
                stage: 'New'
            }
        });
        res.status(201).json({ success: true, id: newLead.id });
    } catch (error) {
        next(error);
    }
};

// @desc    Bulk assign leads
// @route   POST /api/support/leads/bulk-assign
exports.bulkAssign = async (req, res, next) => {
    try {
        const { leadIds, counselorId } = req.body;
        if (leadIds && leadIds.length > 0) {
            await prisma.lead.updateMany({
                where: {
                    id: { in: leadIds.map(id => parseInt(id)) }
                },
                data: {
                    assignedTo: parseInt(counselorId)
                }
            });
        }
        res.json({ success: true, message: 'Bulk assignment complete' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get support dashboard stats
// @route   GET /api/support/dashboard
exports.getDashboard = async (req, res, next) => {
    try {
        const [newMessages, unassignedLeads] = await Promise.all([
            prisma.message.count(), // No isRead in schema, count all for now
            prisma.lead.count({ where: { assignedTo: null } })
        ]);
        const aiActiveChats = 0;

        await prisma.supportDashboard.create({
            data: {
                openTickets: unassignedLeads,
                newMessages,
                assignedChats: aiActiveChats
            }
        });

        res.json({
            success: true,
            data: { newMessages, unassignedLeads, aiActiveChats }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get unassigned leads queue
// @route   GET /api/support/leads/queue
exports.getNewLeads = async (req, res, next) => {
    try {
        const leads = await prisma.lead.findMany({
            where: { assignedTo: null },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: leads });
    } catch (error) {
        next(error);
    }
};

// @desc    Get support assignment list
// @route   GET /api/support/assignment-list
exports.getAssignmentList = async (req, res, next) => {
    try {
        const leads = await prisma.lead.findMany({
            include: {
                assignedUser: { select: { name: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });

        const formattedLeads = leads.map(l => ({
            ...l,
            assignedTo: l.assignedTo ? 'Assigned' : 'Pending',
            currentCounselor: l.assignedUser ? l.assignedUser.name : 'Not Assigned'
        }));

        res.json({ success: true, data: formattedLeads });
    } catch (error) {
        next(error);
    }
};

// @desc    Get AI qualification status reports
// @route   GET /api/support/ai-status
exports.getAiStatus = async (req, res, next) => {
    try {
        const leads = await prisma.lead.findMany({
            where: {
                score: { gt: 70 }
            },
            take: 20
        });

        const formattedLeads = leads.map(l => ({
            ...l,
            category: 'HOT',
            status: 'Processed',
            program: l.program || 'MBA',
            budget: '$20k',
            intake: 'Fall 2024'
        }));

        res.json({ success: true, data: formattedLeads });
    } catch (error) {
        next(error);
    }
};
