/* =====================================================
   TANK WAR — DESERT SHOWDOWN
   Local two-player artillery game
   Landscape-first | No gameplay timer
   ===================================================== */

"use strict";

/* =======================
   DOM HELPERS
   ======================= */

const $ = id => document.getElementById(id);

const screens = [
  "menu-screen",
  "setup-screen",
  "battle-screen",
  "result-screen",
  "howto-screen"
];

const ui = {
  menu: $("menu-screen"),
  setup: $("setup-screen"),
  battle: $("battle-screen"),
  result: $("result-screen"),
  howto: $("howto-screen"),

  playerName: $("player-name"),

  blueName: $("hud-blue-name"),
  redName: $("hud-red-name"),

  blueHealth: $("blue-health"),
  redHealth: $("red-health"),

  blueHP: $("blue-hp"),
  redHP: $("red-hp"),

  turn: $("turn-label"),
  wind: $("wind-label"),

  battlefield: $("battlefield"),
  terrainCanvas: $("terrain-canvas"),
  fxCanvas: $("fx-canvas"),

  blueTank: $("tank-blue"),
  redTank: $("tank-red"),

  angle: $("angle-slider"),
  power: $("power-slider"),

  angleValue: $("angle-value"),
  powerValue: $("power-value"),
  aimReadout: $("aim-readout"),

  fire: $("fire-btn"),
  pause: $("pause-btn"),

  toast: $("battle-toast"),
  notice: $("global-notice"),

  pauseOverlay: $("pause-overlay"),
  confirmOverlay: $("confirm-overlay")
};

const terrainContext = ui.terrainCanvas.getContext("2d");
const fxContext = ui.fxCanvas.getContext("2d");

/* =======================
   GAME CONFIGURATION
   ======================= */

const CONFIG = {
  maxHealth: 100,

  tankWidth: 58,
  tankHeight: 40,

  moveDistance: 38,
  moveLimit: 115,

  shellRadius: 5,
  gravity: 310,

  directHitDamage: 38,
  blastRadius: 68,
  blastDamage: 48,

  terrainColour: "#bd783f",
  terrainHighlight: "#f4bd68",
  terrainShadow: "#985632"
};

/* =======================
   TANK TYPES
   ======================= */

const TANKS = [
  {
    name: "SCOUT",
    description: "Quick and balanced",
    health: 100,
    power: 1,
    colour: "#39a8ff"
  },
  {
    name: "BRUISER",
    description: "Heavy armour",
    health: 120,
    power: 0.94,
    colour: "#ff5a62"
  },
  {
    name: "STRIKER",
    description: "Powerful shots",
    health: 90,
    power: 1.18,
    colour: "#ffc857"
  },
  {
    name: "TITAN",
    description: "Built for endurance",
    health: 140,
    power: 0.86,
    colour: "#70df9a"
  }
];

let blueTankChoice = 0;
let redTankChoice = 1;

let match = null;
let paused = false;
let shotInProgress = false;
let currentScreen = "menu-screen";

let terrain = [];
let terrainWidth = 0;
let terrainHeight = 0;

let animationFrame = 0;
let toastTimeout = null;
let noticeTimeout = null;

let audioContext = null;
let masterVolume = 0.25;
let effectsEnabled = true;

/* =======================
   MATCH STATE
   ======================= */

function createPlayer(name, tankType, team, x) {
  return {
    name,
    type: tankType,
    team,

    x,
    y: 0,

    health: tankType.health,
    maxHealth: tankType.health,

    angle: team === "blue" ? 45 : 135,
    power: 65,

    moved: 0,
    alive: true
  };
}

function createMatch() {
  const width = ui.battlefield.clientWidth;

  const firstName =
    ui.playerName.value.trim().slice(0, 16) || "Desert Ace";

  match = {
    players: [
      createPlayer(
        firstName,
        TANKS[blueTankChoice],
        "blue",
        width * 0.17
      ),

      createPlayer(
        "Player 2",
        TANKS[redTankChoice],
        "red",
        width * 0.83
      )
    ],

    turn: 0,
    wind: Math.round(Math.random() * 16 - 8),

    projectile: null,
    particles: [],

    terrainDamage: [],

    winner: null,
    started: false
  };

  paused = false;
  shotInProgress = false;
}

