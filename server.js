const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory DB ──────────────────────────────────────────────────────────
let reservations = [];
let sseClients = [];

// Manager accounts — admin manages these
let managers = [
  { id: 1, username: 'Adora Restaurant', password: 'admin', restaurant: 'Adora Restaurant', city: 'Prishtinë', active: true }
];

// Admin account (fixed)
const ADMIN = { username: 'admin', password: 'admin' };

// ── SSE ───────────────────────────────────────────────────────────────────
app.get('/api/events', (req, res) => {
  const managerId = req.query.managerId ? parseInt(req.query.managerId) : null;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  const client = { res, managerId };
  sseClients.push(client);
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  req.on('close', () => { sseClients = sseClients.filter(c => c !== client); });
});

function broadcast(data, targetManagerId) {
  sseClients.forEach(client => {
    if (!targetManagerId || !client.managerId || client.managerId === targetManagerId) {
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  });
}

// ── Admin Auth ────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN.username && password === ADMIN.password) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Kredencialet janë të gabuara' });
  }
});

// ── Admin: Manage managers ────────────────────────────────────────────────
app.get('/api/admin/managers', (req, res) => {
  res.json(managers);
});

app.post('/api/admin/managers', (req, res) => {
  const { username, password, restaurant, city } = req.body;
  if (!username || !password || !restaurant) return res.status(400).json({ error: 'Të dhënat janë të pakompletuara' });
  if (managers.find(m => m.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Ky username ekziston tashmë' });
  }
  const manager = { id: Date.now(), username, password, restaurant, city: city || '', active: true };
  managers.push(manager);
  res.json(manager);
});

app.patch('/api/admin/managers/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = managers.findIndex(m => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Nuk u gjet' });
  managers[idx] = { ...managers[idx], ...req.body };
  res.json(managers[idx]);
});

app.delete('/api/admin/managers/:id', (req, res) => {
  const id = parseInt(req.params.id);
  managers = managers.filter(m => m.id !== id);
  reservations = reservations.filter(r => r.managerId !== id);
  res.json({ ok: true });
});

// ── Manager Auth ──────────────────────────────────────────────────────────
app.post('/api/manager/login', (req, res) => {
  const { username, password } = req.body;
  const manager = managers.find(m =>
    m.username.toLowerCase() === username.toLowerCase() &&
    m.password === password &&
    m.active
  );
  if (manager) {
    res.json({ ok: true, manager: { id: manager.id, username: manager.username, restaurant: manager.restaurant, city: manager.city } });
  } else {
    res.status(401).json({ error: 'Kredencialet janë të gabuara' });
  }
});

// ── Reservations ──────────────────────────────────────────────────────────
app.get('/api/reservations', (req, res) => {
  const managerId = req.query.managerId ? parseInt(req.query.managerId) : null;
  res.json(managerId ? reservations.filter(r => r.managerId === managerId) : reservations);
});

app.post('/api/reservations', (req, res) => {
  const reservation = {
    id: Date.now(),
    ...req.body,
    managerId: parseInt(req.body.managerId),
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  reservations.push(reservation);
  broadcast({ type: 'new_reservation', reservation }, reservation.managerId);
  res.json(reservation);
});

app.patch('/api/reservations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = reservations.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Nuk u gjet' });
  reservations[idx].status = req.body.status;
  const r = reservations[idx];
  broadcast({ type: 'status_update', id, status: r.status }, r.managerId);
  res.json(r);
});

// ── Routes ────────────────────────────────────────────────────────────────
app.get('/manager', (req, res) => res.sendFile(path.join(__dirname, 'public', 'manager.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ── Start ─────────────────────────────────────────────────────────────────
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets))
    for (const net of nets[name])
      if (net.family === 'IPv4' && !net.internal) return net.address;
  return 'localhost';
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✦  REZERVO KOSOVË  —  Server aktiv!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n  💻 User:    http://localhost:${PORT}`);
  console.log(`  📱 Manager: http://${ip}:${PORT}/manager`);
  console.log(`  🔧 Admin:   http://${ip}:${PORT}/admin`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
