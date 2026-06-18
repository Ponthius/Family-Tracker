// Run this once to add the missing profile columns
// Usage: node database/add-profile-columns.js

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

        // Check if fullname column exists
        const checkFullname = await pool.request().query(`
            SELECT COL_LENGTH('dbo.users', 'fullname') AS col_exists
        `);
        const hasFullname = checkFullname.recordset[0].col_exists !== null;

        // Check if profile_photo column exists
        const checkPhoto = await pool.request().query(`
            SELECT COL_LENGTH('dbo.users', 'profile_photo') AS col_exists
        `);
        const hasPhoto = checkPhoto.recordset[0].col_exists !== null;

        if (!hasFullname) {
            await pool.request().query(`ALTER TABLE dbo.users ADD fullname NVARCHAR(100)`);
            console.log('Added column: fullname');
        } else {
            console.log('Column already exists: fullname');
        }

        if (!hasPhoto) {
            await pool.request().query(`ALTER TABLE dbo.users ADD profile_photo NVARCHAR(MAX)`);
            console.log('Added column: profile_photo');
        } else {
            console.log('Column already exists: profile_photo');
        }

        console.log('Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
