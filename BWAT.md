# BWAT.md

This file provides guidance to Bwat when working with code in this repository.

## Tech Stack
- **Backend**: Node.js (CommonJS), Express 5
- **Frontend**: Vanilla HTML / CSS / JavaScript (no framework, no build tooling) — deployed on Vercel
- **Database**: PostgreSQL on Contabo VPS
- **DB Driver**: `pg` (node-postgres)
- **No CSS framework or design system**: raw CSS files per page

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
- Express 5 runs on the Contabo VPS (port 4001) behind PM2. It provides a REST API only (no static files). API routes: `/health`, `/register`, `/login`, `/members`, `/profile/:id` (GET, PUT), `/profile/:id/password` (PUT), `/tasks` (GET, POST), `/tasks/:id/done` (PUT), `/dashboard/stats`, `/dashboard/recent-tasks`, `/dashboard/upcoming-tasks`, `/events` (GET, POST), `/events/conflict`, `/notifications`, `/sync`.
- Five DB tables: `users` (auth + roles, with `fullname`, `profile_photo`), `Members`, `UpcomingEvents`, `RecentEvents`, `Tasks` (role, username, task name, description, date, time, status, AssignedBy, AssignedByName).
- **Role system**: Only one `father` and one `mother` allowed per registration (409 error). Father is the super admin — only father can create tasks and mark them done. Other roles can set schedules.
- **Schedule conflict detection**: Before creating a task, the system checks `UpcomingEvents` for the assignee on that date. If they're busy (have an event), the task creation is blocked with a message to reschedule.
- DB connection uses PostgreSQL via `pg` (Pool). Connection env vars: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`.
- Offline fallback: `offline-auth.js` stores the last successful login credentials in `localStorage` and lets the user log in when the server is unreachable. Also caches registered users in `localStorage('registeredUsers')`.
- All JS pages do client-side fetch to `http://13.140.143.58:4001` with a 5-second timeout via `AbortController`.
- `public/index.html` is the splash screen — shows logo for 3s then redirects to `/login.html`. Styled by `splashscreen.css` and uses the logo from `images/Family-tracker-logo.png`.
- Members page (members.html) has **inline CSS** in the `<style>` tag — unlike other pages which use external stylesheets.
- Dashboard loads `javascript/offline-queue.js` and `javascript/sync-service.js` for offline support.

## Commands
- `npm start` — runs `node server.js` on port 4001
- DB setup (first time): run `database/setup-postgresql.sh` on the Contabo server as root
- DB schema (re-run safe): `psql -U familytracker_user -d familytrackerdb -f database/familytrackerdb-postgresql.sql`
- Frontend deployment: push to GitHub, import repo in Vercel with root directory set to `public/`

## Gotchas
- **Plaintext passwords**: stored and compared as-is in the database. The login query does `WHERE username = $1 AND password = $2` with no hashing. Offline auth also stores passwords in localStorage. Do not change this pattern without explicit user permission.
- **`.env*` files are gitignored** — environment variables `PORT`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` can be set.
- **No input sanitization on login/register**: SQL injection is prevented by parameterized queries, but there is no server-side validation beyond checking for empty fields. XSS is possible if any user-supplied data gets rendered unsafely (currently roles/names are rendered as `textContent` in most places).
- **Dashboard's `user-badge` shows the logged-in user's info** — it reads from `localStorage.getItem('user')`. If the user data shape differs from `{ id, email, username, role }`, rendering may break.
- **Schedule page uses API-backed data** from `GET /events` and `POST /events` on `UpcomingEvents`. Tasks page fetches from `GET /tasks` (only pending), saves via `POST /tasks`, and can mark done via `PUT /tasks/:id/done` (which inserts into `RecentEvents`).
- **Profile page matches the warm palette** — CSS uses `#3d3530`/`#8b7355`/Arial. Photo upload was removed (no storage).
- **Role constraints**: Only one `father` and one `mother` can register. Father is the super admin — only he sees the "Create Task" and "Mark Done" buttons. Other roles cannot create or complete tasks.
- **Orphan files**: `public/reschedulefeat.js` (unfinished, no wire-up or backend route), `database/familytrackerdb-postgresql.sql` (PostgreSQL variant, now the active schema). The old SQL Server schema file `database/familytrackerdb.sql` is no longer used.
