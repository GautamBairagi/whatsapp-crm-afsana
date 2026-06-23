const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');

exports.register = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password || !role) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, role]
        );

        res.status(201).json({ success: true, data: { id: result.insertId, name, email, role } });
    } catch (error) {
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (user.status === 'Inactive') {
            return res.status(403).json({ success: false, message: 'Account is inactive' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'crm_super_secret_jwt_key_2026',
            { expiresIn: process.env.JWT_EXPIRE || '24h' }
        );

        res.json({
            success: true,
            token,
            data: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        next(error);
    }
};

exports.getMe = async (req, res, next) => {
    try {
        const [users] = await db.execute('SELECT id, name, email, role, status FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, data: users[0] });
    } catch (error) {
        next(error);
    }
};

exports.refresh = async (req, res, next) => {
    res.status(400).json({ success: false, message: 'Not implemented' });
};

exports.resetPassword = async (req, res, next) => {
    res.status(400).json({ success: false, message: 'Not implemented' });
};
