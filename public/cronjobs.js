// ─────────────────────────────────────────────────────────────────────────────
//  Family Tracker — Scheduled Cron Jobs (Node.js / Express)
//  server/cronjobs.js
//
//  Dependencies:
//    npm install node-cron nodemailer
//
//  Usage:
//    Import and call initCronJobs(db) from your main server.js:
//
//    const { initCronJobs } = require('./cronjobs');
//    initCronJobs(db);
//
//  db: your MySQL2 / pg pool or connection instance.
//  Adjust the SQL queries to match your actual schema.
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const cron = require('node-cron');
const nodemailer = require('nodemailer');

// ── Email Transporter (configure for your mail server) ────────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.mailtrap.io',
    port: process.env.MAIL_PORT || 587,
    auth: {
        user: process.env.MAIL_USER || '',
        pass: process.env.MAIL_PASS || '',
    },
});

// ─────────────────────────────────────────────────────────────────────────────
//  AUDIT LOGGER
//  Writes a record to the cron_audit_log table.
// ─────────────────────────────────────────────────────────────────────────────
async function writeAuditLog(db, jobName, status, recordsProcessed, notes) {
    const now = new Date();
    const executionDate = now.toISOString().split('T')[0];
    const executionTime = now.toTimeString().split(' ')[0];

    try {
        await db.query(
            `INSERT INTO cron_audit_log
        (job_name, execution_date, execution_time, status, records_processed, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [jobName, executionDate, executionTime, status, recordsProcessed, notes]
        );
    } catch (err) {
        console.error(`[AuditLog] Failed to write audit record for "${jobName}":`, err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  JOB RUNNER WRAPPER
//  Catches errors so one failing job does not prevent others from running.
// ─────────────────────────────────────────────────────────────────────────────
async function runJob(db, jobName, jobFn) {
    console.log(`[${new Date().toISOString()}] Starting: ${jobName}`);
    try {
        const recordsProcessed = await jobFn(db);
        await writeAuditLog(db, jobName, 'success', recordsProcessed, '');
        console.log(`[${new Date().toISOString()}] Completed: ${jobName} — ${recordsProcessed} record(s) processed.`);
    } catch (err) {
        await writeAuditLog(db, jobName, 'failed', 0, err.message);
        console.error(`[${new Date().toISOString()}] FAILED: ${jobName} — ${err.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  JOB 1: Account Recovery Reminder
//  Runs daily at 08:00.
//  Finds suspended accounts with exactly 3 days left and sends a reminder email.
// ─────────────────────────────────────────────────────────────────────────────
async function job_recoveryReminder(db) {
    const [accounts] = await db.query(
        `SELECT id, username, email, deletion_date
     FROM   accounts
     WHERE  status        = 'suspended'
       AND  reminder_sent = 0
       AND  DATE(deletion_date) = DATE_ADD(CURDATE(), INTERVAL 3 DAY)`
    );

    let count = 0;
    for (const account of accounts) {
        await sendRecoveryReminderEmail(account);
        await db.query(`UPDATE accounts SET reminder_sent = 1 WHERE id = ?`, [account.id]);
        count++;
    }

    return count;
}

// ─────────────────────────────────────────────────────────────────────────────
//  JOB 2: Permanent Account Deletion
//  Runs daily at 00:00.
//  Routes expired suspended accounts to the correct deletion handler by role.
// ─────────────────────────────────────────────────────────────────────────────
async function job_permanentDeletion(db) {
    const [expired] = await db.query(
        `SELECT id, username, role, family_id
     FROM   accounts
     WHERE  status       = 'suspended'
       AND  deletion_date <= NOW()`
    );

    let count = 0;
    for (const account of expired) {
        if (account.role === 'family_admin') {
            await deleteFamilyAdminAccount(db, account);
        } else {
            await deleteInvitedUserAccount(db, account);
        }
        count++;
    }

    return count;
}

// ─────────────────────────────────────────────────────────────────────────────
//  JOB 3: Family Admin Cleanup
//  Runs daily at 00:05.
//  Explicitly targets expired family admin accounts for clarity and audit trail.
// ─────────────────────────────────────────────────────────────────────────────
async function job_familyAdminCleanup(db) {
    const [admins] = await db.query(
        `SELECT id, username, family_id
     FROM   accounts
     WHERE  status       = 'suspended'
       AND  role         = 'family_admin'
       AND  deletion_date <= NOW()`
    );

    let count = 0;
    for (const account of admins) {
        await deleteFamilyAdminAccount(db, account);
        count++;
    }

    return count;
}

// ─────────────────────────────────────────────────────────────────────────────
//  JOB 4: Invited User Cleanup
//  Runs daily at 00:10.
//  Deletes only the expired invited user — family data remains untouched.
// ─────────────────────────────────────────────────────────────────────────────
async function job_invitedUserCleanup(db) {
    const [users] = await db.query(
        `SELECT id, username, family_id
     FROM   accounts
     WHERE  status       = 'suspended'
       AND  role         = 'invited_user'
       AND  deletion_date <= NOW()`
    );

    let count = 0;
    for (const account of users) {
        await deleteInvitedUserAccount(db, account);
        count++;
    }

    return count;
}

// ─────────────────────────────────────────────────────────────────────────────
//  DELETION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Permanently deletes a Family Admin and ALL associated family data:
 * tasks, schedules, events, all member accounts, and the family record.
 */
async function deleteFamilyAdminAccount(db, account) {
    const { family_id } = account;

    await db.query(`DELETE FROM tasks     WHERE family_id = ?`, [family_id]);
    await db.query(`DELETE FROM schedules WHERE family_id = ?`, [family_id]);
    await db.query(`DELETE FROM events    WHERE family_id = ?`, [family_id]);
    await db.query(`DELETE FROM accounts  WHERE family_id = ?`, [family_id]);
    await db.query(`DELETE FROM families  WHERE id        = ?`, [family_id]);

    console.log(`[FamilyAdminCleanup] Deleted admin "${account.username}" and all family data (family_id: ${family_id}).`);
}

/**
 * Permanently deletes a single invited user and their personal data only.
 * Does NOT affect other family members or shared family records.
 */
async function deleteInvitedUserAccount(db, account) {
    const { id, username } = account;

    await db.query(`DELETE FROM tasks     WHERE assigned_to = ?`, [id]);
    await db.query(`DELETE FROM schedules WHERE user_id     = ?`, [id]);
    await db.query(`DELETE FROM accounts  WHERE id          = ?`, [id]);

    console.log(`[InvitedUserCleanup] Deleted invited user "${username}" (id: ${id}). Family data unaffected.`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  EMAIL SENDER
// ─────────────────────────────────────────────────────────────────────────────
async function sendRecoveryReminderEmail(account) {
    const deletionDate = new Date(account.deletion_date).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
    });

    const mailOptions = {
        from: process.env.MAIL_FROM || '"Family Tracker" <no-reply@familytracker.local>',
        to: account.email,
        subject: 'Family Tracker — Account Recovery Reminder',
        text:
            `Hello ${account.username},\n\n` +
            `Your Family Tracker account has been suspended and is scheduled for\n` +
            `permanent deletion on ${deletionDate}.\n\n` +
            `To recover your account, please log in and follow the on-screen\n` +
            `recovery steps before the deletion date.\n\n` +
            `If you do not act, your account and all associated data will be\n` +
            `permanently deleted and cannot be restored.\n\n` +
            `— The Family Tracker Team`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[RecoveryReminder] Email sent to ${account.email} (${account.username}), deletion: ${deletionDate}.`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  INIT — Register all cron schedules
//  Call this once from your server.js after your DB connection is ready.
//
//  Cron syntax: 'minute hour day month weekday'
//  Examples:
//    '0 8 * * *'  → every day at 08:00
//    '0 0 * * *'  → every day at midnight
// ─────────────────────────────────────────────────────────────────────────────
function initCronJobs(db) {
    // Daily at 08:00 — Recovery Reminder
    cron.schedule('0 8 * * *', () => {
        runJob(db, 'Account Recovery Reminder', job_recoveryReminder);
    });

    // Daily at 00:00 — Permanent Deletion (all roles)
    cron.schedule('0 0 * * *', () => {
        runJob(db, 'Permanent Account Deletion', job_permanentDeletion);
    });

    // Daily at 00:05 — Family Admin Cleanup
    cron.schedule('5 0 * * *', () => {
        runJob(db, 'Family Admin Cleanup', job_familyAdminCleanup);
    });

    // Daily at 00:10 — Invited User Cleanup
    cron.schedule('10 0 * * *', () => {
        runJob(db, 'Invited User Cleanup', job_invitedUserCleanup);
    });

    console.log('[CronJobs] All scheduled jobs registered and running.');
}

module.exports = { initCronJobs };
