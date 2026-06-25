const express = require('express');
const sql = require('mssql/msnodesqlv8');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { error } = require('console');

const app = express();
const port = process.env.PORT || 4001;
const dbServer = process.env.DB_SERVER || `${process.env.COMPUTERNAME || 'localhost'}\\SQLEXPRESS`;
const dbName = process.env.DB_NAME || 'familytrackerdb';
const dbDriver = process.env.DB_DRIVER || 'ODBC Driver 17 for SQL Server';

const dbConfig = {
    connectionString: `Driver={${dbDriver}};Server=${dbServer};Database=${dbName};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`
};

let poolPromise;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'yourgmail@gmail.com',
        pass: 'your-app-password'
    }
});

async function sendVerificationEmail(email, token){
    const verificationLink = `http://localhost:4001/verify-email?token=${token}`;
    await transporter.sendMail({
        from: 'yourgail@gmail.com',
        to: email,
        subject: 'Verify your Email',
        html:  `
            <h2>Family Tracker Email Verification</h2>

            <p>
                Click the button below to verify your email.
            </p>

            <a href="${verificationLink}">
                Verify Email
            </a>

            <p>
                This link expires in 24 hours.
            </p>
        `
    });
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/health', (req, res) => {
    res.json({ success: true, status: 'online' });
});

function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(dbConfig);
    }

    return poolPromise;
}

async function connectDB() {
    try {
        await getPool();
        console.log(`Connected to SQL Server: ${dbServer}/${dbName}`);
    } catch (err) {
        poolPromise = null;
        console.error('DB connection error:', err.message);
        console.error(`Check that SQL Server Express is running and "${dbName}" exists.`);
        console.error(`Current DB_SERVER is "${dbServer}".`);
        console.error(`Current DB_DRIVER is "${dbDriver}".`);
    }
}

