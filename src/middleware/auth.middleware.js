const jwt = require('jsonwebtoken');
const db = require('../config/db');

// 1. TOKEN VERIFICATION
const verifyToken = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            console.log('--- VERIFY TOKEN ---');
            console.log('Received Token:', token);
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'crm_super_secret_jwt_key_2026');
            console.log('Decoded:', decoded);

            const [users] = await db.execute('SELECT * FROM users WHERE id = ?', [decoded.id]);
            if (users.length === 0) {
                console.log('ERROR: User not found in DB for ID', decoded.id);
                return res.status(401).json({ success: false, message: 'Not authorized, user not found', data: null });
            }

            const user = users[0];
            if (user.status !== 'Active') {
                console.log('ERROR: User status is', user.status);
                return res.status(401).json({ success: false, message: 'Your account is deactivated', data: null });
            }

            req.user = user;
            req.user.roleName = user.role || '';
            next();
        } catch (error) {
            console.log('TOKEN VERIFY ERROR:', error.message);
            return res.status(401).json({ success: false, message: 'Not authorized, token failed', data: null });
        }
    } else {
        console.log('ERROR: No token provided or wrong format');
        return res.status(401).json({ success: false, message: 'Not authorized, no token', data: null });
    }
};

// 2. ROLE GUARD — STRICT RBAC
const roleGuard = (...allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.user?.roleName || '';

        if (!userRole) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Role not found.'
            });
        }

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required: [${allowedRoles.join(', ')}]. Your role: ${userRole}`
            });
        }

        next();
    };
};

module.exports = { verifyToken, roleGuard };
