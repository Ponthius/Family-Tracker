# BWAT.md

This file provides guidance to Bwat when working with code in this repository.

## Tech Stack
- **Backend**: Node.js (CommonJS), Express 5
- **Frontend**: Vanilla HTML / CSS / JavaScript (no framework, no build tooling) — deployed on Vercel
- **Database**: PostgreSQL on Contabo VPS
- **DB Driver**: `pg` (node-postgres)
- **Auth**: Plaintext password comparison (no hashing) — `WHERE username = $1 AND password = $2`
- **Email**: Nodemailer via Gmail SMTP (fire-and-forget, never blocks registration)
- **No CSS framework or design system**: raw CSS files per page with warm earthy palette

## Brand Identity
**Colors** (warm, neutral palette — use existing tokens, never invent new values):
- Page background: `#e8e2d9`
- Card / surface: `#f5f1ec`
- Sidebar / drawer: `#f5f1ec`
- Primary / dark: `#3d3530` (buttons, nav active, headings)
- Button hover: `#2c2420`
- Text primary: `#2c2420`
- Text subdued: `#5a4e46` (labels), `#7a6e66` (secondary), `#9b8a7a` (muted)
- Accent warm brown: `#8b7355` (icons, focus borders, logo icon)
- Border light: `#e0d6ce`, `#e2d8d0`, `#c8bfb5` (increasing strength)
- Table header bg: `#faf3ec` (dashboard), `#ece6dd` (tasks), `#3d3530` (members)
- Nav hover: `#e8e0d8`
- Success bg: `#e7efe2`, text `#3c5a3c`, border `#b9cdb0`
- Error text: `#a13d3d`

**Typography**:
- Display / headings: `Georgia, serif`
- Body: `Arial, sans-serif` (or `Arial, Helvetica, sans-serif`)
- Splash screen: `Georgia, serif` only

**Geometry**:
- Border radius: `6px` (inputs, buttons), `12px` (cards, panels, modals), `14px` (nav items), `24px` (KPI cards, table wrappers), `999px`/`30px`/`40px` (badges/pills)
- Card shadows: `0 2px 12px rgba(0,0,0,0.08)` (cards), `0 2px 8px rgba(0,0,0,0.03)` (KPI), `0 4px 20px rgba(0,0,0,0.18)` (modals)
- Sidebar shadow: `2px 0 12px rgba(0,0,0,0.04)`

**Visual language**: Warm, earthy minimalism — beige/cream palette, flat surfaces with gentle shadows, serif headings for warmth, sans-serif body text, generous whitespace, subtle hover transitions.

## Architecture Notes

**Backend structure** — A single `server.js` file (~1050 lines) containing all routes inline. No router separation or middleware layers. Routes are grouped by domain: Health, Register, Login, Members, Profile, Tasks, Events, Schedules, Dashboard stats, Notifications, Audit, Invitations, Families, and Account deletion. Each route is a self-contained `async (req, res) => { ... }` handler with its own try/catch. The `pg` `Pool` is initialized at module level and used directly in every route. CORS is enabled globally. A `logAudit()` helper writes to the `audit_logs` table for every significant action (register, login, task create, password change, account delete).

**Frontend** has no framework. Each HTML page has an inline `<script>` tag or references a `.js` file. Pages use `fetch()` to call the backend API through Vercel's rewrite proxy (`/api/*` → `http://13.140.143.58:4001/*`). Toast notifications via `toast.js` (floating, auto-dismiss, color-coded) replace all `alert()` calls. Pages are styled by individual CSS files in `public/` with no shared design token system — colors are hardcoded hex values.

**Auth flow** — Plaintext password comparison. On login, the server returns `{ id, email, username, role, family_id, is_super_admin }` which is stored in `localStorage.getItem('user')`. There is no session or JWT — every subsequent request includes user data from localStorage (but the server uses its own parameterized queries for auth). Offline fallback via `offline-auth.js` stores last successful credentials in localStorage.

**Multi-tenancy** is implemented through `family_id` on every user. When a father registers, a `families` row is created and the father's `family_id` is set. Invited members are linked to the same `family_id`. The `GET /members` endpoint optionally accepts `familyId` query param to filter — the members page uses this to show only the current family's members. Super admin sees all families via `GET /audit/families-overview`.

**Super admin** is seeded on first server start via `seedSuperAdmin()` with credentials `superadmin@gmail.com` / `superadmin123`. Super admin has `is_super_admin = TRUE` and is excluded from all regular queries (`GET /members`, task assignee dropdown). Super admin sees a different sidebar (Audit Logs, Cron Jobs) and has access to `/audit-super.html` (family overview, audit logs with filters).

**Account deletion** uses a 7-day grace period. When a user deletes their account (via `POST /profile/:id/delete`), their username hash is stored in `DeletedAccounts` with a 7-day expiry. Admin deletion cascades to all family members, tasks, events. Regular deletion only affects the user's data. The `DeletedAccounts` table is checked at login to block deleted users.

**i18n** — Client-side translations via i18next CDN on the profile page. Five languages: EN, SW (Kiswahili), LG (Luganda), FR (Français), ES (Español). Language preference is saved to `localStorage` and the `families.language` column. The profile page's `loadProfile()` fetches the user's family language from the API and applies it via `changeLanguage()`.

## Database Tables (PostgreSQL)

