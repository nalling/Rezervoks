const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const RESTAURANTS = [
  { id: 1,  name: "Tiffany & White",    city: "Prishtinë", cuisine: "Fine Dining",  emoji: "✦", gradient: "135deg,#1a0a30,#2d1060" },
  { id: 2,  name: "Pjata",              city: "Prishtinë", cuisine: "Mesdhetare",   emoji: "◈", gradient: "135deg,#1f0a00,#4a2000" },
  { id: 3,  name: "Renaissance Lounge", city: "Prizren",   cuisine: "Fusion",       emoji: "❋", gradient: "135deg,#0a1a00,#1e4000" },
  { id: 4,  name: "Kalaja Lounge",      city: "Prizren",   cuisine: "Tradicionale", emoji: "◉", gradient: "135deg,#001a15,#003d30" },
  { id: 5,  name: "Ora Restaurant",     city: "Pejë",      cuisine: "Kombëtare",    emoji: "✿", gradient: "135deg,#1a0018,#3d0038" },
  { id: 6,  name: "Lidhja",             city: "Gjakovë",   cuisine: "Ballkanike",   emoji: "◆", gradient: "135deg,#000d1a,#001b3d" },
  { id: 7,  name: "Dukagjini Palace",   city: "Mitrovicë", cuisine: "Fine Dining",  emoji: "♦", gradient: "135deg,#1a0f00,#3d2500" },
  { id: 8,  name: "Bardha",             city: "Ferizaj",   cuisine: "Grille",       emoji: "◇", gradient: "135deg,#0a0a1a,#1a1a3d" },
  { id: 9,  name: "Shtepia e Gjonit",   city: "Prishtinë", cuisine: "Tradicionale", emoji: "⌂", gradient: "135deg,#1a0a00,#3d2000" },
  { id: 10, name: "Mangata",            city: "Prishtinë", cuisine: "Modern",       emoji: "◎", gradient: "135deg,#001a1a,#003d3d" },
];

let reservations = [];
let sseClients = [];

// SSE — clients regjistrohen me restaurantId të tyre
app.get('/api/events', (req, res) => {
  const restaurantId = req.query.restaurantId ? parseInt(req.query.restaurantId) : null;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  const client = { res, restaurantId };
  sseClients.push(client);
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  req.on('close', () => { sseClients = sseClients.filter(c => c !== client); });
});

function broadcast(data, targetRestaurantId) {
  sseClients.forEach(client => {
    const matchesManager = client.restaurantId && client.restaurantId === targetRestaurantId;
    const isUserClient   = !client.restaurantId;
    if (matchesManager || isUserClient) {
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  });
}

app.get('/api/restaurants', (req, res) => res.json(RESTAURANTS));

app.get('/api/reservations', (req, res) => {
  const rid = req.query.restaurantId ? parseInt(req.query.restaurantId) : null;
  res.json(rid ? reservations.filter(r => r.restaurantId === rid) : reservations);
});

app.post('/api/reservations', (req, res) => {
  const reservation = {
    id: Date.now(),
    ...req.body,
    restaurantId: parseInt(req.body.restaurantId),
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  reservations.push(reservation);
  broadcast({ type: 'new_reservation', reservation }, reservation.restaurantId);
  res.json(reservation);
});

app.patch('/api/reservations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = reservations.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  reservations[idx].status = req.body.status;
  const r = reservations[idx];
  broadcast({ type: 'status_update', id, status: r.status, restaurantId: r.restaurantId });
  res.json(r);
});

app.get('/manager', (req, res) => res.sendFile(path.join(__dirname, 'public', 'manager.html')));

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets))
    for (const net of nets[name])
      if (net.family === 'IPv4' && !net.internal) return net.address;
  return 'localhost';
}

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✦  REZERVO KOSOVË  —  Server aktiv!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n  💻 LAPTOP (User):     http://localhost:${PORT}`);
  console.log(`  📱 TELEFON (Manager): http://${ip}:${PORT}/manager`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
