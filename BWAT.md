# BWAT.md

This file provides guidance to Bwat when working with code in this repository.

## Tech Stack
- **Backend**: Node.js (CommonJS), Express 5
- **Frontend**: Vanilla HTML / CSS / JavaScript (no framework, no build tooling)
- **Database**: SQL Server Express (local instance, Windows Integrated Authentication via ODBC)
- **DB Driver**: `mssql` + `msnodesqlv8` (Windows-only)
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
- Express 5 serves static files from `public/` and provides a REST API on the same port (default 4001).
- Five DB tables: `dbo.users` (auth + roles), `dbo.Members` (family members), `dbo.UpcomingEvents`, `dbo.RecentEvents`, `dbo.Tasks` (role, username, task name, description, date, time).
- DB connection uses Windows Integrated Auth (`Trusted_Connection=Yes`) via `msnodesqlv8` — this is Windows-only. Connection pool is created lazily on first request and stored in a module-level variable; reset to `null` on failure so it retries.
- Offline fallback: `offline-auth.js` stores the last successful login credentials in `localStorage` and lets the user log in when the server is unreachable. Also caches registered users in `localStorage('registeredUsers')`.
- All JS pages do client-side fetch to `http://localhost:4001` with a 5-second timeout via `AbortController`.
- Members page (members.html) has **inline CSS** in the `<style>` tag — unlike other pages which use external stylesheets. Keep styling consistent with the external CSS pattern.

## Commands
- `npm start` — runs `node server.js` on port 4001
- DB setup: run `database/familytrackerdb.sql` in SQL Server Management Studio (or `sqlcmd`) to create the database and tables

## Gotchas
- **Typo in codebase**: the dashboard HTML file is named `dashbaord.html` (missing 'h' after 'a') — all references in code and links use this misspelling. Do NOT "fix" it to `dashboard.html` unless the user explicitly requests a rename across all files.
- **Plaintext passwords**: stored and compared as-is in the database. The login query does `WHERE username = @username AND password = @password` with no hashing. Offline auth also stores passwords in localStorage. Do not change this pattern without explicit user permission.
- **`msnodesqlv8` is Windows-only**: the DB driver uses `mssql/msnodesqlv8` which only works on Windows with SQL Server Express and ODBC Driver 17 installed. DB connection string defaults to `localhost\SQLEXPRESS` with Windows Auth.
- **`.env*` files are gitignored** — environment variables `PORT`, `DB_SERVER`, `DB_NAME`, `DB_DRIVER` can be set. Server defaults: port 4001, server `COMPUTERNAME\SQLEXPRESS`, database `familytrackerdb`, driver `ODBC Driver 17 for SQL Server`.
- **No input sanitization on login/register**: SQL injection is prevented by parameterized queries, but there is no server-side validation beyond checking for empty fields. XSS is possible if any user-supplied data gets rendered unsafely (currently roles/names are rendered as `textContent` in most places).
- **Dashboard's `user-badge` shows the logged-in user's info** — it reads from `localStorage.getItem('user')`. If the user data shape differs from `{ id, email, username, role }`, rendering may break.
- **Schedule page uses hardcoded in-memory data** (not backed by DB yet). The schedule data lives in `script.js` with `window.onload` render. Tasks page (`tasks.js`) fetches from the DB via `GET /tasks` and saves via `POST /tasks`.
