const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, next) => {
    logger.error('API Request Error', err, { path: req.path, user: req.user?.id });

    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Removed Prisma Error Handling

    res.status(statusCode).json({
        success: false,
        message,
        data: null,
        error_code: err.code || 'SYSTEM_ERROR',
        stack: process.env.NODE_ENV === 'production' ? '🛡️ Protected' : err.stack
    });
};

module.exports = { errorMiddleware };
