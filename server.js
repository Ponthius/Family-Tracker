const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 4001;

const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'familytrackerdb',
    user: process.env.PGUSER || 'familytracker_user',
    password: process.env.PGPASSWORD || 'familytracker_pass'
});

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ success: true, status: 'online' });
});

// ----- Register -----

app.post('/register', async (req, res) => {
    const { email, username, password, role } = req.body;

    if (!email || !username || !password || !role) {
        return res.status(400).json({ error: 'All fields required' });
    }

    try {
        // Check for duplicate father/mother role
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

        await pool.query(
            `INSERT INTO users (email, username, password, role) VALUES ($1, $2, $3, $4)`,
            [email, username, password, role]
        );

        res.json({ success: true, message: 'User registered successfully' });
    } catch (err) {
        console.error('Register error:', err.message);

        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username or email already exists' });
        }

        res.status(500).json({ error: 'Server error while registering user' });
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
            `SELECT id, email, username, role FROM users WHERE username = $1 AND password = $2`,
            [username, password]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        res.json({
            success: true,
            message: 'Login successful',
            user: result.rows[0]
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

// ----- Mark task done -----

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
