// --- LOGOWANIE ---
const loginScreen = document.getElementById('loginScreen');
const gameScreen = document.getElementById('gameScreen');
const nickInput = document.getElementById('nickInput');
const passwordInput = document.getElementById('passwordInput');
const loginButton = document.getElementById('loginButton');
const loginError = document.getElementById('loginError');
const deviceButtons = document.querySelectorAll('.device-button');

const profileBadge = document.getElementById('profileBadge');
const profileModal = document.getElementById('profileModal');
const logoutButton = document.getElementById('logoutButton');
const leaderboardButton = document.getElementById('leaderboardButton');
const closeProfile = document.getElementById('closeProfile');

const leaderboardModal = document.getElementById('leaderboardModal');
const closeLeaderboard = document.getElementById('closeLeaderboard');
const leaderboardList = document.getElementById('leaderboardList');

const p1NameLabel = document.getElementById('p1Name');
const p2NameLabel = document.getElementById('p2Name');
const p1HpLabel = document.getElementById('p1HpLabel');
const p2HpLabel = document.getElementById('p2HpLabel');
const p1AmmoLabel = document.getElementById('p1AmmoLabel');
const p2AmmoLabel = document.getElementById('p2AmmoLabel');
const statusText = document.getElementById('statusText');

let selectedDevice = null;
deviceButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    selectedDevice = btn.dataset.device;
    deviceButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

let socket = null;
let currentNick = null;

loginButton.addEventListener('click', () => {
  const nick = nickInput.value.trim();
  const password = passwordInput.value.trim();
  if (!nick || !password || !selectedDevice) {
    loginError.textContent = 'Podaj nick, hasło i wybierz urządzenie.';
    return;
  }
  loginError.textContent = '';

  socket = new WebSocket("wss://WSS_LINK"); // <<< TU WSTAW SWÓJ LINK Z RENDER

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: 'login', nick, password, device: selectedDevice }));
  });

  socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'login-ok') {
      currentNick = nick;
      loginScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');
      startGameClient(msg);
    } else if (msg.type === 'login-error') {
      loginError.textContent = msg.error || 'Błąd logowania.';
    } else if (msg.type === 'duel-state') {
      updateDuelState(msg);
    } else if (msg.type === 'leaderboard') {
      renderLeaderboard(msg.entries);
    }
  });

  socket.addEventListener('close', () => {
    loginError.textContent = 'Połączenie z serwerem przerwane.';
  });
});

// --- GRA ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas(device) {
  if (device === 'mobile') {
    const w = Math.min(window.innerWidth, 420);
    const h = Math.min(window.innerHeight, 720);
    canvas.width = w;
    canvas.height = h;
  } else {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}

window.addEventListener('resize', () => {
  if (selectedDevice) resizeCanvas(selectedDevice);
});

class Player {
  constructor(x, y, color, nick) {
    this.x = x;
    this.y = y;
    this.radius = 26;
    this.color = color;
    this.nick = nick;
    this.hp = 100;
    this.ammo = 7;
  }
}

class Bullet {
  constructor(x, y, vx, vy, owner) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.owner = owner;
    this.radius = 6;
    this.damage = 15;
  }
}

let localP1 = null;
let localP2 = null;
let bullets = [];
const keys = new Set();

window.addEventListener('keydown', e => keys.add(e.code));
window.addEventListener('keyup', e => keys.delete(e.code));

function startGameClient(msg) {
  resizeCanvas(msg.self.device);

  localP1 = new Player(200, canvas.height / 2, '#73e1dd', msg.self.nick);
  localP2 = new Player(canvas.width - 200, canvas.height / 2, '#ffb04b', msg.opponent.nick);

  bullets = [];

  p1NameLabel.textContent = msg.self.nick;
  p2NameLabel.textContent = msg.opponent.nick;
  statusText.textContent = 'POJEDYNEK ROZPOCZĘTY';

  lastTime = performance.now();
  requestAnimationFrame(frame);
}

function updateDuelState(msg) {
  p1HpLabel.textContent = `HP: ${msg.self.hp}`;
  p2HpLabel.textContent = `HP: ${msg.opponent.hp}`;
  p1AmmoLabel.textContent = `AMMO: ${msg.self.ammo}`;
  p2AmmoLabel.textContent = `AMMO: ${msg.opponent.ammo}`;
}

function update(dt) {
  if (!localP1 || !localP2) return;

  let dx = 0, dy = 0;
  if (keys.has('KeyW')) dy -= 1;
  if (keys.has('KeyS')) dy += 1;
  if (keys.has('KeyA')) dx -= 1;
  if (keys.has('KeyD')) dx += 1;

  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;

  localP1.x += dx * 200 * dt;
  localP1.y += dy * 200 * dt;

  if (keys.has('Space')) shoot(localP1);

  bullets.forEach(b => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (distance(b, localP2) < b.radius + localP2.radius) {
      localP2.hp = Math.max(0, localP2.hp - b.damage);
    }
  });

  bullets = bullets.filter(b =>
    b.x > -50 && b.x < canvas.width + 50 &&
    b.y > -50 && b.y < canvas.height + 50
  );

  p1HpLabel.textContent = `HP: ${localP1.hp}`;
  p2HpLabel.textContent = `HP: ${localP2.hp}`;
  p1AmmoLabel.textContent = `AMMO: ${localP1.ammo}`;
}

function shoot(player) {
  if (player.ammo <= 0) return;
  player.ammo -= 1;

  const bullet = new Bullet(
    player.x,
    player.y,
    player === localP1 ? 400 : -400,
    0,
    player
  );

  bullets.push(bullet);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function draw() {
  ctx.fillStyle = '#0b1624';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawPlayer(localP1);
  drawPlayer(localP2);

  bullets.forEach(drawBullet);
}

function drawPlayer(p) {
  if (!p) return;

  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();

  const hpRatio = p.hp / 100;

  ctx.fillStyle = '#000';
  ctx.fillRect(p.x - 30, p.y - 40, 60, 6);

  ctx.fillStyle = hpRatio > 0.5 ? '#73e1dd' : '#ff5f57';
  ctx.fillRect(p.x - 30, p.y - 40, 60 * hpRatio, 6);
}

function drawBullet(b) {
  ctx.fillStyle = '#ffb04b';
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
  ctx.fill();
}

let lastTime = performance.now();
function frame(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  update(dt);
  draw();

  requestAnimationFrame(frame);
}

// --- PROFIL / TOPKI ---
profileBadge.addEventListener('click', () => {
  profileModal.classList.remove('hidden');
});

closeProfile.addEventListener('click', () => {
  profileModal.classList.add('hidden');
});

logoutButton.addEventListener('click', () => {
  if (socket) socket.close();
  gameScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
});

leaderboardButton.addEventListener('click', () => {
  if (socket) socket.send(JSON.stringify({ type: 'leaderboard-get' }));
  leaderboardModal.classList.remove('hidden');
});

closeLeaderboard.addEventListener('click', () => {
  leaderboardModal.classList.add('hidden');
});

function renderLeaderboard(entries) {
  leaderboardList.innerHTML = '';
  entries.slice(0, 20).forEach(e => {
    const li = document.createElement('li');
    li.textContent = `${e.nick} — RANK: ${e.rank}, KILLE: ${e.kills}, WYGRANE: ${e.wins}, PRZEGRANE: ${e.losses}`;
    leaderboardList.appendChild(li);
  });
}