| Table | Purpose |
|---|---|
| `users` | Auth + roles (id, email, username, password, role, family_id, is_super_admin, fullname, profile_photo, emailverified) |
| `families` | Multi-tenant families (id, name, admin_id, status, language) |
| `Tasks` | Pending tasks assigned to users (TaskID, Role, Username, TaskName, Description, TaskDate, TaskTime, status, AssignedBy, AssignedByName) |
| `UpcomingEvents` | Schedule events (EventName, Description, EventDate, MemberName) |
| `RecentEvents` | Completed/done tasks (EventName, Description, EventDate, MemberName) |
| `Members` | Extended family member profiles |
| `audit_logs` | Audit trail for all actions (username, user_role, action, status) |
| `invitations` | Invitation tokens (email, role, family_id, token, expires_at) |
| `FamilyInvitations` | Alternative invitation tracking (family_id, recipient_email, token, invited_by) |
| `DeletedAccounts` | 7-day grace tracking (username_hash, expires_at) |
| `EmailVerifications` | Verification tokens (UserID, VerificationToken, ExpiresAt) |

## REST API Routes

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | Server health check |
| POST | `/register` | Public | Register user (creates family for father role) |
| POST | `/login` | Public | Login (checks DeletedAccounts, returns user + family info) |
| GET | `/members` | Public | List users (optional `?familyId=`) |
| GET/POST | `/profile/:id` | Authenticated | Get/update profile (also saves family title + language to families table) |
| PUT | `/profile/:id/password` | Authenticated | Change password |
| GET/POST | `/tasks` | Authenticated | List pending tasks / create task (checks schedule conflict) |
| PUT | `/tasks/:id/done` | Father only | Mark task done (moves to RecentEvents) |
| DELETE | `/tasks/:id` | Authenticated | Delete task (audit logged) |
| POST | `/sync` | Public | Sync pending offline actions |
| GET | `/dashboard/stats` | Authenticated | KPI counts (tasks, members, schedules, upcoming) |
| GET | `/dashboard/recent-tasks` | Authenticated | Last 5 done tasks |
| GET | `/dashboard/upcoming-tasks` | Authenticated | Next 5 pending tasks |
| GET/POST | `/events` | Authenticated | List/create schedule events |
| GET | `/events/conflict` | Authenticated | Check if user is busy at given date |
| DELETE | `/events/:id` | Authenticated | Delete event (audit logged) |
| GET | `/notifications` | Authenticated | Tasks assigned to current user |
| GET | `/audit/all` | Super Admin | Audit logs with filters (search, role, action, status) |
| GET | `/audit/families-overview` | Super Admin | Family accounts overview |
| GET/POST | `/invitations` / `/invitations/accept` | Authenticated | Invitation creation and acceptance |
| GET/POST | `/invite` / `/invites/:token` | Authenticated | Alternative invite flow |
| GET | `/families` | Authenticated | List all families (super admin sees all) |
| PUT | `/families/:id/status` | Super Admin | Suspend/activate family |
| POST | `/profile/:id/delete` | Authenticated | Soft-delete with 7-day grace period |
| DELETE | `/users/:id` | Authenticated | Hard delete user |

## Commands
- `npm start` — runs `node server.js` on port 4001
- `npm install` — installs `pg`, `express`, `cors`, `nodemailer`
- DB setup (first time): run `bash database/setup-postgresql.sh` on Contabo server as root
- DB migration: `node database/migrate-mvp.js` (adds new tables + columns safely)
- DB schema (re-run safe): `psql -U familytracker_user -d familytrackerdb -f database/familytrackerdb-postgresql.sql`
- Frontend deployment: push to GitHub → Vercel auto-deploys from `main` with `public/` as root
- Server deployment: `cd /var/www/family-tracker && git pull && npm install && pm2 restart family-tracker`

## Gotchas
- **Plaintext passwords**: stored and compared as-is. Login does `WHERE username = $1 AND password = $2` with zero hashing. Offline auth also stores plaintext in localStorage. Do NOT change this without explicit permission.
- **PostgreSQL lowercases column names**: `SELECT TaskName` returns `taskname` in the result object. All JS frontend code must check `task.taskname || task.TaskName` (lowercase first, then mixed-case fallback).
- **Vercel rewrites add `/api` prefix**: Frontend calls `/api/tasks` → Vercel rewrites to `http://13.140.143.58:4001/tasks`. Server routes MUST NOT have `/api` in their path (the rewrite strips it). The exception is audit/invite/family routes which are registered without `/api` prefix.
- **No session/auth tokens**: The server trusts any request. There's no middleware verifying `req.headers.authorization` or cookies. Authentication is done per-route by querying the database with the credentials from `req.body`. The browser stores user info in `localStorage` for display purposes only.
- **Toast system**: `toast.js` must be loaded via `<script src="toast.js">` before any page code that calls `showToast()`. The script checks `document.body` and defers to `DOMContentLoaded` if body isn't ready.
- **`.env*` files are gitignored**: Set `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `EMAIL_USER`, `EMAIL_PASS`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASS` as environment variables on the server.
- **Email is fire-and-forget**: `sendVerificationEmail()` and `sendInviteEmail()` are called with `.catch()` — they never block registration. If Gmail SMTP is misconfigured, the app works but emails silently fail.
- **Super admin is excluded from all regular queries**: `GET /members`, task assignee dropdown, and all other user-facing lists explicitly exclude `WHERE is_super_admin = FALSE`. Super admin's dedicated pages (`audit-super.html`, `cronjobs.html`) have client-side access control that redirects non-super-admins.
- **Account deletion is NOT permanent immediately**: `POST /profile/:id/delete` records the username hash in `DeletedAccounts` with a 7-day expiry. The user account and associated data are deleted, but the hash prevents re-registration with the same username for 7 days.
- **Offline fallback**: `offline-auth.js` stores last successful login in localStorage. When the server is unreachable, `login-handler.js` falls back to `offlineLogin()` which checks localStorage credentials. Registration is not available offline.
- **Orphan files**: `public/reschedulefeat.js` (unfinished reschedule feature, no backend route), `database/familytrackerdb.sql` (old SQL Server schema, no longer used). Do NOT attempt to wire these up.
