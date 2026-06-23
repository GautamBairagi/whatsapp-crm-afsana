const db = require('../../config/db');
const bcrypt = require('bcryptjs');

// @desc    Get all users
// @route   GET /api/users
exports.getUsers = async (req, res, next) => {
    try {
        const [users] = await db.execute('SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC');
        res.json({ success: true, message: 'Users retrieved successfully', data: users });
    } catch (error) {
        next(error);
    }
};

// @desc    Update user status/role
// @route   PUT /api/users/:id
exports.updateUser = async (req, res, next) => {
    try {
        const { name, email, role, password, status } = req.body;
        const userId = parseInt(req.params.id);

        let updateFields = [];
        let queryParams = [];

        if (name) { updateFields.push('name = ?'); queryParams.push(name); }
        if (email) { updateFields.push('email = ?'); queryParams.push(email); }
        if (role) { updateFields.push('role = ?'); queryParams.push(role); }
        if (status) { updateFields.push('status = ?'); queryParams.push(status); }

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push('password = ?');
            queryParams.push(hashedPassword);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        queryParams.push(userId);
        
        await db.execute(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, queryParams);

        const [updatedUsers] = await db.execute('SELECT id, name, email, role, status FROM users WHERE id = ?', [userId]);

        res.json({
            success: true,
            message: 'User updated successfully',
            data: updatedUsers[0]
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle user status
// @route   PUT /api/users/:id/toggle
exports.toggleUserStatus = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);

        const [users] = await db.execute('SELECT status FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

        const newStatus = users[0].status === 'Active' ? 'Inactive' : 'Active';

        await db.execute('UPDATE users SET status = ? WHERE id = ?', [newStatus, userId]);

        const [updatedUsers] = await db.execute('SELECT id, name, email, role, status FROM users WHERE id = ?', [userId]);

        res.json({
            success: true,
            message: `User status changed to ${newStatus}`,
            data: updatedUsers[0]
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
exports.deleteUser = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const [result] = await db.execute('DELETE FROM users WHERE id = ?', [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'User deleted successfully', data: null });
    } catch (error) {
        next(error);
    }
};
