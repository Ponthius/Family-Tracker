// Run: node database/migrate-mvp.js
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'familytrackerdb',
    user: process.env.PGUSER || 'familytracker_user',
    password: process.env.PGPASSWORD || 'familytracker_pass'
});

async function migrate() {
    try {
        console.log('Running MVP migration...');

        // Add columns to users table
        for (const col of ['is_super_admin', 'family_id']) {
            const r = await pool.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name='users' AND column_name=$1
            `, [col]);
            if (r.rows.length === 0) {
                if (col === 'is_super_admin') {
                    await pool.query(`ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE`);
                } else {
                    await pool.query(`ALTER TABLE users ADD COLUMN family_id INT`);
                }
                console.log('Added column:', col);
            } else {
                console.log('Column exists:', col);
            }
        }

        // Create families table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS families (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                admin_id INT REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Table: families');

        // Create audit_logs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50),
                user_role VARCHAR(20),
                action VARCHAR(100) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'Success',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Table: audit_logs');

        // Create invitations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS invitations (
                id SERIAL PRIMARY KEY,
                email VARCHAR(100) NOT NULL,
                role VARCHAR(20) NOT NULL,
                family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
                token VARCHAR(255) NOT NULL UNIQUE,
                expires_at TIMESTAMP NOT NULL,
                accepted BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Table: invitations');

        // Create DeletedAccounts table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS DeletedAccounts (
                id SERIAL PRIMARY KEY,
                username_hash VARCHAR(64) NOT NULL UNIQUE,
                deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
            )
        `);
        console.log('Table: DeletedAccounts');

        // Create FamilyInvitations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS FamilyInvitations (
                id SERIAL PRIMARY KEY,
                family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
                recipient_email VARCHAR(100) NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                invited_by INT REFERENCES users(id),
                is_active BOOLEAN DEFAULT TRUE,
                expires_at TIMESTAMP NOT NULL,
                accepted_at TIMESTAMP,
                accepted_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Table: FamilyInvitations');

        // Create super admin if not exists
        const sa = await pool.query(`SELECT id FROM users WHERE is_super_admin = TRUE`);
        if (sa.rows.length === 0) {
            await pool.query(`
                INSERT INTO users (email, username, password, role, is_super_admin, emailverified)
                VALUES ($1, $2, $3, $4, TRUE, TRUE)
            `, [process.env.SUPERADMIN_EMAIL || 'superadmin@gmail.com', 'superadmin', process.env.SUPERADMIN_PASS || 'superadmin123', 'super_admin']);
            console.log('Super admin user created');
        } else {
            console.log('Super admin already exists');
        }

        console.log('Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
