const express = require('express');
const Work = require('../models/Work');
const User = require('../models/User');
const auth = require('../middleware/auth');
const whatsappService = require('../services/whatsapp');

const router = express.Router();

// Create work assignment
router.post('/', auth, async (req, res) => {
    try {
        const { title, description, assignedTo, priority, dueDate } = req.body;

        // Check if user has permission to assign work
        const assignerUser = await User.findById(req.userId);
        if (!['admin', 'manager'].includes(assignerUser.role)) {
            return res.status(403).json({ message: 'Not authorized to assign work' });
        }

        const assignedUser = await User.findById(assignedTo);
        if (!assignedUser) {
            return res.status(404).json({ message: 'Assigned user not found' });
        }

        const work = new Work({
            title,
            description,
            assignedBy: req.userId,
            assignedTo,
            priority,
            dueDate: new Date(dueDate)
        });

        await work.save();
        await work.populate(['assignedBy', 'assignedTo']);

        // Send WhatsApp notification with custom branding
        const message = `*Ezzy Madrasa Task* 📚\n` +
            `🔔 New Work Assignment\n\n` +
            `📋 Task: ${title}\n` +
            `📝 Description: ${description}\n` +
            `👤 Assigned by: ${assignerUser.name}\n` +
            `⚡ Priority: ${priority.toUpperCase()}\n` +
            `📅 Due Date: ${new Date(dueDate).toLocaleDateString()}\n\n` +
            `Please check your dashboard for more details.\n` +
            `You can also reply "completed" to this message when done.\n\n` +
            `_- Ezzy Madrasa Management System_`;

        await whatsappService.sendMessage(assignedUser.phone, message);

        res.status(201).json(work);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all work assignments
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let query = {};

        // Filter based on role
        if (user.role === 'member') {
            query.assignedTo = req.userId;
        } else if (user.role === 'manager') {
            // Managers can see work they assigned or work assigned to their department members
            const departmentMembers = await User.find({ department: user.department }).select('_id');
            const memberIds = departmentMembers.map(member => member._id);
            query = {
                $or: [
                    { assignedBy: req.userId },
                    { assignedTo: { $in: memberIds } }
                ]
            };
        }
        // Admin can see all work (no filter)

        const works = await Work.find(query)
            .populate({
                path: 'assignedBy',
                select: 'name email role',
                match: { _id: { $exists: true } }
            })
            .populate({
                path: 'assignedTo',
                select: 'name email role department',
                match: { _id: { $exists: true } }
            })
            .sort({ createdAt: -1 });

        // Filter out works with null populated fields
        const validWorks = works.filter(work => work.assignedBy && work.assignedTo);

        res.json(validWorks);
    } catch (error) {
        console.error('Error loading works:', error);
        res.status(500).json({ message: error.message });
    }
});

// Update work status
router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const work = await Work.findById(req.params.id);

        if (!work) {
            return res.status(404).json({ message: 'Work not found' });
        }

        // Check if user can update this work
        const user = await User.findById(req.userId);
        if (work.assignedTo.toString() !== req.userId && !['admin', 'manager'].includes(user.role)) {
            return res.status(403).json({ message: 'Not authorized to update this work' });
        }

        work.status = status;
        if (status === 'completed') {
            work.completedAt = new Date();
        }

        await work.save();
        await work.populate(['assignedBy', 'assignedTo']);

        // Notify assigner about status update with custom branding
        const assignerUser = await User.findById(work.assignedBy);
        const message = `*Ezzy Madrasa Task* 📚\n` +
            `📊 Work Status Update\n\n` +
            `📋 Task: ${work.title}\n` +
            `👤 Updated by: ${user.name}\n` +
            `🔄 Status: ${status.toUpperCase()}\n` +
            `📅 Updated: ${new Date().toLocaleString()}\n\n` +
            `_- Ezzy Madrasa Management System_`;

        await whatsappService.sendMessage(assignerUser.phone, message);

        res.json(work);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add note to work
