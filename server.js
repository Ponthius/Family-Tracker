const express = require('express');
const sql = require('mssql/msnodesqlv8');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const dbServer = process.env.DB_SERVER || `${process.env.COMPUTERNAME || 'localhost'}\\SQLEXPRESS`;
const dbName = process.env.DB_NAME || 'familytrackerdb';
const dbDriver = process.env.DB_DRIVER || 'ODBC Driver 17 for SQL Server';

const dbConfig = {
    connectionString: `Driver={${dbDriver}};Server=${dbServer};Database=${dbName};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`
};

let poolPromise;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

        await pool.request()
            .input('email', sql.NVarChar, email)
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, password)
            .input('role', sql.NVarChar, role)
            .query(`
                INSERT INTO dbo.users (email, username, password, role)
                VALUES (@email, @username, @password, @role)
            `);

        res.json({ success: true, message: 'User registered successfully' });
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
                SELECT id, email, username, role
                FROM dbo.users
                WHERE username = @username AND password = @password
            `);

        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
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

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

connectDB();
