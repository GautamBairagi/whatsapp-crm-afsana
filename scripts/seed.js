const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: __dirname + '/../.env' });

async function seed() {
    console.log('Connecting to database...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'whatsapp_crm_simple'
    });

    console.log('Database connected!');
    const defaultPassword = 'Afsana@975';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // 1. Seed Users
    console.log('Seeding Users...');
    await connection.execute('DELETE FROM users');
    const users = [
        ['Super Admin', 'superadmin@example.com', 'SUPER_ADMIN'],
        ['System Admin', 'admin@example.com', 'ADMIN'],
        ['Operations Manager', 'manager@example.com', 'MANAGER'],
        ['Team Leader One', 'teamleader@example.com', 'TEAM_LEADER'],
        ['Support Agent', 'support@example.com', 'CUSTOMER_SUPPORT'],
        ['Counselor John', 'counselor@example.com', 'COUNSELOR']
    ];

    for (const user of users) {
        await connection.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [user[0], user[1], hashedPassword, user[2]]
        );
    }

    // Fetch counselor ID and support ID for dummy data
    const [counselors] = await connection.execute('SELECT id FROM users WHERE role = "COUNSELOR" LIMIT 1');
    const counselorId = counselors.length ? counselors[0].id : null;

    // 2. Seed Leads
    console.log('Seeding Leads...');
    await connection.execute('DELETE FROM messages');
    await connection.execute('DELETE FROM followups');
    await connection.execute('DELETE FROM activity_logs');
    await connection.execute('DELETE FROM leads');

    const leads = [
        ['Alex Smith', '+1234567890', 'alex@example.com', 'USA', 'WhatsApp', 'New', null, '123 Main St, NY', 'UK', 4.5, 2018, 4.2, 2020, 3.8, 2024, 'BSc Computer Science', 7.5, 'English'],
        ['Priya Patel', '+919876543210', 'priya@example.com', 'India', 'Facebook', 'Follow-up', counselorId, '45 Delhi Rd', 'Canada', 4.8, 2019, 4.6, 2021, null, null, 'Science', 6.5, 'English'],
        ['Ahmed Ali', '+971501234567', 'ahmed@example.com', 'UAE', 'Website', 'Converted', counselorId, 'Dubai Marina', 'Switzerland', 3.9, 2017, 3.5, 2019, 3.2, 2023, 'BBA', 6.0, 'English']
    ];

    for (const lead of leads) {
        const [result] = await connection.execute(
            `INSERT INTO leads 
            (name, phone, email, country, source, stage, assigned_to, current_address, interested_country, ssc_gpa, ssc_passing_year, hsc_gpa, hsc_passing_year, bachelor_cgpa, bachelor_passing_year, academic_background, ielts_score, moi) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            lead
        );

        const leadId = result.insertId;

        // 3. Seed Messages for each lead
        await connection.execute(
            'INSERT INTO messages (lead_id, message, sender_type, sender_name) VALUES (?, ?, ?, ?)',
            [leadId, `Hi, I am interested in studying in ${lead[8]}!`, 'Customer', lead[0]]
        );
        await connection.execute(
            'INSERT INTO messages (lead_id, message, sender_type, sender_name) VALUES (?, ?, ?, ?)',
            [leadId, `Hello ${lead[0]}, welcome to our consultancy! A counselor will reach out to you shortly.`, 'Bot', 'AI Assistant']
        );
    }

    console.log('Seeding Complete! You can now log in with the new accounts.');
    await connection.end();
}

seed().catch(err => {
    console.error('Seeding Failed:', err);
    process.exit(1);
});
