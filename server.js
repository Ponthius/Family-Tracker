const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 4001;

const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'familytrackerdb',
    user: process.env.PGUSER || 'familytracker_user',
    password: process.env.PGPASSWORD || 'familytracker_pass'
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'hafizashiraf180@gmail.com',
        pass: process.env.EMAIL_PASS || 'HafizAshiraf@2005'
    }
});

async function sendVerificationEmail(email, token) {
    const verificationLink = `https://family-tracker-sooty-one.vercel.app/api/verify-email?token=${token}`;
    await transporter.sendMail({
        from: process.env.EMAIL_USER || 'hafizashiraf180@gmail.com',
        to: email,
        subject: 'Verify your Email - Family Tracker',
        html: `
            <h2>Family Tracker Email Verification</h2>
            <p>Click the button below to verify your email.</p>
            <a href="${verificationLink}" style="display:inline-block;padding:12px 24px;background:#3d3530;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a>
            <p>This link expires in 24 hours.</p>
        `
    });
}

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ success: true, status: 'online' });
});

// ----- Register -----

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
    return emailRegex.test(String(email || '').trim());
}

function hashIdentifier(value) {
    const cr = require('crypto');
    return cr.createHash('sha256').update(String(value || '').trim().toLowerCase()).digest('hex');
}

async function sendInviteEmail(recipientEmail, familyName, token) {
    await transporter.sendMail({
        from: process.env.EMAIL_USER || 'yourgmail@gmail.com',
        to: recipientEmail,
        subject: 'You\'re invited to join ' + familyName,
        html: '<h2>Family Tracker Invitation</h2><p>You have been invited to join <strong>' + familyName + '</strong></p><p><a href="https://family-tracker-project.vercel.app/user_invite/invite_setup.html?token=' + token + '">Accept Invitation</a></p>'
    });
}

app.post('/register', async (req, res) => {
    const { email, username, password, role } = req.body;

    if (!email || !username || !password || !role) {
        return res.status(400).json({ error: 'All fields required' });
    }

    try {
        const roleCheck = await pool.query(
            `SELECT COUNT(*) AS cnt FROM users WHERE role = $1`,
            [role]
        );

        if (role === 'father' && parseInt(roleCheck.rows[0].cnt) > 0) {
            return res.status(409).json({ error: 'Father role is already registered. Only one father allowed.' });
        }
        if (role === 'mother' && parseInt(roleCheck.rows[0].cnt) > 0) {
            return res.status(409).json({ error: 'Mother role is already registered. Only one mother allowed.' });
        }

        // Insert user and get ID
        const userResult = await pool.query(
            `INSERT INTO users (email, username, password, role, emailverified)
             VALUES ($1, $2, $3, $4, TRUE)
             RETURNING id`,
            [email, username, password, role]
        );

        const userId = userResult.rows[0].id;

        // If father, auto-create a family and assign family_id
        if (role === 'father') {
            const familyResult = await pool.query(
                `INSERT INTO families (name, admin_id) VALUES ($1, $2) RETURNING id`,
                [username + '\'s Family', userId]
            );
            await pool.query(
                `UPDATE users SET family_id = $1 WHERE id = $2`,
                [familyResult.rows[0].id, userId]
            );
        }

        res.json({ success: true, message: 'Registration successful.' });
    } catch (err) {
        console.error('Register error:', err.message);

        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username or email already exists' });
        }

        res.status(500).json({ error: 'Server error while registering user' });
    }
});

// ----- Email Verification -----

app.get('/verify-email', async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).send('Verification token is required');
    }

    try {
        const verificationResult = await pool.query(`
            SELECT * FROM EmailVerifications
            WHERE VerificationToken = $1
            AND isActive = TRUE
            AND ExpiresAt > NOW()
        `, [token]);

        if (verificationResult.rows.length === 0) {
            return res.status(400).send('Invalid or expired verification link.');
        }

        const verification = verificationResult.rows[0];

        // Mark user as verified
        await pool.query(
            `UPDATE users SET emailverified = TRUE WHERE id = $1`,
            [verification.userid]
        );

        // Deactivate the token
        await pool.query(
            `UPDATE EmailVerifications SET isActive = FALSE, VerifiedAt = NOW()
             WHERE VerificationID = $1`,
            [verification.verificationid]
        );

        res.send(`
            <h2>Email Verified Successfully</h2>
            <p>You can now login to Family Tracker.</p>
            <a href="/login.html" style="display:inline-block;padding:12px 24px;background:#3d3530;color:#fff;text-decoration:none;border-radius:6px;">Go to Login</a>
        `);
    } catch (err) {
        console.error('Verification error:', err.message);
        res.status(500).send('Server error while verifying email');
    }
});

