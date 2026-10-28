// server.js - serves the website and provides the register / login / logout API.
// Run with:  node server.js   then open http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_DAYS = 7;

// ---------- SQL statements ----------
const sql = {
  insertUser:    db.prepare('INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)'),
  userByEmail:   db.prepare('SELECT id, full_name, email, password_hash FROM users WHERE email = ?'),
  insertSession: db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'),
  userBySession: db.prepare(`SELECT u.id, u.full_name, u.email FROM sessions s
                             JOIN users u ON u.id = s.user_id
                             WHERE s.token = ? AND s.expires_at > ?`),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  purgeExpired:  db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
  insertHistory: db.prepare(`INSERT INTO medical_history
                   (user_id, patient_name, condition, diagnosed_on, medications, allergies, notes)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`),
  listHistory:   db.prepare(`SELECT id, patient_name, condition, diagnosed_on, medications, allergies, notes, created_at
                   FROM medical_history WHERE user_id = ? ORDER BY id DESC`),
  deleteHistory: db.prepare('DELETE FROM medical_history WHERE id = ? AND user_id = ?'),
};

// ---------- Password hashing (scrypt, built into Node) ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}
function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(expected, actual);
}
const DUMMY_HASH = hashPassword('dummy-password'); // keeps timing equal when email doesn't exist

// ---------- Sessions (token stored in an HttpOnly cookie) ----------
function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  sql.purgeExpired.run(Date.now());
  sql.insertSession.run(token, userId, Date.now() + maxAge * 1000);
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
}
function getToken(req) {
  const m = /(?:^|;\s*)session=([a-f0-9]+)/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
}
function currentUser(req) {
  const token = getToken(req);
  return token ? sql.userBySession.get(token, Date.now()) || null : null;
}

// ---------- Small helpers ----------
function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
function readJSON(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10000) { reject(new Error('Too large')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(e); } });
  });
}
// Very simple brute-force protection: 10 login attempts per 15 min per IP
const attempts = new Map();
function tooManyAttempts(ip) {
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > 10;
}

// ---------- API routes ----------
async function handleApi(req, res) {
  const route = req.method + ' ' + req.url.split('?')[0];

  if (route === 'GET /api/me') {
    const user = currentUser(req);
    return sendJSON(res, 200, { user: user ? { name: user.full_name, email: user.email } : null });
  }

  if (route === 'POST /api/register') {
    const { name, email, password } = await readJSON(req);
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const pw = String(password || '');

    if (!cleanName || cleanName.length > 100) return sendJSON(res, 400, { error: 'Please enter your name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return sendJSON(res, 400, { error: 'Please enter a valid email.' });
    if (pw.length < 8 || pw.length > 200) return sendJSON(res, 400, { error: 'Password must be at least 8 characters.' });
    if (sql.userByEmail.get(cleanEmail)) return sendJSON(res, 409, { error: 'That email is already registered. Try logging in.' });

    const result = sql.insertUser.run(cleanName, cleanEmail, hashPassword(pw));
    createSession(res, Number(result.lastInsertRowid));
    return sendJSON(res, 201, { user: { name: cleanName, email: cleanEmail } });
  }

  if (route === 'POST /api/login') {
    if (tooManyAttempts(req.socket.remoteAddress)) {
      return sendJSON(res, 429, { error: 'Too many attempts. Please try again in a few minutes.' });
    }
    const { email, password } = await readJSON(req);
    const user = sql.userByEmail.get(String(email || '').trim().toLowerCase());
    const ok = verifyPassword(String(password || ''), user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) return sendJSON(res, 401, { error: 'Invalid email or password.' });

    createSession(res, user.id);
    return sendJSON(res, 200, { user: { name: user.full_name, email: user.email } });
  }

  if (route === 'POST /api/logout') {
    const token = getToken(req);
    if (token) sql.deleteSession.run(token);
    res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return sendJSON(res, 200, { ok: true });
  }

  // ----- Patient medical history (login required) -----
  if (route === 'GET /api/history') {
    const user = currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Please log in.' });
    return sendJSON(res, 200, { items: sql.listHistory.all(user.id) });
  }

  if (route === 'POST /api/history') {
    const user = currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Please log in.' });
    const b = await readJSON(req);
    const clean = (v, max) => String(v || '').trim().slice(0, max);
    const patient = clean(b.patient_name, 100);
    const condition = clean(b.condition, 200);
    if (!patient) return sendJSON(res, 400, { error: 'Please enter the patient name.' });
    if (!condition) return sendJSON(res, 400, { error: 'Please enter the condition or diagnosis.' });
    sql.insertHistory.run(user.id, patient, condition, clean(b.diagnosed_on, 10),
      clean(b.medications, 500), clean(b.allergies, 500), clean(b.notes, 2000));
    return sendJSON(res, 201, { items: sql.listHistory.all(user.id) });
  }

  if (route === 'DELETE /api/history') {
    const user = currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Please log in.' });
    const id = Number(new URL(req.url, 'http://x').searchParams.get('id'));
    sql.deleteHistory.run(id, user.id);
    return sendJSON(res, 200, { items: sql.listHistory.all(user.id) });
  }

  sendJSON(res, 404, { error: 'Not found' });
}

// ---------- Static files (your website) ----------
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
                '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/trial.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': (TYPES[path.extname(filePath)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(data);
  });
}

http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) await handleApi(req, res);
    else serveStatic(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJSON(res, 400, { error: 'Bad request.' });
  }
}).listen(PORT, () => console.log(`MediScore running at http://localhost:${PORT}`));
