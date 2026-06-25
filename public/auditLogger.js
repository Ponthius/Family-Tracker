// ─────────────────────────────────────────────────────────────────────────────
//  Family Tracker — Audit Logger Utility
//  server/utils/auditLogger.js
//
//  Use this anywhere in your Express app to record an auditable action.
//
//  Usage:
//    const { logAudit } = require('../utils/auditLogger');
//
//    // On successful login:
//    await logAudit(db, {
//      username : req.body.username,
//      userRole : user.role,
//      familyId : user.family_id,
//      action   : 'Login',
//      status   : 'Success',
//    });
//
//    // On failed login:
//    await logAudit(db, {
//      username : req.body.username,
//      userRole : 'unknown',
//      familyId : null,
//      action   : 'Failed Login',
//      status   : 'Failed',
//    });
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

/**
 * Writes a single audit record to the audit_logs table.
 *
 * @param {object} db        - mysql2 promise pool/connection
 * @param {object} options
 * @param {string} options.username  - username of the actor
 * @param {string} options.userRole  - role of the actor (e.g. 'family_admin')
 * @param {number|null} options.familyId - family the actor belongs to (null for super_admin)
 * @param {string} options.action    - human-readable action name (e.g. 'Task Created')
 * @param {string} options.status    - 'Success' or 'Failed'
 */
async function logAudit(db, { username, userRole, familyId = null, action, status }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (username, user_role, family_id, action, status, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [username, userRole, familyId, action, status]
    );
  } catch (err) {
    // Audit failure must never crash the main request
    console.error(`[AuditLogger] Failed to write audit record — Action: "${action}", User: "${username}":`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ACTION CONSTANTS
//  Import these wherever you call logAudit to avoid typos.
// ─────────────────────────────────────────────────────────────────────────────
const AUDIT_ACTIONS = Object.freeze({
  REGISTER           : 'Register',
  LOGIN              : 'Login',
  FAILED_LOGIN       : 'Failed Login',
  LOGOUT             : 'Logout',
  ACCOUNT_DELETED    : 'Account Deleted',
  ACCOUNT_RECOVERY   : 'Account Recovery',
  PROFILE_UPDATED    : 'Profile Updated',
  PASSWORD_CHANGED   : 'Password Changed',
  LANGUAGE_CHANGED   : 'Language Changed',
  TASK_CREATED       : 'Task Created',
  TASK_ASSIGNED      : 'Task Assigned',
  TASK_DELETED       : 'Task Deleted',
  EVENT_CREATED      : 'Event Created',
  EVENT_RESCHEDULED  : 'Event Rescheduled',
  MEMBER_INVITED     : 'Member Invited',
});

module.exports = { logAudit, AUDIT_ACTIONS };