app.post('/resend-verification', async (req, res) => {
    const { email } = req.body;

    try {
        const userResult = await pool.query(
            `SELECT id, emailverified FROM users WHERE email = $1`,
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        if (user.emailverified) {
            return res.status(400).json({ error: 'Email already verified' });
        }

        // Deactivate old tokens
        await pool.query(
            `UPDATE EmailVerifications SET isActive = FALSE WHERE UserID = $1`,
            [user.id]
        );

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await pool.query(
            `INSERT INTO EmailVerifications (UserID, VerificationToken, ExpiresAt)
             VALUES ($1, $2, $3)`,
            [user.id, token, expiresAt]
        );

        sendVerificationEmail(email, token).catch(err => {
            console.error('Failed to resend verification email:', err.message);
        });

        res.json({ success: true, message: 'Verification email sent successfully' });
    } catch (err) {
        console.error('Resend verification error:', err.message);
        res.status(500).json({ error: 'Server error while resending email' });
    }
});

// ----- Login -----

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        const result = await pool.query(
            `SELECT id, email, username, role, family_id, is_super_admin FROM users WHERE username = $1 AND password = $2`,
            [username, password]
        );

        if (result.rows.length === 0) {
            // Check if account was deleted
            const delCheck = await pool.query(
                `SELECT id FROM DeletedAccounts WHERE username_hash = $1 AND expires_at > NOW()`,
                [hashIdentifier(username)]
            );
            if (delCheck.rows.length > 0) {
                return res.status(403).json({ error: 'This account has been deleted. Please contact your family admin or wait for 7-day recovery period.' });
            }
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = result.rows[0];

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                family_id: user.family_id,
                is_super_admin: user.is_super_admin
            }
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Server error while logging in' });
    }
});

// ----- Members -----

app.get('/members', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, role, username, email FROM users ORDER BY created_at DESC`
        );

        res.json({ success: true, members: result.rows });
    } catch (err) {
        console.error('Members error:', err.message);
        res.status(500).json({ error: 'Server error while loading members' });
    }
});

// ----- Profile routes -----

app.get('/profile/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `SELECT id, email, username, role, fullname, profile_photo FROM users WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error('Profile fetch error:', err.message);
        res.status(500).json({ error: 'Server error while loading profile' });
    }
});

app.put('/profile/:id', async (req, res) => {
    const { id } = req.params;
    const { username, fullname, email } = req.body;

    if (!username && !fullname && !email) {
        return res.status(400).json({ error: 'At least one field to update is required' });
    }

    try {
        const setClauses = [];
        const values = [];
        let idx = 1;

        if (username !== undefined) {
            setClauses.push(`username = $${idx++}`);
            values.push(username);
        }
        if (fullname !== undefined) {
            setClauses.push(`fullname = $${idx++}`);
            values.push(fullname);
        }
        if (email !== undefined) {
            setClauses.push(`email = $${idx++}`);
            values.push(email);
        }

        values.push(id);
        await pool.query(
            `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx}`,
            values
        );

        const updated = await pool.query(
            `SELECT id, email, username, role, fullname, profile_photo FROM users WHERE id = $1`,
            [id]
        );

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: updated.rows[0]
        });
    } catch (err) {
        console.error('Profile update error:', err.message);

        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username or email already taken' });
        }

        res.status(500).json({ error: 'Server error while updating profile' });
    }
});

app.put('/profile/:id/password', async (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (newPassword.length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }

    try {
        const user = await pool.query(
            `SELECT id FROM users WHERE id = $1 AND password = $2`,
            [id, currentPassword]
        );

        if (user.rows.length === 0) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        await pool.query(
            `UPDATE users SET password = $1 WHERE id = $2`,
            [newPassword, id]
        );

        await logAudit(username, role, 'Password Changed', 'Success');

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('Password update error:', err.message);
        res.status(500).json({ error: 'Server error while updating password' });
    }
});

// ----- Tasks -----