app.post('/register', async (req, res) => {
    const { email, username, password, role } = req.body;

    if (!email || !username || !password || !role) {
        return res.status(400).json({ error: 'All fields required' });
    }

    try {
        const pool = await getPool();

        // Check for duplicate father/mother role
        const roleCheck = await pool.request()
            .input('role', sql.NVarChar, role)
            .query(`SELECT COUNT(*) AS cnt FROM dbo.users WHERE role = @role`);

        if (role === 'father' && roleCheck.recordset[0].cnt > 0) {
            return res.status(409).json({ error: 'Father role is already registered. Only one father allowed.' });
        }
        if (role === 'mother' && roleCheck.recordset[0].cnt > 0) {
            return res.status(409).json({ error: 'Mother role is already registered. Only one mother allowed.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.new() + 24 * 60 * 60 * 10000);
        const userResults = await pool.request()
            .input('email', sql.NVarChar, email)
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, password)
            .input('role', sql.NVarChar, role)
            .query(`
                INSERT INTO dbo.users (
                Email,
                Username,
                Password,
                UserRole,
                Title,
                EmailVerified
                )
                OUTPUT INSERTED.UserID
                VALUES(
                   @email,
                   @username,
                   @password,
                   @role,
                   'Member',
                   0
                ) 
            `);

        const userId =
userResult.recordset[0].UserID;

await pool.request()
    .input('userId', sql.Int, userId)
    .input('token', sql.NVarChar, token)
    .input('expiresAt', sql.DateTime, expiresAt)
    .query(`
        INSERT INTO dbo.EmailVerifications
        (
            UserID,
            VerificationToken,
            ExpiresAt
        )
        VALUES
        (
            @userId,
            @token,
            @expiresAt
        )
    `);

await sendVerificationEmail(
    email,
    token
);    

        res.json({ success: true, message: 'Registration successfull. Please verify your email.' });
    } catch (err) {
        console.error('Register error:', err.message);

        if (err.number === 2627 || err.number === 2601) {
            return res.status(409).json({ error: 'Username or email already exists' });
        }

        res.status(500).json({ error: 'Server error while registering user' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, password)
            .query(`
                SELECT 
                UserId,
                Email,
                username,
                UserRole,
                EmailVerified
                FROM dbo.users
                WHERE username = @username 
                AND password = @password
            `);

        if (result.recordset.length === 0) {
            return res.status(401).json({
                 error: 'Invalid username or password' 
            });
        }

        const user = result.recordset[0];

        if(!user.EmailVerified){
            return res.status(403).json({
                error:
                'Please verify your email address before logging in.'
            });
        }

        res.json({
            success: true,
            message: 'Login successful',
            user: result.recordset[0]
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Server error while logging in' });
    }
});

app.get('/members', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT id, role, username, email
                FROM dbo.users
                ORDER BY created_at DESC
            `);

        res.json({
            success: true,
            members: result.recordset
        });
    } catch (err) {
        console.error('Members error:', err.message);
        res.status(500).json({ error: 'Server error while loading members' });
    }
});

// ----- Profile routes -----

app.get('/profile/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT id, email, username, role, fullname, profile_photo
                FROM dbo.users
                WHERE id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: result.recordset[0]
        });
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
        const pool = await getPool();
        const request = pool.request().input('id', sql.Int, id);

        const setClauses = [];
        if (username !== undefined) {
            request.input('username', sql.NVarChar, username);
            setClauses.push('username = @username');
        }
        if (fullname !== undefined) {
            request.input('fullname', sql.NVarChar, fullname);
            setClauses.push('fullname = @fullname');
        }
        if (email !== undefined) {
            request.input('email', sql.NVarChar, email);
            setClauses.push('email = @email');
        }

        await request.query(`
            UPDATE dbo.users SET ${setClauses.join(', ')}
            WHERE id = @id
        `);

        // Fetch and return updated user
        const updated = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT id, email, username, role, fullname, profile_photo
                FROM dbo.users WHERE id = @id
            `);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: updated.recordset[0]
        });
    } catch (err) {
        console.error('Profile update error:', err.message);

        if (err.number === 2627 || err.number === 2601) {
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
        const pool = await getPool();

        // Verify current password
        const user = await pool.request()
            .input('id', sql.Int, id)
            .input('password', sql.NVarChar, currentPassword)
            .query(`
                SELECT id FROM dbo.users
                WHERE id = @id AND password = @password
            `);

        if (user.recordset.length === 0) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Update to new password
        await pool.request()
            .input('id', sql.Int, id)
            .input('newPassword', sql.NVarChar, newPassword)
            .query(`
                UPDATE dbo.users SET password = @newPassword
                WHERE id = @id
            `);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('Password update error:', err.message);
        res.status(500).json({ error: 'Server error while updating password' });
    }
});

app.get('/tasks', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT TaskID, Role, Username, TaskName, Description,
                       TaskDate, TaskTime, status, AssignedBy, AssignedByName
                FROM dbo.Tasks
                WHERE status = 'pending'
                ORDER BY TaskDate DESC, TaskTime DESC
            `);

        res.json({
            success: true,
            tasks: result.recordset
        });
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
        const pool = await getPool();

        await pool.request()
            .input('role', sql.NVarChar, role)
            .input('username', sql.NVarChar, username)
            .input('taskName', sql.NVarChar, taskName)
            .input('description', sql.NVarChar, description || '')
            .input('taskDate', sql.Date, date)
            .input('taskTime', sql.Time, time)
            .input('assignedBy', sql.Int, assignedById || null)
            .input('assignedByName', sql.NVarChar, assignedByName || '')
            .query(`
                INSERT INTO dbo.Tasks (Role, Username, TaskName, Description, TaskDate, TaskTime, AssignedBy, AssignedByName, status)
                VALUES (@role, @username, @taskName, @description, @taskDate, @taskTime, @assignedBy, @assignedByName, 'pending')
            `);

        res.json({ success: true, message: 'Task created successfully' });
    } catch (err) {
        console.error('Task create error:', err.message);
        res.status(500).json({ error: 'Server error while creating task' });
    }
});

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
        const pool = await getPool();
        const [tasksR, membersR, schedulesR, upcomingR] = await Promise.all([
            pool.request().query(`SELECT COUNT(*) AS cnt FROM dbo.Tasks WHERE status = 'pending'`),
            pool.request().query(`SELECT COUNT(*) AS cnt FROM dbo.users`),
            pool.request().query(`SELECT COUNT(*) AS cnt FROM dbo.UpcomingEvents`),
            pool.request().query(`SELECT COUNT(*) AS cnt FROM dbo.Tasks WHERE status = 'pending' AND TaskDate >= CAST(GETDATE() AS DATE)`)
        ]);

        res.json({
            success: true,
            stats: {
                tasks: tasksR.recordset[0].cnt,
                members: membersR.recordset[0].cnt,
                schedules: schedulesR.recordset[0].cnt,
                upcoming: upcomingR.recordset[0].cnt
            }
        });
    } catch (err) {
        console.error('Dashboard stats error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/dashboard/recent-tasks', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT TOP 5 EventName, EventDate, MemberName
                FROM dbo.RecentEvents
                ORDER BY LoggedAt DESC
            `);
        res.json({ success: true, tasks: result.recordset });
    } catch (err) {
        console.error('Recent tasks error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/dashboard/upcoming-tasks', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT TOP 5 TaskName AS EventName, TaskDate, TaskTime, Username
                FROM dbo.Tasks
                WHERE status = 'pending' AND TaskDate >= CAST(GETDATE() AS DATE)
                ORDER BY TaskDate ASC, TaskTime ASC
            `);
        res.json({ success: true, tasks: result.recordset });
    } catch (err) {
        console.error('Upcoming tasks error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// ----- Mark task done -----

app.put('/tasks/:id/done', async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await getPool();

        // Get the task before updating
        const taskR = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT TaskName, Username FROM dbo.Tasks WHERE TaskID = @id AND status = 'pending'`);

        if (taskR.recordset.length === 0) {
            return res.status(404).json({ error: 'Task not found or already completed' });
        }

        const task = taskR.recordset[0];

        // Mark as done
        await pool.request()
            .input('id', sql.Int, id)
            .query(`UPDATE dbo.Tasks SET status = 'done' WHERE TaskID = @id`);

        // Insert into RecentEvents
        await pool.request()
            .input('eventName', sql.NVarChar, task.TaskName)
            .input('memberName', sql.NVarChar, task.Username)
            .input('eventDate', sql.DateTime, new Date())
            .query(`
                INSERT INTO dbo.RecentEvents (EventName, Description, EventDate, MemberName)
                VALUES (@eventName, 'Completed task', @eventDate, @memberName)
            `);

        res.json({ success: true, message: 'Task marked as done' });
    } catch (err) {
        console.error('Task done error:', err.message);
        res.status(500).json({ error: 'Server error while completing task' });
    }
});

