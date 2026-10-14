const http = require('http');
const WebSocket = require('ws');

const accounts = new Map(); // nick -> { password, device, stats }

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Walka Czarodziejów 2.0');
});

const wss = new WebSocket.Server({ server });

const waiting = [];

wss.on('connection', socket => {
  socket.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'login') {
      const nick = String(msg.nick || '').trim().toLowerCase();
      const password = String(msg.password || '').trim();
      const device = msg.device === 'mobile' ? 'mobile' : 'desktop';

      if (!nick || !password) {
        socket.send(JSON.stringify({ type: 'login-error', error: 'Podaj nick i hasło.' }));
        return;
      }

      if (accounts.has(nick)) {
        const acc = accounts.get(nick);
        if (acc.password !== password) {
          socket.send(JSON.stringify({ type: 'login-error', error: 'Nieprawidłowe hasło.' }));
          return;
        }
      } else {
        accounts.set(nick, {
          password,
          device,
          stats: { rank: 0, kills: 0, wins: 0, losses: 0 }
        });
      }

      socket.nick = nick;
      socket.device = device;

      socket.send(JSON.stringify({
        type: 'login-ok',
        self: { nick, device },
        opponent: { nick: 'PRZECIWNIK', device: 'desktop' }
      }));

      waiting.push(socket);
      matchmake();
    }

    if (msg.type === 'leaderboard-get') {
      const entries = [...accounts.entries()].map(([nick, acc]) => ({
        nick,
        rank: acc.stats.rank,
        kills: acc.stats.kills,
        wins: acc.stats.wins,
        losses: acc.stats.losses
      })).sort((a, b) => b.rank - a.rank);
      socket.send(JSON.stringify({ type: 'leaderboard', entries }));
    }
  });

  socket.on('close', () => {
    const idx = waiting.indexOf(socket);
    if (idx !== -1) waiting.splice(idx, 1);
  });
});

function matchmake() {
  while (waiting.length >= 2) {
    const a = waiting.shift();
    const b = waiting.shift();
    if (!a || !b) return;

    const selfA = { nick: a.nick, device: a.device, hp: 100, ammo: 7 };
    const selfB = { nick: b.nick, device: b.device, hp: 100, ammo: 7 };

    a.send(JSON.stringify({ type: 'duel-state', self: selfA, opponent: selfB }));
    b.send(JSON.stringify({ type: 'duel-state', self: selfB, opponent: selfA }));
  }
}

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Serwer działa na porcie ${port}`);
});