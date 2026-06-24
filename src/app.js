const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { errorMiddleware } = require('./middleware/error.middleware');

dotenv.config();

const app = express();

// ─────────────────────────────────────────────────
// 🛡️ PRODUCTION SECURITY & LOGGING
// ─────────────────────────────────────────────────

// 1. Secure Headers
app.use(helmet());

// 2. Request Logging (Morgan)
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// 3. Global Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use('/api/', limiter);

// Standard Middlewares
app.use(cors({
    origin: [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'https://whatsapp-crm.kiaantechnology.com',
        'https://whatsapp.studyfirstinfo.com'
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' })); // Limit body size to prevent DoS
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/', (req, res) => {
    res.json({ success: true, message: 'CRM Production API is running' });
});

const db = require('./config/database');
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({
            status: "connected",
            database: process.env.DB_NAME || "crm_db"
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

// Auth Routes
const authRoutes = require('./modules/auth/auth.routes');
app.use('/api/auth', authRoutes);

// User Routes
const userRoutes = require('./modules/users/user.routes');
app.use('/api/users', userRoutes);

// Lead Routes
const leadRoutes = require('./modules/leads/lead.routes');
app.use('/api/leads', leadRoutes);

// AI Routes (Website Chat)
const aiRoutes = require('./modules/leads/ai.routes');
app.use('/api/ai', aiRoutes);

// Dashboard Routes
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
app.use('/api/dashboard', dashboardRoutes);

// Message Routes
const messageRoutes = require('./modules/messages/message.routes');
app.use('/api/messages', messageRoutes);

// WhatsApp Routes
const whatsappRoutes = require('./modules/whatsapp/whatsapp.routes');
app.use('/api/whatsapp', whatsappRoutes);

// Report Routes
const reportRoutes = require('./modules/reports/report.routes');
app.use('/api/reports', reportRoutes);

// Global Error Handler
app.use(errorMiddleware);

module.exports = app;