// ----- Events / Schedule routes -----

app.get('/events', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT UpcomingEventID, EventName, Description, EventDate, MemberName
                FROM dbo.UpcomingEvents
                ORDER BY EventDate ASC
            `);
        res.json({ success: true, events: result.recordset });
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
        const pool = await getPool();
        await pool.request()
            .input('eventName', sql.NVarChar, eventName)
            .input('description', sql.NVarChar, description || '')
            .input('eventDate', sql.DateTime, eventDate)
            .input('memberName', sql.NVarChar, memberName)
            .query(`
                INSERT INTO dbo.UpcomingEvents (EventName, Description, EventDate, MemberName)
                VALUES (@eventName, @description, @eventDate, @memberName)
            `);
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
        const pool = await getPool();
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('date', sql.Date, date)
            .query(`
                SELECT EventName, EventDate
                FROM dbo.UpcomingEvents
                WHERE MemberName = @username AND CAST(EventDate AS DATE) = @date
            `);

        res.json({
            success: true,
            conflict: result.recordset.length > 0,
            event: result.recordset[0] || null
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
        const pool = await getPool();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT TaskName, AssignedByName, TaskDate, TaskTime
                FROM dbo.Tasks
                WHERE AssignedBy != @userId AND Username IN (
                    SELECT username FROM dbo.users WHERE id = @userId
                ) AND status = 'pending'
                ORDER BY CreatedAt DESC
            `);

        res.json({
            success: true,
            count: result.recordset.length,
            notifications: result.recordset
        });
    } catch (err) {
        console.error('Notifications error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// --Email Router--

app.get('/verify-email', async(req, res) => {
    const { token } = req.query;

    if(!token){
        return res.status(400).send('Verification token is required');
    }
    try{
    const pool = await getPool();
    const verificationResults = await pool.request()
        .input('token', sql.NVarChar, token)
        .query(`
            SELECT *
            FROM dbo.EmailVerifications
            WHERE VerificationToken = @token
            AND IsActive = 1
            AND ExpiresAt > GETDATE()
            `);
    if (verificationResults.recordset.length === 0) {
        return res.status(400).send(
            'Invalid or expired verification link.'
        );
    }       
    const verification = verificationResults.recordset[0];
    await pool.request()
    .input('userId', sql.Int, verification.UserID)
    .query(`
        UPDATE dbo.Users
        SET EmailVerified = 1
        WHERE UserID = @userId
        `);
    await pool.request()
    .input('verification', sql.Int, verification.verificationID)
    .query(`
        UPDATE dbo.EmailVerifications
        SET
           isActive = 0,
           VerifiedAt = GETDATE()
        WHERE VerificationID = @verificationId   
        `);    
    res.send(`
        <h2>Email Verified Successfully</h2>
        <p>You can now login to Family Tracker</p>
        `);
    } catch (err){
        console.error('Verification error:', err.message);

        res.status(500).send(
            'Server error while verifying email'
        );
   }
});

app.post('/resend-verification', async (req, res) => {

    const { email } = req.body;

    try {

        const pool = await getPool();

        const userResult = await pool.request()
            .input('email', sql.NVarChar, email)
            .query(`
                SELECT UserID, EmailVerified
                FROM dbo.Users
                WHERE Email = @email
            `);

        if (userResult.recordset.length === 0) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const user = userResult.recordset[0];

        if (user.EmailVerified) {
            return res.status(400).json({
                error: 'Email already verified'
            });
        }

        await pool.request()
            .input('userId', sql.Int, user.UserID)
            .query(`
                UPDATE dbo.EmailVerifications
                SET IsActive = 0
                WHERE UserID = @userId
            `);

        const token =
            crypto.randomBytes(32).toString('hex');

        const expiresAt =
            new Date(
                Date.now() + 24 * 60 * 60 * 1000
            );

        await pool.request()
            .input('userId', sql.Int, user.UserID)
            .input('token', sql.NVarChar, token)
            .input('expiresAt', sql.DateTime, expiresAt)
            .query(`
                INSERT INTO dbo.EmailVerifications
                (
                    UserID,
                    VerificationToken,
                    ExpiresAt
                )
                VALUES
                (
                    @userId,
                    @token,
                    @expiresAt
                )
            `);

        await sendVerificationEmail(
            email,
            token
        );

        res.json({
            success: true,
            message:
                'Verification email sent successfully'
        });

    } catch (err) {

        console.error(
            'Resend verification error:',
            err.message
        );

        res.status(500).json({
            error:
                'Server error while resending email'
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

connectDB();
