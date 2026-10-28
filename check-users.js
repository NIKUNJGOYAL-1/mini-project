// Run:  node check-users.js
// Shows every registered account (never shows passwords).
const db = require('./db');
const users = db.prepare('SELECT id, full_name, email, created_at FROM users').all();
if (users.length === 0) console.log('No users registered yet.');
for (const u of users) console.log(`${u.id}. ${u.full_name} <${u.email}>  (created ${u.created_at})`);
