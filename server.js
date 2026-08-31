// Dotmanifest backend — plain Node.js, no external packages.
// Handles: carrier search/export (free vs paid tiers), and email+password
// accounts. User accounts are stored in JSONBin.io (free cloud storage) so
// they survive Render restarts, instead of a local file.

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const https = require('https');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'carriers.json');
const FREE_LIMIT = 5;

const JSONBIN_ID = process.env.JSONBIN_ID;
const JSONBIN_KEY = process.env.JSONBIN_KEY;

function loadCarriers() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function jsonbinRequest(method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.jsonbin.io',
      path: `/v3/b/${JSONBIN_ID}${method === 'GET' ? '/latest' : ''}`,
      method,
      headers: {
        'X-Master-Key': JSONBIN_KEY,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(options, res => {
      let resData = '';
      res.on('data', chunk => (resData += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(resData));
        } catch (e) {
          reject(new Error('JSONBin response parse failed: ' + resData.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function loadUsers() {
  if (!JSONBIN_ID || !JSONBIN_KEY) return {};
  try {
    const result = await jsonbinRequest('GET');
    return result.record || {};
  } catch (e) {
    console.error('loadUsers failed:', e.message);
    return {};
  }
}

async function saveUsers(users) {
  if (!JSONBIN_ID || !JSONBIN_KEY) return;
  try {
    await jsonbinRequest('PUT', users);
  } catch (e) {
    console.error('saveUsers failed:', e.message);
  }
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function filterCarriers({ date, start, end }) {
  const all = loadCarriers();
  let rows = all;
  if (date) {
    rows = rows.filter(c => c.registration_date === date);
  } else if (start && end) {
    rows = rows.filter(c => c.registration_date >= start && c.registration_date <= end);
  }
  return rows.sort((a, b) => (a.registration_date < b.registration_date ? 1 : -1));
}

function applyTier(rows, tier) {
  if (tier === 'paid') return rows.map(r => ({ ...r, locked: false }));
  return rows.map((r, i) => {
    if (i < FREE_LIMIT) return { ...r, locked: false };
    return {
      company_name: '••••••••••••••',
      phone: '•••-•••-••••',
      dot_number: '•••••••',
      mc_number: '•••••••',
      city: '••••••',
      state: '••',
      status: r.status,
      equipment_count: '••',
      registration_date: r.registration_date,
      locked: true
    };
  });
}

function toCSV(rows) {
  const headers = ['company_name','phone','dot_number','mc_number','city','state','status','equipment_count','registration_date'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
  }
  return lines.join('\n');
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function tierForToken(token) {
  if (!token) return 'free';
  const users = await loadUsers();
  const entry = Object.values(users).find(u => u.token === token);
  if (!entry) return 'free';
  return entry.paid ? 'paid' : 'free';
}

function serveStatic(req, res, pathname) {
  const filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(path.join(__dirname, 'public'))) return send(res, 403, { error: 'forbidden' });
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, { error: 'not found' });
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const { pathname, query } = parsed;

  if (pathname === '/api/signup' && req.method === 'POST') {
    try {
      const { email, password } = await readBody(req);
      if (!email || !password || password.length < 6) {
        return send(res, 400, { error: 'Email aur kam se kam 6 character ka password chahiye.' });
      }
      const users = await loadUsers();
      const key = email.trim().toLowerCase();
      if (users[key]) return send(res, 400, { error: 'Ye email pehle se registered hai.' });
      const salt = crypto.randomBytes(16).toString('hex');
      const token = crypto.randomBytes(24).toString('hex');
      users[key] = { salt, passwordHash: hashPassword(password, salt), paid: false, token };
      await saveUsers(users);
      return send(res, 200, { token, paid: false });
    } catch (e) {
      return send(res, 400, { error: 'Invalid request.' });
    }
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    try {
      const { email, password } = await readBody(req);
      const users = await loadUsers();
      const key = (email || '').trim().toLowerCase();
      const entry = users[key];
      if (!entry) return send(res, 400, { error: 'Account nahi mila.' });
      const hash = hashPassword(password || '', entry.salt);
      if (hash !== entry.passwordHash) return send(res, 400, { error: 'Password ghalat hai.' });
      return send(res, 200, { token: entry.token, paid: entry.paid });
    } catch (e) {
      return send(res, 400, { error: 'Invalid request.' });
    }
  }

  if (pathname === '/api/me') {
    const tier = await tierForToken(query.token);
    return send(res, 200, { tier });
  }

  if (pathname === '/api/carriers') {
    const tier = await tierForToken(query.token);
    const rows = filterCarriers(query);
    const tiered = applyTier(rows, tier);
    return send(res, 200, { count: rows.length, results: tiered, tier });
  }

  if (pathname === '/api/export') {
    const tier = await tierForToken(query.token);
    if (tier !== 'paid') {
      return send(res, 403, { error: 'Export sirf paid users ke liye hai.' });
    }
    const rows = filterCarriers(query);
    const csv = toCSV(rows);
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="carriers_${query.date || (query.start + '_to_' + query.end)}.csv"`
    });
    return res.end(csv);
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
