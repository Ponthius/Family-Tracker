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

const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:8080';
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
    return emailRegex.test(String(email || '').trim());
}

function hashIdentifier(value) {
    return crypto
        .createHash('sha256')
        .update(String(value || '').trim().toLowerCase())
        .digest('hex');
}

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

async function sendInviteEmail(email, familyName, token) {
    const inviteLink = `${appBaseUrl}/register.html?invite=${token}`;
    await transporter.sendMail({
        from: process.env.EMAIL_USER || 'hafizashiraf180@gmail.com',
        to: email,
        subject: `You're invited to join the ${familyName} family`,
        html: `
            <h2>Family Tracker Invitation</h2>
            <p>You have been invited to join the <strong>${familyName}</strong> family group.</p>
            <p>Click the button below to register and join your family:</p>
            <a href="${inviteLink}" style="display:inline-block;padding:12px 24px;background:#3d3530;color:#fff;text-decoration:none;border-radius:6px;">Join Family</a>
            <p>If you did not expect this invitation, you can ignore this email.</p>
        `
    });
}

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ success: true, status: 'online' });
});

// ----- Register -----

app.post('/register', async (req, res) => {
    const { email, username, password, familyName, inviteToken } = req.body;

    if (!email || !username || !password || (!inviteToken && !familyName)) {
        return res.status(400).json({ error: 'All fields required' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    try {
        const existing = await pool.query(
            `SELECT email, username FROM users WHERE email = $1 OR username = $2 LIMIT 1`,
            [email, username]
        );

        if (existing.rows.length) {
            const conflict = existing.rows[0];
            if (conflict.email === email) {
                return res.status(409).json({ error: 'Email already exists' });
            }
            if (conflict.username === username) {
                return res.status(409).json({ error: 'Username already exists' });
            }
        }

        let familyId;
        let role = 'member';

        if (inviteToken) {
            const inviteResult = await pool.query(
                `SELECT InvitationID, FamilyID
                 FROM FamilyInvitations
                 WHERE InvitationToken = $1
                   AND isActive = TRUE
                   AND (ExpiresAt IS NULL OR ExpiresAt > NOW())`,
                [inviteToken]
            );

            if (inviteResult.rows.length === 0) {
                return res.status(400).json({ error: 'Invitation is invalid or expired.' });
            }

            familyId = inviteResult.rows[0].familyid;
        } else {
            const familyResult = await pool.query(
                `INSERT INTO Families (FamilyName)
                 VALUES ($1)
                 RETURNING FamilyID`,
                [String(familyName).trim()]
            );
            familyId = familyResult.rows[0].familyid;
            role = 'admin';
        }

        const userResult = await pool.query(
            `INSERT INTO users (email, username, password, role, emailverified, familyid)
             VALUES ($1, $2, $3, $4, TRUE, $5)
             RETURNING id`,
            [email, username, password, role, familyId]
        );

        if (inviteToken) {
            await pool.query(
                `UPDATE FamilyInvitations
                 SET isActive = FALSE,
                     AcceptedAt = NOW(),
                     AcceptedByUserID = $1
                 WHERE InvitationToken = $2`,
                [userResult.rows[0].id, inviteToken]
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

app.get('/invites/:token', async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.status(400).json({ error: 'Invitation token required' });
    }

    try {
        const inviteResult = await pool.query(
            `SELECT i.InvitationID, i.FamilyID, f.FamilyName
             FROM FamilyInvitations i
             JOIN Families f ON f.FamilyID = i.FamilyID
             WHERE i.InvitationToken = $1
               AND i.isActive = TRUE
               AND (i.ExpiresAt IS NULL OR i.ExpiresAt > NOW())`,
            [token]
        );

        if (inviteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invitation not found or expired' });
        }

        const invite = inviteResult.rows[0];
        res.json({
            success: true,
            invitation: {
                familyId: invite.familyid,
                familyName: invite.familyname
            }
        });
    } catch (err) {
        console.error('Invite lookup error:', err.message);
        res.status(500).json({ error: 'Server error while fetching invitation' });
    }
});

app.post('/invite', async (req, res) => {
    const { recipientEmail, familyId, invitedById } = req.body;

    if (!recipientEmail || !familyId || !invitedById) {
        return res.status(400).json({ error: 'Recipient email, family, and inviter are required' });
    }

    if (!isValidEmail(recipientEmail)) {
        return res.status(400).json({ error: 'Please enter a valid recipient email address' });
    }

    try {
        const inviterResult = await pool.query(
            `SELECT id, role, familyid FROM users WHERE id = $1`,
            [invitedById]
        );

        if (inviterResult.rows.length === 0) {
            return res.status(404).json({ error: 'Inviter not found' });
        }

        const inviter = inviterResult.rows[0];
        const isAdmin = inviter.role === 'admin' || inviter.role === 'father';
        if (!isAdmin) {
            return res.status(403).json({ error: 'Only admins can send invitations' });
        }

        if (parseInt(inviter.familyid) !== parseInt(familyId)) {
            return res.status(403).json({ error: 'Inviter does not belong to this family' });
        }

        const existingUser = await pool.query(
            `SELECT id FROM users WHERE email = $1`,
            [recipientEmail]
        );
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Email already exists' });
        }

        const familyResult = await pool.query(
            `SELECT FamilyName FROM Families WHERE FamilyID = $1`,
            [familyId]
        );
        if (familyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Family not found' });
        }

        const familyName = familyResult.rows[0].familyname;
        const token = crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await pool.query(
            `INSERT INTO FamilyInvitations (FamilyID, RecipientEmail, InvitationToken, InvitedByUserID, ExpiresAt)
             VALUES ($1, $2, $3, $4, $5)`,
            [familyId, recipientEmail, token, invitedById, expiresAt]
        );

        sendInviteEmail(recipientEmail, familyName, token).catch(err => {
            console.error('Failed to send invite email:', err.message);
        });

        res.json({ success: true, message: 'Invitation sent successfully' });
    } catch (err) {
        console.error('Invite error:', err.message);
        res.status(500).json({ error: 'Server error while sending invitation' });
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
        const normalizedUsername = String(username).trim();
        const result = await pool.query(
            `SELECT u.id, u.email, u.username, u.password, u.role, u.emailverified, u.familyid,
                    f.familyname
             FROM users u
             LEFT JOIN Families f ON f.FamilyID = u.familyid
             WHERE u.username = $1`,
            [normalizedUsername]
        );

        if (result.rows.length === 0) {
            const deletedCheck = await pool.query(
                `SELECT 1 FROM DeletedAccounts WHERE UsernameHash = $1 LIMIT 1`,
                [hashIdentifier(normalizedUsername)]
            );

            if (deletedCheck.rows.length > 0) {
                return res.status(403).json({ error: 'This account has been deleted or suspended.' });
            }

            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = result.rows[0];

        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                familyId: user.familyid || null,
                familyName: user.familyname || ''
            }
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Server error while logging in' });
    }
});

// ----- Members -----

app.get('/members', async (req, res) => {
    const { familyId } = req.query;

    try {
        const query = familyId
            ? `SELECT id, role, username, email FROM users WHERE familyid = $1 ORDER BY created_at DESC`
            : `SELECT id, role, username, email FROM users ORDER BY created_at DESC`;
        const params = familyId ? [familyId] : [];
        const result = await pool.query(query, params);

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

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('Password update error:', err.message);
        res.status(500).json({ error: 'Server error while updating password' });
    }
});

app.post('/profile/:id/delete', async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password confirmation is required' });
    }

    const client = await pool.connect();

    try {
        const userResult = await client.query(
            `SELECT id, username, role, familyid
             FROM users
             WHERE id = $1 AND password = $2`,
            [id, password]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Password confirmation failed' });
        }

        const user = userResult.rows[0];
        const isAdmin = user.role === 'admin' || user.role === 'father';
        const familyId = user.familyid;

        await client.query('BEGIN');

        let userIds = [user.id];
        let usernames = [user.username];

        if (isAdmin && familyId) {
            const familyUsers = await client.query(
                `SELECT id, username FROM users WHERE familyid = $1`,
                [familyId]
            );
            if (familyUsers.rows.length) {
                userIds = familyUsers.rows.map(row => row.id);
                usernames = familyUsers.rows.map(row => row.username);
            }
        }

        const hashes = usernames.filter(Boolean).map(hashIdentifier);
        if (hashes.length) {
            await client.query(
                `INSERT INTO DeletedAccounts (UsernameHash)
                 SELECT UNNEST($1::text[])
                 ON CONFLICT (UsernameHash) DO NOTHING`,
                [hashes]
            );
        }

        if (usernames.length) {
            await client.query(
                `DELETE FROM Tasks
                 WHERE Username = ANY($1::text[])
                    OR AssignedBy = ANY($2::int[])`,
                [usernames, userIds]
            );
            await client.query(
                `DELETE FROM UpcomingEvents WHERE MemberName = ANY($1::text[])`,
                [usernames]
            );
            await client.query(
                `DELETE FROM RecentEvents WHERE MemberName = ANY($1::text[])`,
                [usernames]
            );
        }

        if (userIds.length) {
            await client.query(
                `DELETE FROM Members WHERE AddedByUserID = ANY($1::int[])`,
                [userIds]
            );
        }

        if (isAdmin && familyId) {
            await client.query(`DELETE FROM users WHERE familyid = $1`, [familyId]);
            await client.query(`DELETE FROM Families WHERE FamilyID = $1`, [familyId]);
        } else {
            await client.query(`DELETE FROM users WHERE id = $1`, [user.id]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Account deletion error:', err.message);
        res.status(500).json({ error: 'Server error while deleting account' });
    } finally {
        client.release();
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

// ----- Start server -----

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Database: ${process.env.PGDATABASE || 'familytrackerdb'} on ${process.env.PGHOST || 'localhost'}`);
});