router.post('/:id/notes', auth, async (req, res) => {
    try {
        const { text } = req.body;
        const work = await Work.findById(req.params.id);

        if (!work) {
            return res.status(404).json({ message: 'Work not found' });
        }

        work.notes.push({
            text,
            addedBy: req.userId
        });

        await work.save();
        await work.populate('notes.addedBy', 'name');

        res.json(work);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get users for assignment (managers and admins only)
router.get('/users', auth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.userId);

        if (!['admin', 'manager'].includes(currentUser.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        let query = { isActive: true };

        // Managers can only see users in their department
        if (currentUser.role === 'manager') {
            query.department = currentUser.department;
        }

        const users = await User.find(query).select('name email role department phone');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get member-wise reports (admin and managers only)
router.get('/reports', auth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.userId);

        if (!['admin', 'manager'].includes(currentUser.role)) {
            return res.status(403).json({ message: 'Not authorized to view reports' });
        }

        const { period = 'weekly', startDate, endDate } = req.query;

        // Calculate date ranges based on period
        let dateFilter = {};
        const now = new Date();

        if (startDate && endDate) {
            dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        } else {
            switch (period) {
                case 'weekly':
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - 7);
                    dateFilter = { createdAt: { $gte: weekStart } };
                    break;
                case 'monthly':
                    const monthStart = new Date(now);
                    monthStart.setMonth(now.getMonth() - 1);
                    dateFilter = { createdAt: { $gte: monthStart } };
                    break;
                case 'yearly':
                    const yearStart = new Date(now);
                    yearStart.setFullYear(now.getFullYear() - 1);
                    dateFilter = { createdAt: { $gte: yearStart } };
                    break;
            }
        }

        // Get users based on role permissions
        let userQuery = { isActive: true };
        if (currentUser.role === 'manager') {
            userQuery.department = currentUser.department;
        }

        const users = await User.find(userQuery).select('name email role department');

        // Get work assignments for the period
        const works = await Work.find(dateFilter)
            .populate('assignedTo', 'name email role department')
            .populate('assignedBy', 'name email role department');

        // Filter works based on user permissions
        let filteredWorks = works;
        if (currentUser.role === 'manager') {
            filteredWorks = works.filter(work =>
                work.assignedTo && work.assignedTo.department === currentUser.department
            );
        }

        // Generate member-wise report
        const memberReports = users.map(user => {
            const userWorks = filteredWorks.filter(work =>
                work.assignedTo && work.assignedTo._id.toString() === user._id.toString()
            );

            const statusCounts = {
                pending: userWorks.filter(w => w.status === 'pending').length,
                'in-progress': userWorks.filter(w => w.status === 'in-progress').length,
                completed: userWorks.filter(w => w.status === 'completed').length,
                cancelled: userWorks.filter(w => w.status === 'cancelled').length
            };

            const priorityCounts = {
                low: userWorks.filter(w => w.priority === 'low').length,
                medium: userWorks.filter(w => w.priority === 'medium').length,
                high: userWorks.filter(w => w.priority === 'high').length,
                urgent: userWorks.filter(w => w.priority === 'urgent').length
            };

            // Calculate completion rate
            const totalTasks = userWorks.length;
            const completedTasks = statusCounts.completed;
            const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

            // Calculate average completion time for completed tasks
            const completedWorks = userWorks.filter(w => w.status === 'completed' && w.completedAt);
            let avgCompletionTime = 0;
            if (completedWorks.length > 0) {
                const totalTime = completedWorks.reduce((sum, work) => {
                    const assignedTime = new Date(work.createdAt);
                    const completedTime = new Date(work.completedAt);
                    return sum + (completedTime - assignedTime);
                }, 0);
                avgCompletionTime = Math.round(totalTime / (completedWorks.length * 24 * 60 * 60 * 1000)); // in days
            }

            return {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    department: user.department
                },
                totalTasks,
                statusCounts,
                priorityCounts,
                completionRate: parseFloat(completionRate),
                avgCompletionTime,
                recentTasks: userWorks.slice(0, 5).map(work => ({
                    id: work._id,
                    title: work.title,
                    status: work.status,
                    priority: work.priority,
                    createdAt: work.createdAt,
                    dueDate: work.dueDate,
                    completedAt: work.completedAt
                }))
            };
        });

        // Sort by total tasks descending
        memberReports.sort((a, b) => b.totalTasks - a.totalTasks);

        // Generate summary statistics
        const summary = {
            totalMembers: memberReports.length,
            totalTasks: filteredWorks.length,
            completedTasks: filteredWorks.filter(w => w.status === 'completed').length,
            pendingTasks: filteredWorks.filter(w => w.status === 'pending').length,
            inProgressTasks: filteredWorks.filter(w => w.status === 'in-progress').length,
            overallCompletionRate: filteredWorks.length > 0 ?
                ((filteredWorks.filter(w => w.status === 'completed').length / filteredWorks.length) * 100).toFixed(1) : 0,
            period,
            dateRange: {
                start: dateFilter.createdAt?.$gte || null,
                end: dateFilter.createdAt?.$lte || now
            }
        };

        res.json({
            summary,
            memberReports
        });

    } catch (error) {
        console.error('Error generating reports:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;