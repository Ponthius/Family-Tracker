// ─────────────────────────────────────────────────────────────────────────────
//  Family Tracker — Audit Log Routes
//  server/routes/audit.routes.js
//
//  Mount in server.js:
//    const auditRoutes = require('./routes/audit.routes');
//    app.use('/api/audit', auditRoutes);
//
//  Assumes:
//    - req.user is set by your auth middleware (contains id, role, family_id)
//    - db is a mysql2 promise pool passed via app.locals or required directly
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const express = require('express');
const router  = express.Router();

// ── Auth Middleware Helpers ────────────────────────────────────────────────
// Replace these with your actual auth/session middleware.

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorised.' });
  next();
}

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied. Super Admin only.' });
  }
  next();
}

function requireFamilyAdmin(req, res, next) {
  if (!['super_admin', 'family_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Family Admin only.' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/audit/all
//  Super Admin — fetch audit logs across all families with optional filters.
//
//  Query params (all optional):
//    search, family, role, action, status, dateFrom, dateTo, page, limit
// ─────────────────────────────────────────────────────────────────────────────
router.get('/all', requireAuth, requireSuperAdmin, async (req, res) => {
  const db = req.app.locals.db;

  const {
    search   = '',
    family   = '',
    role     = '',
    action   = '',
    status   = '',
    dateFrom = '',
    dateTo   = '',
    page     = 1,
    limit    = 20,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const conditions = ['1=1'];

  if (search) {
    conditions.push('(a.username LIKE ? OR a.action LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (family) {
    conditions.push('f.name = ?');
    params.push(family);
  }
  if (role) {
    conditions.push('a.user_role = ?');
    params.push(role);
  }
  if (action) {
    conditions.push('a.action = ?');
    params.push(action);
  }
  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }
  if (dateFrom) {
    conditions.push('DATE(a.created_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(a.created_at) <= ?');
    params.push(dateTo);
  }

  const where = conditions.join(' AND ');

  try {
    // Total count for pagination
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM   audit_logs a
       LEFT   JOIN families f ON f.id = a.family_id
       WHERE  ${where}`,
      params
    );

    // Paginated results
    const [rows] = await db.query(
      `SELECT
         a.id,
         a.username,
         a.user_role   AS role,
         f.name        AS family,
         a.action,
         DATE(a.created_at)          AS date,
         TIME_FORMAT(a.created_at, '%H:%i:%s') AS time,
         a.status
       FROM   audit_logs a
       LEFT   JOIN families f ON f.id = a.family_id
       WHERE  ${where}
       ORDER  BY a.created_at DESC
       LIMIT  ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ total, page: parseInt(page), limit: parseInt(limit), data: rows });
  } catch (err) {
    console.error('[GET /api/audit/all]', err.message);
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/audit/family
//  Family Admin — fetch audit logs for their own family only.
//
//  Query params (all optional):
//    search, role, action, status, dateFrom, dateTo, page, limit
// ─────────────────────────────────────────────────────────────────────────────
router.get('/family', requireAuth, requireFamilyAdmin, async (req, res) => {
  const db = req.app.locals.db;
  const familyId = req.user.family_id;

  const {
    search   = '',
    role     = '',
    action   = '',
    status   = '',
    dateFrom = '',
    dateTo   = '',
    page     = 1,
    limit    = 20,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [familyId];
  const conditions = ['a.family_id = ?'];

  if (search) {
    conditions.push('(a.username LIKE ? OR a.action LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (role) {
    conditions.push('a.user_role = ?');
    params.push(role);
  }
  if (action) {
    conditions.push('a.action = ?');
    params.push(action);
  }
  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }
  if (dateFrom) {
    conditions.push('DATE(a.created_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(a.created_at) <= ?');
    params.push(dateTo);
  }

  const where = conditions.join(' AND ');

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM audit_logs a WHERE ${where}`,
      params
    );

    const [rows] = await db.query(
      `SELECT
         a.id,
         a.username,
         a.user_role   AS role,
         a.action,
         DATE(a.created_at)                   AS date,
         TIME_FORMAT(a.created_at, '%H:%i:%s') AS time,
         a.status
       FROM   audit_logs a
       WHERE  ${where}
       ORDER  BY a.created_at DESC
       LIMIT  ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ total, page: parseInt(page), limit: parseInt(limit), data: rows });
  } catch (err) {
    console.error('[GET /api/audit/family]', err.message);
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/audit/families-overview
//  Super Admin — summary of all family accounts for the overview table.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/families-overview', requireAuth, requireSuperAdmin, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const [rows] = await db.query(
      `SELECT
         f.id,
         f.name                                          AS family_name,
         a.username                                      AS admin_username,
         COUNT(DISTINCT m.id)                            AS member_count,
         f.status,
         DATE(f.created_at)                              AS date_created,
         DATE(MAX(al.created_at))                        AS last_activity
       FROM   families f
       JOIN   accounts a  ON a.id = f.admin_id
       LEFT   JOIN accounts m  ON m.family_id = f.id
       LEFT   JOIN audit_logs al ON al.family_id = f.id
       GROUP  BY f.id, f.name, a.username, f.status, f.created_at
       ORDER  BY f.created_at DESC`
    );

    res.json({ data: rows });
  } catch (err) {
    console.error('[GET /api/audit/families-overview]', err.message);
    res.status(500).json({ error: 'Failed to fetch family overview.' });
  }
});

module.exports = router;