app.get('/tasks', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT TaskID, Role, Username, TaskName, Description,
                   TaskDate, TaskTime, status, AssignedBy, AssignedByName
            FROM Tasks
            WHERE status = 'pending'
            ORDER BY TaskDate DESC, TaskTime DESC
        `);

        res.json({ success: true, tasks: result.rows });
    } catch (err) {
        console.error('Tasks fetch error:', err.message);
        res.status(500).json({ error: 'Server error while loading tasks' });
    }
});

app.post('/tasks', async (req, res) => {
    const { role, username, taskName, description, date, time, assignedById, assignedByName } = req.body;

    if (!role || !username || !taskName || !date || !time) {
        return res.status(400).json({ error: 'Role, username, task name, date, and time are required' });
    }

    try {
        await pool.query(`
            INSERT INTO Tasks (Role, Username, TaskName, Description, TaskDate, TaskTime, AssignedBy, AssignedByName, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        `, [role, username, taskName, description || '', date, time, assignedById || null, assignedByName || '']);

        res.json({ success: true, message: 'Task created successfully' });
    } catch (err) {
        console.error('Task create error:', err.message);
        res.status(500).json({ error: 'Server error while creating task' });
    }
});

app.put('/tasks/:id/done', async (req, res) => {
    const { id } = req.params;

    try {
        const taskR = await pool.query(
            `SELECT TaskName, Username FROM Tasks WHERE TaskID = $1 AND status = 'pending'`,
            [id]
        );

        if (taskR.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found or already completed' });
        }

        const task = taskR.rows[0];

        await pool.query(
            `UPDATE Tasks SET status = 'done' WHERE TaskID = $1`,
            [id]
        );

        await pool.query(`
            INSERT INTO RecentEvents (EventName, Description, EventDate, MemberName)
            VALUES ($1, 'Completed task', $2, $3)
        `, [task.taskname, new Date(), task.username]);

        res.json({ success: true, message: 'Task marked as done' });
    } catch (err) {
        console.error('Task done error:', err.message);
        res.status(500).json({ error: 'Server error while completing task' });
    }
});

// ----- Sync -----

app.post('/sync', (req, res) => {
    const { actions } = req.body;

    if (!Array.isArray(actions)) {
        return res.status(400).json({ error: 'Actions must be an array' });
    }

    console.log(`Synced ${actions.length} pending action(s)`);
    res.json({
        success: true,
        message: 'Pending actions synced successfully',
        synced: actions.length
    });
});

// ----- Dashboard routes -----

app.get('/dashboard/stats', async (req, res) => {
    try {
        const [tasksR, membersR, schedulesR, upcomingR] = await Promise.all([
            pool.query(`SELECT COUNT(*) AS cnt FROM Tasks WHERE status = 'pending'`),
            pool.query(`SELECT COUNT(*) AS cnt FROM users`),
            pool.query(`SELECT COUNT(*) AS cnt FROM UpcomingEvents`),
            pool.query(`SELECT COUNT(*) AS cnt FROM Tasks WHERE status = 'pending' AND TaskDate >= CURRENT_DATE`)
        ]);

        res.json({
            success: true,
            stats: {
                tasks: parseInt(tasksR.rows[0].cnt),
                members: parseInt(membersR.rows[0].cnt),
                schedules: parseInt(schedulesR.rows[0].cnt),
                upcoming: parseInt(upcomingR.rows[0].cnt)
            }
        });
    } catch (err) {
        console.error('Dashboard stats error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/dashboard/recent-tasks', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT EventName, EventDate, MemberName
            FROM RecentEvents
            ORDER BY LoggedAt DESC
            LIMIT 5
        `);
        res.json({ success: true, tasks: result.rows });
    } catch (err) {
        console.error('Recent tasks error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/dashboard/upcoming-tasks', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT TaskName AS EventName, TaskDate, TaskTime, Username
            FROM Tasks
            WHERE status = 'pending' AND TaskDate >= CURRENT_DATE
            ORDER BY TaskDate ASC, TaskTime ASC
            LIMIT 5
        `);
        res.json({ success: true, tasks: result.rows });
    } catch (err) {
        console.error('Upcoming tasks error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// ----- Events / Schedules -----

app.get('/events', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT UpcomingEventID, EventName, Description, EventDate, MemberName
            FROM UpcomingEvents
            ORDER BY EventDate ASC
        `);
        res.json({ success: true, events: result.rows });
    } catch (err) {
        console.error('Events fetch error:', err.message);
        res.status(500).json({ error: 'Server error while loading events' });
    }
});

