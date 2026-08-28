// CarrierPulse — demo backend
// Runs on plain Node.js (no npm install needed) so you can test it immediately.
// In production you would swap the JSON file for a real database (see README.md).

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'carriers.json');
const FREE_LIMIT = 5; // how many rows a free user can see in full

function loadCarriers() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
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
function loadCodes() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'codes.json'), 'utf-8'));
  } catch {
    return [];
  }
} 
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const { pathname, query } = parsed;
if (pathname === '/api/redeem') {
    const codes = loadCodes();
    const entered = (query.code || '').trim().toUpperCase();
    const valid = codes.map(c => c.toUpperCase()).includes(entered);
    return send(res, 200, { valid });
  } 
  if (pathname === '/api/carriers') {
    const rows = filterCarriers(query);
    const tiered = applyTier(rows, query.tier === 'paid' ? 'paid' : 'free');
    return send(res, 200, { count: rows.length, results: tiered });
  }

  if (pathname === '/api/export') {
    if (query.tier !== 'paid') {
      return send(res, 403, { error: 'Export sirf paid users ke liye hai. Pehle upgrade karein.' });
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

server.listen(PORT, () => console.log(`CarrierPulse demo running at http://localhost:${PORT}`));
