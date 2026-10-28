# MediScore – with SQL login & register

## Run it
1. Install Node.js 22.13 or newer from https://nodejs.org
2. Open a terminal in this folder and run:  node server.js
3. Open http://localhost:3000 in your browser

(No `npm install` needed. If you have an older Node, run `npm install better-sqlite3` once and it works the same.)

## Folder layout
- server.js   – web server + API (/api/register, /api/login, /api/logout, /api/me)
- db.js       – creates the SQLite database file `mediscore.db` and the SQL tables
- public/     – your website (trial.html, trial.css, trial.js)

## View the data
Install "DB Browser for SQLite" (free) and open `mediscore.db`.