/* =======================
   SCREEN MANAGEMENT
   ======================= */

function showScreen(id) {
  screens.forEach(screenId => {
    const screen = $(screenId);

    if (screen) {
      screen.classList.toggle("active", screenId === id);
    }
  });

  currentScreen = id;

  if (id === "battle-screen") {
    requestAnimationFrame(resizeBattlefield);
  }

  closeOverlay(ui.pauseOverlay);
  closeOverlay(ui.confirmOverlay);
}

function openOverlay(element) {
  element.classList.add("open");
  element.setAttribute("aria-hidden", "false");
}

function closeOverlay(element) {
  element.classList.remove("open");
  element.setAttribute("aria-hidden", "true");
}

function showNotice(message, duration = 1800) {
  ui.notice.textContent = message;
  ui.notice.classList.add("show");

  clearTimeout(noticeTimeout);

  noticeTimeout = setTimeout(() => {
    ui.notice.classList.remove("show");
  }, duration);
}

function showToast(message, duration = 1400) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    ui.toast.classList.remove("show");
  }, duration);
}

/* =======================
   AUDIO
   ======================= */

function initAudio() {
  if (!audioContext) {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function sound(
  frequency = 300,
  duration = 0.12,
  type = "sine",
  volume = 0.2
) {
  if (!effectsEnabled || masterVolume <= 0) return;

  initAudio();

  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(
    volume * masterVolume,
    audioContext.currentTime
  );

  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + duration
  );

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function soundExplosion() {
  sound(95, 0.28, "sawtooth", 0.32);
  setTimeout(() => sound(48, 0.3, "triangle", 0.22), 55);
}

/* =======================
   TANK SELECTION
   ======================= */

function updateTankSelection(team) {
  const isBlue = team === "blue";
  const choice = isBlue ? blueTankChoice : redTankChoice;

  const tank = TANKS[choice];

  $(team + "-tank-name").textContent = tank.name;
  $(team + "-tank-desc").textContent = tank.description;

  const dots = $(team + "-dots");

  dots.replaceChildren();

  TANKS.forEach((item, index) => {
    const dot = document.createElement("span");

    dot.className =
      "tank-dot" + (index === choice ? " selected" : "");

    dots.appendChild(dot);
  });

  const preview = document.querySelector(
    isBlue ? ".blue-preview" : ".red-preview"
  );

  const turret = preview.querySelector(".preview-turret");
  const hull = preview.querySelector(".preview-hull");

  turret.style.background = tank.colour;
  hull.style.filter = `hue-rotate(${choice * 22}deg)`;
}

function changeTank(team, direction) {
  if (team === "blue") {
    blueTankChoice =
      (blueTankChoice + direction + TANKS.length) % TANKS.length;

    updateTankSelection("blue");
  } else {
    redTankChoice =
      (redTankChoice + direction + TANKS.length) % TANKS.length;

    updateTankSelection("red");
  }

  sound(420, 0.06, "square", 0.08);
}

/* =======================
   TERRAIN GENERATION
   ======================= */

function generateTerrain() {
  const width = ui.battlefield.clientWidth;
  const height = ui.battlefield.clientHeight;

  terrainWidth = width;
  terrainHeight = height;

  terrain = [];

  const step = 8;

  for (let x = 0; x <= width + step; x += step) {
    const base = height * 0.72;

    const hill1 = Math.sin(x * 0.008) * height * 0.075;
    const hill2 = Math.sin(x * 0.021 + 1.3) * height * 0.028;
    const hill3 = Math.sin(x * 0.004 + 2.4) * height * 0.045;

    const y = Math.max(
      height * 0.48,
      Math.min(height * 0.86, base + hill1 + hill2 + hill3)
    );

    terrain.push({ x, y });
  }

  drawTerrain();
}

function terrainYAt(x) {
  if (!terrain.length) {
    return ui.battlefield.clientHeight * 0.72;
  }

  x = Math.max(0, Math.min(terrainWidth, x));

  const index = Math.min(
    terrain.length - 2,
    Math.floor(x / 8)
  );

  const a = terrain[index];
  const b = terrain[index + 1];

  if (!a || !b) {
    return terrainHeight * 0.72;
  }

  const fraction = (x - a.x) / Math.max(1, b.x - a.x);

  return a.y + (b.y - a.y) * fraction;
}

function drawTerrain() {
  const width = terrainWidth;
  const height = terrainHeight;

  if (!width || !height) return;

  terrainContext.clearRect(0, 0, width, height);

  if (terrain.length < 2) return;

  const gradient = terrainContext.createLinearGradient(
    0,
    height * 0.5,
    0,
    height
  );

  gradient.addColorStop(0, CONFIG.terrainHighlight);
  gradient.addColorStop(1, CONFIG.terrainColour);

  terrainContext.beginPath();
  terrainContext.moveTo(terrain[0].x, terrain[0].y);

  terrain.forEach(point => {
    terrainContext.lineTo(point.x, point.y);
  });

  terrainContext.lineTo(width, height);
  terrainContext.lineTo(0, height);
  terrainContext.closePath();

  terrainContext.fillStyle = gradient;
  terrainContext.fill();

  terrainContext.beginPath();

  terrain.forEach((point, index) => {
    if (index === 0) {
      terrainContext.moveTo(point.x, point.y);
    } else {
      terrainContext.lineTo(point.x, point.y);
    }
  });

  terrainContext.strokeStyle = "#ffe0a0";
  terrainContext.lineWidth = 3;
  terrainContext.stroke();

  terrainContext.beginPath();

  terrain.forEach((point, index) => {
    if (index === 0) {
      terrainContext.moveTo(point.x, point.y + 7);
    } else {
      terrainContext.lineTo(point.x, point.y + 7);
    }
  });

  terrainContext.strokeStyle = "#b86d3c";
  terrainContext.lineWidth = 2;
  terrainContext.globalAlpha = 0.55;
  terrainContext.stroke();
  terrainContext.globalAlpha = 1;
}

/* =======================
   TERRAIN DAMAGE
   ======================= */

function deformTerrain(centerX, radius) {
  terrain = terrain.map(point => {
    const distance = Math.abs(point.x - centerX);

    if (distance >= radius) return point;

    const influence = 1 - distance / radius;
    const craterDepth = Math.sin(influence * Math.PI * 0.5);

    return {
      x: point.x,
      y: Math.min(
        terrainHeight * 0.91,
        point.y + craterDepth * radius * 0.46
      )
    };
  });

  drawTerrain();
  positionTanks();
}

/* =======================
   CANVAS RESIZING
   ======================= */

function resizeCanvas(canvas, context, width, height) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeBattlefield() {
  if (currentScreen !== "battle-screen") return;

  const width = ui.battlefield.clientWidth;
  const height = ui.battlefield.clientHeight;

  if (width < 1 || height < 1) return;

  resizeCanvas(ui.terrainCanvas, terrainContext, width, height);
  resizeCanvas(ui.fxCanvas, fxContext, width, height);

  if (!match || !match.started) {
    generateTerrain();
    return;
  }

  const oldWidth = terrainWidth;
  const oldHeight = terrainHeight;

  if (oldWidth > 0 && oldHeight > 0) {
    const scaleX = width / oldWidth;
    const scaleY = height / oldHeight;

    match.players.forEach(player => {
      player.x *= scaleX;
    });

    terrain = terrain.map(point => ({
      x: point.x * scaleX,
      y: point.y * scaleY
    }));

    if (match.projectile) {
      match.projectile.x *= scaleX;
      match.projectile.y *= scaleY;
    }
  } else {
    generateTerrain();
  }

  terrainWidth = width;
  terrainHeight = height;

  drawTerrain();
  positionTanks();
  drawAim();
}

/* =======================
   TANK POSITIONING
   ======================= */

function currentPlayer() {
  return match ? match.players[match.turn] : null;
}

function opponentPlayer() {
  return match ? match.players[1 - match.turn] : null;
}

function tankElement(player) {
  return player.team === "blue" ? ui.blueTank : ui.redTank;
}

function positionTanks() {
  if (!match || !terrain.length) return;

  match.players.forEach(player => {
    player.x = Math.max(
      CONFIG.tankWidth / 2,
      Math.min(terrainWidth - CONFIG.tankWidth / 2, player.x)
    );

    const ground = terrainYAt(player.x);

    player.y = ground - CONFIG.tankHeight;

    const element = tankElement(player);

    element.style.left = (player.x - CONFIG.tankWidth / 2) + "px";
    element.style.top = player.y + "px";

    const turret = element.querySelector(".tank-turret");
    const barrel = element.querySelector(".tank-barrel");

    const localAngle =
      player.team === "blue" ? player.angle : 180 - player.angle;

    turret.style.transform = `rotate(${-localAngle}deg)`;

    barrel.style.transform = "rotate(0deg)";
  });
}

/* =======================
   AIMING
   ======================= */

function updateAimFromSliders() {
  if (!match || shotInProgress) return;

  const player = currentPlayer();

  player.angle = Number(ui.angle.value);
  player.power = Number(ui.power.value);

  updateAimLabels();
  drawAim();
  positionTanks();
}

function updateAimLabels() {
  if (!match) return;

  const player = currentPlayer();

  ui.angleValue.textContent = Math.round(player.angle) + "°";
  ui.powerValue.textContent = Math.round(player.power) + "%";
  ui.aimReadout.textContent = Math.round(player.angle) + "°";
}

function syncSlidersToPlayer() {
  const player = currentPlayer();

  ui.angle.value = Math.round(player.angle);
  ui.power.value = Math.round(player.power);

  updateAimLabels();
}

function getBarrelTip(player) {
  const direction = player.team === "blue" ? 1 : -1;

  const localAngle =
    player.team === "blue"
      ? player.angle
      : 180 - player.angle;

  const radians = localAngle * Math.PI / 180;

  const tankX = player.x;
  const tankY = player.y + 10;

  return {
    x: tankX + Math.cos(radians) * direction * 31,
    y: tankY - Math.sin(radians) * 31
  };
}

function drawAim() {
  if (!match || !terrainWidth || !terrainHeight) return;

  fxContext.clearRect(0, 0, terrainWidth, terrainHeight);

  const player = currentPlayer();

  if (!player || shotInProgress || paused) return;

  const start = getBarrelTip(player);

  const radians = player.angle * Math.PI / 180;
  const direction = player.team === "blue" ? 1 : -1;

  const power = player.power * 2.4;

  fxContext.save();

  fxContext.setLineDash([4, 5]);
  fxContext.strokeStyle = "#ffffffa0";
  fxContext.lineWidth = 2;

  fxContext.beginPath();
  fxContext.moveTo(start.x, start.y);

  for (let i = 1; i <= 18; i++) {
    const t = i * 0.065;

    const x =
      start.x +
      direction * Math.cos(radians) * power * t * 10;

    const y =
      start.y -
      Math.sin(radians) * power * t * 10 +
      0.5 * CONFIG.gravity * t * t;

    fxContext.lineTo(x, y);
  }

  fxContext.stroke();
  fxContext.restore();
}

/* =======================
   START MATCH
   ======================= */

function startMatch() {
  initAudio();

  createMatch();

  showScreen("battle-screen");

  requestAnimationFrame(() => {
    const width = ui.battlefield.clientWidth;
    const height = ui.battlefield.clientHeight;

    resizeCanvas(ui.terrainCanvas, terrainContext, width, height);
    resizeCanvas(ui.fxCanvas, fxContext, width, height);

    generateTerrain();

    match.players[0].x = width * 0.16;
    match.players[1].x = width * 0.84;

    match.started = true;

    positionTanks();
    updateHUD();
    syncSlidersToPlayer();

    showToast("BATTLE START!", 1200);
  });
}

/* =======================
   HEALTH AND TURN HUD
   ======================= */

function updateHUD() {
  if (!match) return;

  const blue = match.players[0];
  const red = match.players[1];

  ui.blueName.textContent = blue.name;
  ui.redName.textContent = red.name;

  ui.blueHealth.style.width =
    Math.max(0, blue.health / blue.maxHealth * 100) + "%";

  ui.redHealth.style.width =
    Math.max(0, red.health / red.maxHealth * 100) + "%";

  ui.blueHP.textContent =
    `${Math.ceil(blue.health)} / ${blue.maxHealth} HP`;

  ui.redHP.textContent =
    `${Math.ceil(red.health)} / ${red.maxHealth} HP`;

  const active = currentPlayer();

  ui.turn.textContent =
    active.team.toUpperCase() + "'S TURN";

  ui.turn.style.color =
    active.team === "blue" ? "#6ed4ff" : "#ff9b92";

  ui.wind.textContent =
    "WIND " + (match.wind >= 0 ? "→ " : "← ") +
    Math.abs(match.wind);

  ui.fire.disabled = shotInProgress || paused;

  $("left-btn").disabled =
    shotInProgress || paused || active.moved >= CONFIG.moveLimit;

  $("right-btn").disabled =
    shotInProgress || paused || active.moved >= CONFIG.moveLimit;
}

/* =======================
   TANK MOVEMENT
   ======================= */

function moveTank(direction) {
  if (!match || paused || shotInProgress) return;

  const player = currentPlayer();

  if (player.moved >= CONFIG.moveLimit) {
    showToast("MOVEMENT LIMIT REACHED");
    return;
  }

  const amount = Math.min(
    CONFIG.moveDistance,
    CONFIG.moveLimit - player.moved
  );

  const nextX = player.x + direction * amount;

  const opponent = opponentPlayer();

  if (Math.abs(nextX - opponent.x) < CONFIG.tankWidth + 8) {
    showToast("TOO CLOSE TO THE OTHER TANK");
    return;
  }

  player.x = Math.max(
    CONFIG.tankWidth / 2,
    Math.min(terrainWidth - CONFIG.tankWidth / 2, nextX)
  );

  player.moved += amount;

  positionTanks();
  drawAim();
  updateHUD();

  sound(180, 0.06, "triangle", 0.08);
}

/* =======================
   FIRING
   ======================= */

function fireShell() {
  if (!match || paused || shotInProgress) return;

  initAudio();

  const player = currentPlayer();
  const start = getBarrelTip(player);

  const direction = player.team === "blue" ? 1 : -1;
  const angle = player.angle * Math.PI / 180;

  const speed = 200 + player.power * 3.1;

  match.projectile = {
    x: start.x,
    y: start.y,

    vx: direction * Math.cos(angle) * speed *
      player.type.power,

    vy: -Math.sin(angle) * speed *
      player.type.power,

    age: 0
  };

  shotInProgress = true;

  ui.fire.disabled = true;
  $("left-btn").disabled = true;
  $("right-btn").disabled = true;

  sound(150, 0.18, "sawtooth", 0.22);

  lastFrameTime = performance.now();

  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(projectileFrame);
}

/* =======================
   PROJECTILE PHYSICS
   ======================= */

let lastFrameTime = 0;

function projectileFrame(timestamp) {
  if (!match || !match.projectile) return;

  if (paused) {
    animationFrame = requestAnimationFrame(projectileFrame);
    return;
  }

  const delta = Math.min(
    0.032,
    Math.max(0.001, (timestamp - lastFrameTime) / 1000)
  );

  lastFrameTime = timestamp;

  const projectile = match.projectile;

  projectile.age += delta;

  projectile.vx += match.wind * 1.8 * delta;
  projectile.vy += CONFIG.gravity * delta;

  projectile.x += projectile.vx * delta;
  projectile.y += projectile.vy * delta;

  drawProjectile(projectile);

  const target = opponentPlayer();

  const tankCenterX = target.x;
  const tankCenterY = target.y + 18;

  const distance = Math.hypot(
    projectile.x - tankCenterX,
    projectile.y - tankCenterY
  );

  const groundY = terrainYAt(projectile.x);

  if (distance < 27) {
    explode(projectile.x, projectile.y, true);
    return;
  }

  if (
    projectile.y >= groundY ||
    projectile.x < -20 ||
    projectile.x > terrainWidth + 20 ||
    projectile.y > terrainHeight + 30 ||
    projectile.age > 8
  ) {
    explode(
      Math.max(0, Math.min(terrainWidth, projectile.x)),
      Math.max(0, Math.min(terrainHeight, projectile.y)),
      false
    );

    return;
  }

  animationFrame = requestAnimationFrame(projectileFrame);
}

function drawProjectile(projectile) {
  fxContext.clearRect(0, 0, terrainWidth, terrainHeight);

  const active = currentPlayer();

  const start = getBarrelTip(active);

  fxContext.save();

  fxContext.strokeStyle = "#fff1a0";
  fxContext.lineWidth = 3;

  fxContext.beginPath();
  fxContext.moveTo(start.x, start.y);
  fxContext.lineTo(projectile.x, projectile.y);
  fxContext.stroke();

  fxContext.beginPath();
  fxContext.arc(
    projectile.x,
    projectile.y,
    CONFIG.shellRadius,
    0,
    Math.PI * 2
  );

  fxContext.fillStyle = "#fff5cb";
  fxContext.shadowColor = "#ff8b38";
  fxContext.shadowBlur = 12;
  fxContext.fill();

  fxContext.restore();
}

/* =======================
   EXPLOSIONS AND DAMAGE
   ======================= */

function explode(x, y, directHit) {
  if (!match || !match.projectile) return;

  match.projectile = null;

  soundExplosion();

  createExplosionParticles(x, y);

  const target = opponentPlayer();

  const distance = Math.hypot(
    target.x - x,
    target.y + 18 - y
  );

  if (directHit || distance < CONFIG.blastRadius) {
    const falloff = Math.max(
      0.25,
      1 - distance / (CONFIG.blastRadius * 1.4)
    );

    const damage = Math.round(
      CONFIG.blastDamage * falloff +
      (directHit ? CONFIG.directHitDamage : 0)
    );

    target.health = Math.max(0, target.health - damage);

    showToast(
      directHit
        ? `DIRECT HIT! -${damage} HP`
        : `BLAST DAMAGE! -${damage} HP`,
      1600
    );

    sound(250, 0.12, "square", 0.15);
  } else {
    showToast("MISS! ADJUST YOUR AIM");
  }

  deformTerrain(x, 42);

  drawParticles();

  updateHUD();

  setTimeout(finishTurn, 850);
}

function createExplosionParticles(x, y) {
  const colours = [
    "#ffefad",
    "#ffbd4a",
    "#ff7b36",
    "#e94e43",
    "#d7c4a0"
  ];

  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 180;

    match.particles.push({
      x,
      y,

      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,

      life: 0.35 + Math.random() * 0.55,
      maxLife: 0.9,

      size: 2 + Math.random() * 6,

      colour: colours[
        Math.floor(Math.random() * colours.length)
      ]
    });
  }
}

function drawParticles() {
  if (!match) return;

  const ctx = fxContext;

  ctx.clearRect(0, 0, terrainWidth, terrainHeight);

  const particles = match.particles;

  particles.forEach(particle => {
    ctx.globalAlpha = Math.max(
      0,
      Math.min(1, particle.life / particle.maxLife)
    );

    ctx.fillStyle = particle.colour;

    ctx.beginPath();
    ctx.arc(
      particle.x,
      particle.y,
      particle.size,
      0,
      Math.PI * 2
    );

    ctx.fill();
  });

  ctx.globalAlpha = 1;

  match.particles = particles.filter(
    particle => particle.life > 0
  );
}

/* =======================
   TURN MANAGEMENT
   ======================= */

function finishTurn() {
  if (!match) return;

  if (match.players.some(player => player.health <= 0)) {
    finishMatch();
    return;
  }

  match.turn = 1 - match.turn;

  match.wind = Math.round(Math.random() * 16 - 8);

  const player = currentPlayer();

  player.moved = 0;

  shotInProgress = false;

  syncSlidersToPlayer();
  positionTanks();
  updateHUD();
  drawAim();

  showToast(
    player.team === "blue"
      ? "BLUE TEAM — YOUR TURN"
      : "RED TEAM — YOUR TURN"
  );
}

/* =======================
   VICTORY
   ======================= */

function finishMatch() {
  if (!match) return;

  shotInProgress = false;
  match.projectile = null;

  cancelAnimationFrame(animationFrame);

  const blue = match.players[0];
  const red = match.players[1];

  let winner = null;

  if (blue.health <= 0 && red.health <= 0) {
    $("result-title").textContent = "DRAW!";
    $("result-winner").textContent = "BOTH TANKS DESTROYED";
    $("result-subtitle").textContent = "The desert battle ends in a draw.";
  } else {
    winner = blue.health > 0 ? blue : red;

    $("result-title").textContent = "VICTORY!";
    $("result-winner").textContent =
      winner.name + " WINS!";

    $("result-subtitle").textContent =
      "The desert belongs to the champion.";
  }

  match.winner = winner;

  closeOverlay(ui.pauseOverlay);
  showScreen("result-screen");

  sound(660, 0.22, "triangle", 0.22);
  setTimeout(() => sound(880, 0.3, "triangle", 0.2), 160);
}

/* =======================
   PAUSE AND RESTART
   ======================= */

function pauseGame() {
  if (!match || paused) return;

  paused = true;

  openOverlay(ui.pauseOverlay);

  ui.fire.disabled = true;
}

function resumeGame() {
  paused = false;

  closeOverlay(ui.pauseOverlay);

  updateHUD();
  drawAim();

  if (match && match.projectile) {
    lastFrameTime = performance.now();
    animationFrame = requestAnimationFrame(projectileFrame);
  }
}

function restartGame() {
  closeOverlay(ui.pauseOverlay);
  startMatch();
}

/* =======================
   CONFIRMATION DIALOG
   ======================= */

let confirmAction = null;

function askConfirmation(title, message, action) {
  $("confirm-title").textContent = title;
  $("confirm-message").textContent = message;

  confirmAction = action;

  openOverlay(ui.confirmOverlay);
}

function confirmYes() {
  closeOverlay(ui.confirmOverlay);

  if (typeof confirmAction === "function") {
    confirmAction();
  }

  confirmAction = null;
}

function confirmCancel() {
  closeOverlay(ui.confirmOverlay);
  confirmAction = null;
}

/* =======================
   BATTLEFIELD AIM DRAG
   ======================= */

let aimPointerDown = false;

ui.battlefield.addEventListener("pointerdown", event => {
  if (
    !match ||
    paused ||
    shotInProgress ||
    event.target.closest("button")
  ) {
    return;
  }

  aimPointerDown = true;

  ui.battlefield.setPointerCapture?.(event.pointerId);

  updateAimFromPointer(event);
});

ui.battlefield.addEventListener("pointermove", event => {
  if (!aimPointerDown) return;

  updateAimFromPointer(event);
});

ui.battlefield.addEventListener("pointerup", () => {
  aimPointerDown = false;
});

ui.battlefield.addEventListener("pointercancel", () => {
  aimPointerDown = false;
});

function updateAimFromPointer(event) {
  if (!match || shotInProgress || paused) return;

  const player = currentPlayer();

  const rect = ui.battlefield.getBoundingClientRect();

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const dx = Math.abs(x - player.x);
  const dy = player.y + 15 - y;

  let angle = Math.atan2(dy, dx) * 180 / Math.PI;

  angle = Math.max(10, Math.min(80, angle));

  player.angle = Math.round(angle);

  syncSlidersToPlayer();
  drawAim();
  positionTanks();
}

/* =======================
   SETTINGS
   ======================= */

function setupSettings() {
  const volume = $("master-volume");
  const volumeValue = $("volume-value");
  const musicToggle = $("music-toggle");
  const effectsToggle = $("effects-toggle");

  if (volume) {
    volume.value = masterVolume * 100;

    volume.addEventListener("input", () => {
      masterVolume = Number(volume.value) / 100;

      if (volumeValue) {
        volumeValue.textContent = volume.value + "%";
      }
    });
  }

  if (musicToggle) {
    musicToggle.addEventListener("click", () => {
      showNotice("Background music isn't included yet.");
    });
  }

  if (effectsToggle) {
    effectsToggle.addEventListener("click", () => {
      effectsEnabled = !effectsEnabled;

      effectsToggle.setAttribute(
        "aria-pressed",
        String(effectsEnabled)
      );

      showNotice(
        effectsEnabled ? "Sound effects ON" : "Sound effects OFF"
      );
    });
  }
}

/* =======================
   BUTTON EVENTS
   ======================= */

function bindEvents() {
  $("play-btn").addEventListener("click", () => {
    initAudio();
    showScreen("setup-screen");
  });

  $("howto-btn").addEventListener("click", () => {
    showScreen("howto-screen");
  });

  $("howto-back-btn").addEventListener("click", () => {
    showScreen("setup-screen");
  });

  document.querySelectorAll("[data-screen]").forEach(button => {
    button.addEventListener("click", () => {
      showScreen(button.dataset.screen);
    });
  });

  $("blue-prev").addEventListener("click", () => {
    changeTank("blue", -1);
  });

  $("blue-next").addEventListener("click", () => {
    changeTank("blue", 1);
  });

  $("red-prev").addEventListener("click", () => {
    changeTank("red", -1);
  });

  $("red-next").addEventListener("click", () => {
    changeTank("red", 1);
  });

  $("start-btn").addEventListener("click", startMatch);

  $("left-btn").addEventListener("click", () => {
    moveTank(-1);
  });

  $("right-btn").addEventListener("click", () => {
    moveTank(1);
  });

  ui.angle.addEventListener("input", updateAimFromSliders);
  ui.power.addEventListener("input", updateAimFromSliders);

  ui.fire.addEventListener("click", fireShell);

  ui.pause.addEventListener("click", pauseGame);

  $("resume-btn").addEventListener("click", resumeGame);

  $("restart-btn").addEventListener("click", () => {
    askConfirmation(
      "RESTART BATTLE?",
      "The current match will be restarted.",
      restartGame
    );
  });

  $("leave-btn").addEventListener("click", () => {
    askConfirmation(
      "LEAVE BATTLE?",
      "Your current match will end.",
      () => {
        match = null;
        showScreen("menu-screen");
      }
    );
  });

  $("confirm-yes-btn").addEventListener("click", confirmYes);
  $("confirm-cancel-btn").addEventListener("click", confirmCancel);

  $("rematch-btn").addEventListener("click", startMatch);

  $("menu-btn").addEventListener("click", () => {
    match = null;
    showScreen("menu-screen");
  });

  setupSettings();
}

/* =======================
   KEYBOARD SUPPORT
   ======================= */

window.addEventListener("keydown", event => {
  if (currentScreen !== "battle-screen") return;

  if (event.key === "Escape") {
    if (paused) {
      resumeGame();
    } else {
      pauseGame();
    }

    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveTank(-1);
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    moveTank(1);
  }

  if (event.key === " " && !event.repeat) {
    event.preventDefault();
    fireShell();
  }
});

/* =======================
   PAGE LIFECYCLE
   ======================= */

window.addEventListener("resize", () => {
  if (currentScreen === "battle-screen") {
    resizeBattlefield();
  }
});

document.addEventListener("visibilitychange", () => {
  if (
    document.hidden &&
    currentScreen === "battle-screen" &&
    !paused
  ) {
    pauseGame();
  }
});

/* =======================
   INITIALIZATION
   ======================= */

function initializeGame() {
  updateTankSelection("blue");
  updateTankSelection("red");

  bindEvents();

  showScreen("menu-screen");

  console.log("Tank War initialized.");
}

initializeGame();