app.post('/events', async (req, res) => {
    const { eventName, description, eventDate, memberName } = req.body;

    if (!eventName || !eventDate || !memberName) {
        return res.status(400).json({ error: 'Event name, date, and member name are required' });
    }

    try {
        await pool.query(`
            INSERT INTO UpcomingEvents (EventName, Description, EventDate, MemberName)
            VALUES ($1, $2, $3, $4)
        `, [eventName, description || '', eventDate, memberName]);

        res.json({ success: true, message: 'Event created successfully' });
    } catch (err) {
        console.error('Event create error:', err.message);
        res.status(500).json({ error: 'Server error while creating event' });
    }
});

app.get('/events/conflict', async (req, res) => {
    const { username, date } = req.query;

    if (!username || !date) {
        return res.status(400).json({ error: 'Username and date are required' });
    }

    try {
        const result = await pool.query(`
            SELECT EventName, EventDate
            FROM UpcomingEvents
            WHERE MemberName = $1 AND EventDate::DATE = $2::DATE
        `, [username, date]);

        res.json({
            success: true,
            conflict: result.rows.length > 0,
            event: result.rows[0] || null
        });
    } catch (err) {
        console.error('Conflict check error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// ----- Notifications -----

app.get('/notifications', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const result = await pool.query(`
            SELECT TaskName, AssignedByName, TaskDate, TaskTime
            FROM Tasks
            WHERE AssignedBy != $1 AND Username IN (
                SELECT username FROM users WHERE id = $1
            ) AND status = 'pending'
            ORDER BY CreatedAt DESC
        `, [userId]);

        res.json({
            success: true,
            count: result.rows.length,
            notifications: result.rows
        });
    } catch (err) {
        console.error('Notifications error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// ----- Invite Routes -----

app.get('/invites/:token', async (req, res) => {
    const { token } = req.params;
    try {
        const result = await pool.query(
            `SELECT fi.id, fi.family_id, f.name AS family_name
             FROM FamilyInvitations fi
             JOIN families f ON f.id = fi.family_id
             WHERE fi.token = $1 AND fi.is_active = TRUE AND fi.expires_at > NOW()`,
            [token]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invitation not found or expired' });
        }
        res.json({ success: true, familyName: result.rows[0].family_name });
    } catch (err) {
        console.error('Invite lookup error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/invite', async (req, res) => {
    const { recipientEmail, familyId } = req.body;

    if (!recipientEmail || !familyId) {
        return res.status(400).json({ error: 'Recipient email and family ID required' });
    }
    if (!isValidEmail(recipientEmail)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }

    try {
        const token = crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await pool.query(
            `INSERT INTO FamilyInvitations (family_id, recipient_email, token, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [familyId, recipientEmail, token, expiresAt]
        );

        const familyR = await pool.query(`SELECT name FROM families WHERE id = $1`, [familyId]);

        sendInviteEmail(recipientEmail, familyR.rows[0]?.name || 'Family', token).catch(function () {});

        res.json({
            success: true,
            message: 'Invitation sent',
            token: token,
            inviteLink: 'https://family-tracker-project.vercel.app/user_invite/invite_setup.html?token=' + token
        });
    } catch (err) {
        console.error('Invite error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// ----- Delete Account Route (7-day grace) -----

app.post('/profile/:id/delete', async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password confirmation is required' });
    }

    const client = await pool.connect();
    try {
        const userR = await client.query(
            `SELECT id, username, role, family_id FROM users WHERE id = $1 AND password = $2`,
            [id, password]
        );
        if (userR.rows.length === 0) {
            return res.status(401).json({ error: 'Password confirmation failed' });
        }

        const user = userR.rows[0];
        const isAdmin = (user.role === 'father' || user.role === 'mother');

        await client.query('BEGIN');

        // Record in DeletedAccounts for 7-day grace
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const hash = hashIdentifier(user.username);

        await client.query(
            `INSERT INTO DeletedAccounts (username_hash, expires_at) VALUES ($1, $2)
             ON CONFLICT (username_hash) DO UPDATE SET expires_at = $2`,
            [hash, expiresAt]
        );

        if (isAdmin && user.family_id) {
            // Delete entire family
            await client.query(`UPDATE users SET family_id = NULL WHERE family_id = $1`, [user.family_id]);
            await client.query(`DELETE FROM users WHERE family_id = $1`, [user.family_id]);
            await client.query(`DELETE FROM families WHERE id = $1`, [user.family_id]);
        } else {
            // Delete just this user's data
            await client.query(`DELETE FROM Tasks WHERE Username = $1 OR AssignedByName = $1`, [user.username]);
            await client.query(`DELETE FROM UpcomingEvents WHERE MemberName = $1`, [user.username]);
            await client.query(`DELETE FROM RecentEvents WHERE MemberName = $1`, [user.username]);
            await client.query(`DELETE FROM users WHERE id = $1`, [user.id]);
        }

        await client.query('COMMIT');
        await logAudit(user.username, user.role, 'Account Deleted (7-day grace)', 'Success');
        res.json({ success: true, message: 'Account deleted successfully. You have 7 days to recover.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Account deletion error:', err.message);
        res.status(500).json({ error: 'Server error while deleting account' });
    } finally {
        client.release();
    }
});

// ----- Audit Log Helper -----

async function logAudit(username, userRole, action, status) {
    try {
        await pool.query(
            `INSERT INTO audit_logs (username, user_role, action, status) VALUES ($1, $2, $3, $4)`,
            [username || 'system', userRole || 'system', action, status || 'Success']
        );
    } catch (err) {
        console.error('Audit log error:', err.message);
    }
}

// ----- Super Admin seed on startup (if not exists) -----

async function seedSuperAdmin() {
    try {
        const result = await pool.query(`SELECT id FROM users WHERE is_super_admin = TRUE`);
        if (result.rows.length === 0) {
            const saEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@gmail.com';
            const saPass = process.env.SUPERADMIN_PASS || 'superadmin123';
            await pool.query(
                `INSERT INTO users (email, username, password, role, is_super_admin, emailverified)
                 VALUES ($1, $2, $3, $4, TRUE, TRUE)`,
                [saEmail, 'superadmin', saPass, 'super_admin']
            );
            console.log('Super admin seeded: ' + saEmail);
        }
    } catch (err) {
        console.error('Super admin seed error:', err.message);
    }
}

// ----- Audit Routes -----

app.get('/audit/all', async (req, res) => {
    try {
        const { search, role, action, status, limit } = req.query;
        const conditions = ['1=1'];
        const params = [];
        let idx = 1;

        if (search) {
            conditions.push(`(username ILIKE $${idx} OR action ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }
        if (role) {
            conditions.push(`user_role = $${idx++}`);
            params.push(role);
        }
        if (action) {
            conditions.push(`action = $${idx++}`);
            params.push(action);
        }
        if (status) {
            conditions.push(`status = $${idx++}`);
            params.push(status);
        }

        const where = conditions.join(' AND ');
        const pageLimit = parseInt(limit) || 50;

        const countR = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs WHERE ${where}`, params);
        const dataR = await pool.query(
            `SELECT id, username, user_role AS role, action, status,
                    TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
                    TO_CHAR(created_at, 'HH24:MI') AS time
             FROM audit_logs WHERE ${where}
             ORDER BY created_at DESC LIMIT $${idx}`, [...params, pageLimit]
        );

        res.json({ success: true, total: parseInt(countR.rows[0].total), data: dataR.rows });
    } catch (err) {
        console.error('Audit all error:', err.message);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

app.get('/audit/families-overview', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT f.id, f.name AS family_name,
                   u.username AS admin_username, u.email AS admin_email,
                   (SELECT COUNT(*) FROM users WHERE family_id = f.id) AS member_count,
                   f.status, f.created_at AS date_created
            FROM families f
            LEFT JOIN users u ON u.id = f.admin_id
            ORDER BY f.created_at DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Families overview error:', err.message);
        res.status(500).json({ error: 'Failed to fetch families' });
    }
});

// ----- Invitation Routes -----

app.post('/invitations', async (req, res) => {
    const { email, role, familyId } = req.body;

    if (!email || !role || !familyId) {
        return res.status(400).json({ error: 'Email, role, and family ID required' });
    }

    try {
        const token = require('crypto').randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await pool.query(
            `INSERT INTO invitations (email, role, family_id, token, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [email, role, familyId, token, expiresAt]
        );

        await logAudit(req.body.username || 'system', 'family_admin', 'Member Invited', 'Success');

        res.json({ success: true, message: 'Invitation created successfully', token });
    } catch (err) {
        console.error('Invitation error:', err.message);
        res.status(500).json({ error: 'Failed to create invitation' });
    }
});

app.post('/invitations/accept', async (req, res) => {
    const { token, username, email, password } = req.body;

    if (!token || !username || !email || !password) {
        return res.status(400).json({ error: 'Token, username, email, and password required' });
    }

    try {
        const invR = await pool.query(
            `SELECT i.*, f.name AS family_name FROM invitations i
             JOIN families f ON f.id = i.family_id
             WHERE i.token = $1 AND i.accepted = FALSE AND i.expires_at > NOW()`,
            [token]
        );

        if (invR.rows.length === 0) {
            return res.status(400).json({ error: 'This invitation link is invalid or has expired.' });
        }

        const invitation = invR.rows[0];

        const userR = await pool.query(
            `INSERT INTO users (email, username, password, role, family_id, emailverified)
             VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id`,
            [email, username, password, invitation.role, invitation.family_id]
        );

        await pool.query(`UPDATE invitations SET accepted = TRUE WHERE id = $1`, [invitation.id]);

        await logAudit(username, invitation.role, 'Account Created via Invitation', 'Success');

        res.json({
            success: true,
            message: 'Account created successfully',
            user: {
                id: userR.rows[0].id,
                email: email,
                username: username,
                role: invitation.role
            }
        });
    } catch (err) {
        console.error('Accept invitation error:', err.message);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username or email already exists' });
        }
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// ----- Family Management Routes -----

app.get('/families', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT f.*, u.username AS admin_username, u.email AS admin_email,
                   (SELECT COUNT(*) FROM users WHERE family_id = f.id) AS member_count
            FROM families f
            LEFT JOIN users u ON u.id = f.admin_id
            ORDER BY f.created_at DESC
        `);
        res.json({ success: true, families: result.rows });
    } catch (err) {
        console.error('Families list error:', err.message);
        res.status(500).json({ error: 'Failed to fetch families' });
    }
});

app.put('/families/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['Active', 'Suspended'].includes(status)) {
        return res.status(400).json({ error: 'Status must be Active or Suspended' });
    }

    try {
        await pool.query(`UPDATE families SET status = $1 WHERE id = $2`, [status, id]);
        await logAudit('system', 'super_admin', 'Family ' + status, 'Success');
        res.json({ success: true, message: 'Family ' + status });
    } catch (err) {
        console.error('Family status error:', err.message);
        res.status(500).json({ error: 'Failed to update family status' });
    }
});

// ----- Delete Routes -----

app.delete('/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const task = await pool.query(`SELECT TaskName, Username FROM Tasks WHERE TaskID = $1`, [id]);
        if (task.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

        await pool.query(`DELETE FROM Tasks WHERE TaskID = $1`, [id]);
        await logAudit(task.rows[0].username, 'system', 'Task Deleted', 'Success');
        res.json({ success: true, message: 'Task deleted successfully' });
    } catch (err) {
        console.error('Delete task error:', err.message);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

app.delete('/events/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`DELETE FROM UpcomingEvents WHERE UpcomingEventID = $1`, [id]);
        await logAudit('system', 'system', 'Event Deleted', 'Success');
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (err) {
        console.error('Delete event error:', err.message);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

app.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const user = await pool.query(`SELECT username, role, family_id, is_super_admin FROM users WHERE id = $1`, [id]);
        if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const u = user.rows[0];

        // If super admin, don't allow deletion
        if (u.is_super_admin) {
            return res.status(403).json({ error: 'Cannot delete the super admin account' });
        }

        // If father (family admin), delete the whole family
        if (u.role === 'father' && u.family_id) {
            await pool.query(`DELETE FROM invitations WHERE family_id = $1`, [u.family_id]);
            await pool.query(`UPDATE users SET family_id = NULL WHERE family_id = $1`, [u.family_id]);
            await pool.query(`DELETE FROM families WHERE id = $1`, [u.family_id]);
        }

        await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
        await logAudit(u.username, u.role, 'Account Deleted', 'Success');
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        console.error('Delete user error:', err.message);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ----- Start server -----

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Database: ${process.env.PGDATABASE || 'familytrackerdb'} on ${process.env.PGHOST || 'localhost'}`);
    seedSuperAdmin();
});
