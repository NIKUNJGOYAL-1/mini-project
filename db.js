// db.js - opens the SQLite database and creates the tables (SQL) if they don't exist.
// Uses Node's built-in SQLite (Node 22.13+). On older Node, run `npm install better-sqlite3`
// and it will be used automatically instead.
let Database;
try {
  Database = require('node:sqlite').DatabaseSync;
} catch (e) {
  Database = require('better-sqlite3');
}

const db = new Database(__dirname + '/mediscore.db');

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name     TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS medical_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_name TEXT    NOT NULL,
    condition    TEXT    NOT NULL,
    diagnosed_on TEXT,
    medications  TEXT,
    allergies    TEXT,
    notes        TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
