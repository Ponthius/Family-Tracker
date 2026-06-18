// Run once: node database/migrate-tasks.js
const sql = require('mssql/msnodesqlv8');

const dbServer = process.env.DB_SERVER || `${process.env.COMPUTERNAME || 'localhost'}\\SQLEXPRESS`;
const dbName = process.env.DB_NAME || 'familytrackerdb';
const dbDriver = process.env.DB_DRIVER || 'ODBC Driver 17 for SQL Server';

const dbConfig = {
    connectionString: `Driver={${dbDriver}};Server=${dbServer};Database=${dbName};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`
};

async function migrate() {
    try {
        const pool = await sql.connect(dbConfig);
        console.log(`Connected to ${dbServer}/${dbName}`);

        const checks = [
            { col: 'status', sql: "SELECT COL_LENGTH('dbo.Tasks', 'status') AS e", name: 'status' },
            { col: 'AssignedBy', sql: "SELECT COL_LENGTH('dbo.Tasks', 'AssignedBy') AS e", name: 'AssignedBy' },
            { col: 'AssignedByName', sql: "SELECT COL_LENGTH('dbo.Tasks', 'AssignedByName') AS e", name: 'AssignedByName' },
        ];

        for (const c of checks) {
            const r = await pool.request().query(c.sql);
            if (r.recordset[0].e === null) {
                if (c.col === 'status') {
                    await pool.request().query("ALTER TABLE dbo.Tasks ADD status NVARCHAR(20) NOT NULL DEFAULT 'pending'");
                } else if (c.col === 'AssignedBy') {
                    await pool.request().query("ALTER TABLE dbo.Tasks ADD AssignedBy INT");
                } else if (c.col === 'AssignedByName') {
                    await pool.request().query("ALTER TABLE dbo.Tasks ADD AssignedByName NVARCHAR(50)");
                }
                console.log('Added column:', c.col);
            } else {
                console.log('Column exists:', c.col);
            }
        }

        // Update existing rows where status is NULL
        await pool.request().query("UPDATE dbo.Tasks SET status = 'pending' WHERE status IS NULL");

        console.log('Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
