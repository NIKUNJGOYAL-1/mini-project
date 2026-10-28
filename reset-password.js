// Run:  node reset-password.js your@email.com NewPassword123
const crypto = require('crypto');
const db = require('./db');
const [email, newPassword] = [(process.argv[2] || '').toLowerCase(), process.argv[3] || ''];
if (!email || newPassword.length < 8) {
  console.log('Usage: node reset-password.js your@email.com NewPassword (min 8 characters)');
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const hash = salt.toString('hex') + ':' + crypto.scryptSync(newPassword, salt, 64).toString('hex');
const r = db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, email);
console.log(r.changes ? 'Password updated. You can log in now.' : 'No account found with that email. Run: node check-users.js');
