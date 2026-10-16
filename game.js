/* TANK WAR — PHASE 2 GAME ENGINE
   Matches the existing index.html structure.
   No external libraries or paid services required. */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value;
  };

  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

  const rand = (min, max) =>
    min + Math.random() * (max - min);

  const TANKS = [
    {
      name: "STRIKER",
      speed: 1,
      power: 1,
      armor: 1,
      description: "Balanced all-round tank"
    },
    {
      name: "TITAN",
      speed: 0.8,
      power: 1.2,
      armor: 1.25,
      description: "Heavy armor, powerful shots"
    },
    {
      name: "SCOUT",
      speed: 1.25,
      power: 0.9,
      armor: 0.85,
      description: "Fast and agile"
    }
  ];

  const game = {
    screen: "main-menu",
    mode: "local",
    players: [],
    selectedTanks: [0, 1],
    activePlayer: 0,
    round: 1,
    running: false,
    paused: false,
    busy: false,
    health: [100, 100],
    x: [0, 0],
    angle: [45, 45],
    power: 65,
    movementLeft: [100, 100],
    terrain: [],
    terrainWidth: 0,
    terrainHeight: 0,

    settings: {
      volume: 0.45,
      music: false,
      effects: true
    },

    settingsReturnScreen: "main-menu",
    confirmAction: null,
    matchToken: 0,
    audioContext: null,
    saveKey: "tankWarLocalSaveV2"
  };

  let resizeObserver = null;
  let ambientTimer = null;

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.toggle("active", screen.id === id);
    });

    game.screen = id;

    if (id === "battle-screen") {
      resizeBattlefield();
      drawTerrain();
      positionTanks();
      updateHUD();
      drawAimGuide();
    }
  }

  function notice(message, duration = 2300) {
    const el = $("global-notice");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    window.clearTimeout(notice.timer);

    notice.timer = window.setTimeout(() => {
      el.classList.remove("show");
    }, duration);
  }

  function ensureAudio() {
    if (game.audioContext) {
      if (game.audioContext.state === "suspended") {
        game.audioContext.resume().catch(() => {});
      }

      return game.audioContext;
    }

    const AudioCtx =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioCtx) return null;

    try {
      game.audioContext = new AudioCtx();
      return game.audioContext;
    } catch (_) {
      return null;
    }
  }

  function tone(
    frequency,
    duration,
    type = "sine",
    volume = 0.18,
    slide = 0
  ) {
    if (!game.settings.effects || game.settings.volume <= 0) {
      return;
    }

    const ctx = ensureAudio();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);

    if (slide) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(30, frequency + slide),
        start + duration
      );
    }

    gain.gain.setValueAtTime(0.0001, start);

    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume * game.settings.volume),
      start + 0.015
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + duration
    );

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  function playShotSound() {
    tone(150, 0.25, "sawtooth", 0.22, -90);
    tone(65, 0.32, "triangle", 0.16, -25);
  }

  function playExplosionSound() {
    tone(95, 0.42, "sawtooth", 0.24, -60);
    tone(48, 0.5, "triangle", 0.18, -15);
  }

  function playMoveSound() {
    tone(105, 0.08, "square", 0.07, 15);
  }

  function updateSaveButton() {
    const button = $("resume-match-btn");
    if (!button) return;

    const exists = !!localStorage.getItem(game.saveKey);

    button.classList.toggle("hidden", !exists);
    button.style.display = exists ? "" : "none";
  }

  function saveMatch(silent = true) {
    if (!game.running || game.screen !== "battle-screen") {
      return false;
    }

    const battlefield = $("battlefield");

    const width = battlefield
      ? battlefield.clientWidth
      : window.innerWidth;

    const height = battlefield
      ? battlefield.clientHeight
      : window.innerHeight;

    const payload = {
      version: 2,
      mode: game.mode,
      players: game.players,
      selectedTanks: game.selectedTanks,
      activePlayer: game.activePlayer,
      round: game.round,
      health: game.health,

      x: game.x.map((x) => width ? x / width : x),

      angle: game.angle,
      power: game.power,
      movementLeft: game.movementLeft,

      terrain: game.terrain.map((p) => ({
        x: width ? p.x / width : p.x,
        y: height ? p.y / height : p.y
      })),

      terrainWidth: width,
      terrainHeight: height,
      savedAt: Date.now()
    };

    try {
      localStorage.setItem(
        game.saveKey,
        JSON.stringify(payload)
      );

      updateSaveButton();

      if (!silent) {
        notice("Match saved on this device.");
      }

      return true;
    } catch (_) {
      if (!silent) {
        notice("Could not save this match on your device.");
      }

      return false;
    }
  }

  function clearSavedMatch() {
    localStorage.removeItem(game.saveKey);
    updateSaveButton();
  }

  function resumeSavedMatch() {
    let saved;

    try {
      saved = JSON.parse(
        localStorage.getItem(game.saveKey) || "null"
      );
    } catch (_) {
      saved = null;
    }

    if (!saved || !saved.players || saved.players.length !== 2) {
      notice("No saved match was found.");
      updateSaveButton();
      return;
    }

    game.mode = saved.mode || "local";
    game.players = saved.players;
    game.selectedTanks = saved.selectedTanks || [0, 1];

    game.activePlayer = clamp(
      Number(saved.activePlayer) || 0,
      0,
      1
    );

    game.round = Math.max(1, Number(saved.round) || 1);

    game.health = (saved.health || [100, 100]).map((h) =>
      clamp(Number(h) || 0, 0, 100)
    );

    game.angle = (saved.angle || [45, 45]).map((a) =>
      clamp(Number(a) || 45, 5, 85)
    );

    game.power = clamp(Number(saved.power) || 65, 20, 100);

    game.movementLeft = (
      saved.movementLeft || [100, 100]
    ).map((n) => clamp(Number(n) || 0, 0, 100));

    game.x = saved.x || [0.18, 0.82];

    game.terrain = (saved.terrain || []).map((p) => ({
      x: Number(p.x) || 0,
      y: Number(p.y) || 0
    }));

    game.terrainWidth = 1;
    game.terrainHeight = 1;

    game.running = true;
    game.paused = false;
    game.busy = false;
    game.matchToken++;

    showScreen("battle-screen");
    resizeBattlefield();

    if (game.terrain.length) {
      const battlefield = $("battlefield");
      const w = battlefield.clientWidth;
      const h = battlefield.clientHeight;

      game.terrain = game.terrain.map((p) => ({
        x: p.x * w,
        y: p.y * h
      }));

      game.terrainWidth = w;
      game.terrainHeight = h;
    } else {
      generateTerrain();
    }

    game.x = game.x.map((x) =>
      x <= 1 ? x * game.terrainWidth : x
    );

    positionTanks();
    updateHUD();
    updateControls();
    drawTerrain();
    drawAimGuide();

    notice("Saved match restored.");
  }

  function startMatch() {
    ensureAudio();

    game.matchToken++;
    game.running = false;
    game.paused = false;
    game.busy = false;

    game.health = [100, 100];
    game.activePlayer = 0;
    game.round = 1;
    game.power = 65;
    game.angle = [45, 45];
    game.movementLeft = [100, 100];

    const name1 =
      ($("player1-name")?.value || "BLUE")
        .trim()
        .slice(0, 18) || "BLUE";

    const name2 =
      ($("player2-name")?.value || "RED")
        .trim()
        .slice(0, 18) || "RED";

    game.players = [
      {
        name: name1,
        tank: TANKS[game.selectedTanks[0]] || TANKS[0]
      },
      {
        name: name2,
        tank: TANKS[game.selectedTanks[1]] || TANKS[1]
      }
    ];

    setText("vs-name1", name1);
    setText("vs-name2", name2);

    showScreen("vs-screen");
    setText("vs-countdown", "3");

    let count = 3;
    const token = game.matchToken;

    const countdown = window.setInterval(() => {
      if (token !== game.matchToken) {
        window.clearInterval(countdown);
        return;
      }

      count--;

      if (count > 0) {
        setText("vs-countdown", String(count));
      } else {
        window.clearInterval(countdown);

        game.running = true;
        showScreen("battle-screen");

        generateTerrain();

        const battlefield = $("battlefield");
        const w = battlefield.clientWidth || window.innerWidth;

        game.x = [w * 0.18, w * 0.82];

        positionTanks();
        updateHUD();
        updateControls();
        drawTerrain();
        drawAimGuide();
        saveMatch(true);

        notice(`${name1}'s turn — aim and fire!`);
      }
    }, 700);
  }

  function generateTerrain() {
    const battlefield = $("battlefield");

    const w = Math.max(
      320,
      battlefield?.clientWidth || window.innerWidth
    );

    const h = Math.max(
      240,
      battlefield?.clientHeight || window.innerHeight * 0.65
    );

    const step = 4;
    const base = h * 0.69;
    let y = base;

    game.terrain = [
      { x: 0, y: base + rand(-8, 8) }
    ];

    for (let x = step; x < w; x += step) {
      y += rand(-5, 5);
      y = clamp(y, h * 0.54, h * 0.82);

      game.terrain.push({ x, y });
    }

    game.terrain.push({
      x: w,
      y: base + rand(-8, 8)
    });

    game.terrainWidth = w;
    game.terrainHeight = h;
    game.x = [w * 0.18, w * 0.82];

    drawTerrain();
  }

  function resizeBattlefield() {
    const battlefield = $("battlefield");
    const canvas = $("terrain-canvas");

    if (!battlefield || !canvas) return;

    const w = Math.max(1, battlefield.clientWidth);
    const h = Math.max(1, battlefield.clientHeight);

    const oldW = game.terrainWidth;
    const oldH = game.terrainHeight;

    if (
      game.terrain.length &&
      oldW > 1 &&
      oldH > 1 &&
      (oldW !== w || oldH !== h)
    ) {
      game.terrain = game.terrain.map((p) => ({
        x: p.x / oldW * w,
        y: p.y / oldH * h
      }));

      game.x = game.x.map((x) => x / oldW * w);
    }

    game.terrainWidth = w;
    game.terrainHeight = h;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    if (game.terrain.length) drawTerrain();
    if (game.players.length) positionTanks();

    drawAimGuide();
  }

  function terrainYAt(x) {
    if (!game.terrain.length) {
      return (game.terrainHeight || 300) * 0.7;
    }

    x = clamp(x, 0, game.terrainWidth || 1);

    let lo = 0;
    let hi = game.terrain.length - 1;

    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;

      if (game.terrain[mid].x < x) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    const a = game.terrain[lo];
    const b = game.terrain[hi];

    const t = b.x === a.x
      ? 0
      : (x - a.x) / (b.x - a.x);

    return a.y + (b.y - a.y) * t;
  }

  function drawTerrain() {
    const canvas = $("terrain-canvas");

    if (!canvas || !game.terrain.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = game.terrainWidth || canvas.clientWidth;
    const h = game.terrainHeight || canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.moveTo(0, h);

    game.terrain.forEach((p) => {
      ctx.lineTo(p.x, p.y);
    });

    ctx.lineTo(w, h);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(
      0,
      h * 0.52,
      0,
      h
    );

    gradient.addColorStop(0, "#b78a51");
    gradient.addColorStop(0.45, "#755033");
    gradient.addColorStop(1, "#3a2b22");

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();

    game.terrain.forEach((p, i) => {
      if (i) {
        ctx.lineTo(p.x, p.y);
      } else {
        ctx.moveTo(p.x, p.y);
      }
    });

    ctx.strokeStyle = "#e4bd78";
    ctx.lineWidth = 3;
    ctx.stroke();

    for (let i = 22; i < game.terrain.length; i += 47) {
      const p = game.terrain[i];

      ctx.fillStyle = "rgba(48,35,25,.38)";
      ctx.beginPath();

      ctx.ellipse(
        p.x,
        p.y + 9,
        4 + (i % 3),
        2,
        0,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }
  }  function positionTanks() {
    if (!game.players.length) return;

    const battlefield = $("battlefield");
    if (!battlefield) return;

    const w = battlefield.clientWidth;

    [0, 1].forEach((i) => {
      const tank = $(`tank${i + 1}`);
      if (!tank) return;

      const tankWidth = tank.offsetWidth || 72;

      const x = clamp(
        game.x[i],
        tankWidth * 0.5,
        w - tankWidth * 0.5
      );

      game.x[i] = x;

      const ground = terrainYAt(x);

      tank.style.left = `${x}px`;

      tank.style.bottom = `${
        Math.max(0, battlefield.clientHeight - ground)
      }px`;

      const turret = tank.querySelector(".tank-turret");

      if (turret) {
        turret.style.transform = `rotate(${-game.angle[i]}deg)`;
      }

      tank.setAttribute(
        "aria-label",
        `${game.players[i].name} tank`
      );
    });
  }

  function getMuzzle(i) {
    const tank = $(`tank${i + 1}`);
    const battlefield = $("battlefield");

    if (!tank || !battlefield) {
      return {
        x: game.x[i],
        y: terrainYAt(game.x[i]) - 25
      };
    }

    const rect = tank.getBoundingClientRect();
    const fieldRect = battlefield.getBoundingClientRect();

    const centerX =
      rect.left - fieldRect.left + rect.width / 2;

    const groundY = terrainYAt(game.x[i]);

    const y =
      groundY - Math.max(25, rect.height * 0.68);

    const radians =
      game.angle[i] * Math.PI / 180;

    const direction = i === 0 ? 1 : -1;

    return {
      x: centerX + direction * Math.cos(radians) * 29,
      y: y - Math.sin(radians) * 29
    };
  }

  function updateHUD() {
    for (let i = 0; i < 2; i++) {
      setText(
        `hud-name${i + 1}`,
        game.players[i]?.name ||
          (i === 0 ? "BLUE" : "RED")
      );

      setText(
        `hp${i + 1}-text`,
        `${Math.round(game.health[i])}%`
      );

      const bar = $(`health${i + 1}`);

      if (bar) {
        bar.style.width =
          `${clamp(game.health[i], 0, 100)}%`;

        bar.setAttribute(
          "aria-valuenow",
          String(Math.round(game.health[i]))
        );
      }
    }

    const active =
      game.players[game.activePlayer]?.name || "PLAYER";

    setText("round-label", `ROUND ${game.round}`);

    setText(
      "turn-indicator",
      `${active.toUpperCase()}'S TURN`
    );

    setText(
      "movement-indicator",
      `MOVE: ${Math.round(
        game.movementLeft[game.activePlayer] || 0
      )}%`
    );

    setText(
      "angle-value",
      `${Math.round(game.angle[game.activePlayer])}°`
    );

    setText("power-value", `${Math.round(game.power)}%`);

    setText(
      "movement-time",
      `${Math.round(
        game.movementLeft[game.activePlayer] || 0
      )}%`
    );

    const p1 = document.querySelector(".hud-blue");
    const p2 = document.querySelector(".hud-red");

    if (p1) {
      p1.classList.toggle(
        "active-turn",
        game.activePlayer === 0
      );
    }

    if (p2) {
      p2.classList.toggle(
        "active-turn",
        game.activePlayer === 1
      );
    }
  }

  function updateControls() {
    const power = $("power-slider");

    if (power) {
      power.value = String(game.power);
    }

    const canAct =
      game.running && !game.paused && !game.busy;

    const left = $("move-left-btn");
    const right = $("move-right-btn");
    const fire = $("fire-btn");

    if (left) {
      left.disabled =
        !canAct ||
        game.movementLeft[game.activePlayer] <= 0;
    }

    if (right) {
      right.disabled =
        !canAct ||
        game.movementLeft[game.activePlayer] <= 0;
    }

    if (fire) {
      fire.disabled = !canAct;
    }

    updateHUD();
  }

  function drawAimGuide() {
    const canvas = $("aim-canvas");
    const field = $("battlefield");

    if (
      !canvas ||
      !field ||
      !game.players.length ||
      game.screen !== "battle-screen"
    ) {
      return;
    }

    const w = field.clientWidth;
    const h = field.clientHeight;

    const dpr = Math.min(
      window.devicePixelRatio || 1,
      2
    );

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (game.busy || game.paused || !game.running) {
      return;
    }

    const i = game.activePlayer;
    const muzzle = getMuzzle(i);

    const direction = i === 0 ? 1 : -1;

    const radians =
      game.angle[i] * Math.PI / 180;

    const speed = game.power * 3.15;

    let x = muzzle.x;
    let y = muzzle.y;

    const vx = Math.cos(radians) * speed * direction;
    let vy = -Math.sin(radians) * speed;

    ctx.beginPath();
    ctx.moveTo(x, y);

    for (let t = 0; t < 2.3; t += 0.07) {
      x += vx * 0.07;
      y += vy * 0.07;
      vy += 360 * 0.07;

      if (x < 0 || x > w || y > terrainYAt(x)) {
        break;
      }

      ctx.lineTo(x, y);
    }

    ctx.setLineDash([5, 7]);

    ctx.strokeStyle =
      i === 0
        ? "rgba(105,205,255,.75)"
        : "rgba(255,118,105,.75)";

    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function setAngle(value) {
    game.angle[game.activePlayer] =
      clamp(Number(value) || 45, 5, 85);

    positionTanks();
    updateHUD();
    drawAimGuide();
    saveMatch(true);
  }

  function aimFromPointer(event) {
    if (!game.running || game.paused || game.busy) {
      return;
    }

    const field = $("battlefield");
    if (!field) return;

    const rect = field.getBoundingClientRect();

    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    const muzzle = getMuzzle(game.activePlayer);

    const direction =
      game.activePlayer === 0 ? 1 : -1;

    const dx = (px - muzzle.x) * direction;
    const dy = muzzle.y - py;

    if (dx < -8) return;

    const angle =
      Math.atan2(dy, Math.max(1, dx)) * 180 / Math.PI;

    setAngle(angle);
  }

  function moveTank(direction) {
    if (!game.running || game.paused || game.busy) {
      return;
    }

    const i = game.activePlayer;

    if (game.movementLeft[i] <= 0) {
      notice("No movement left this turn.");
      return;
    }

    const field = $("battlefield");
    if (!field) return;

    const tank = $(`tank${i + 1}`);
    const half = (tank?.offsetWidth || 72) / 2;

    const step = Math.min(
      18,
      game.movementLeft[i] * 0.35
    );

    const newX = clamp(
      game.x[i] + direction * step,
      half,
      field.clientWidth - half
    );

    const actual = Math.abs(newX - game.x[i]);

    if (actual < 1) {
      notice("The tank can't move farther that way.");
      return;
    }

    game.x[i] = newX;

    game.movementLeft[i] = Math.max(
      0,
      game.movementLeft[i] - actual * 0.75
    );

    playMoveSound();
    positionTanks();
    updateControls();
    drawAimGuide();
    saveMatch(true);
  }

  function showDamage(x, y, damage) {
    const layer = $("damage-layer");
    if (!layer) return;

    const el = document.createElement("div");

    el.className = "damage-number";
    el.textContent = `-${Math.round(damage)}`;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    layer.appendChild(el);

    window.setTimeout(() => el.remove(), 900);
  }

  function spawnMuzzleFlash(x, y) {
    const layer = $("effect-layer");
    if (!layer) return;

    const el = document.createElement("div");

    el.className = "muzzle-flash";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    layer.appendChild(el);

    window.setTimeout(() => el.remove(), 180);
  }

  function explode(x, y) {
    const layer = $("explosion-layer");

    if (layer) {
      const el = document.createElement("div");

      el.className = "explosion-effect";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;

      el.style.setProperty(
        "--effect-size",
        `${rand(58, 86)}px`
      );

      layer.appendChild(el);

      window.setTimeout(() => el.remove(), 700);
    }

    playExplosionSound();

    const field = $("battlefield");

    if (field) {
      field.classList.remove("screen-shake");
      void field.offsetWidth;
      field.classList.add("screen-shake");

      window.setTimeout(() => {
        field.classList.remove("screen-shake");
      }, 260);
    }

    const damageRadius = 112;
    const craterRadius = 92;

    for (let i = 0; i < 2; i++) {
      const tank = $(`tank${i + 1}`);

      const centerY =
        terrainYAt(game.x[i]) -
        ((tank?.offsetHeight || 40) * 0.55);

      const distance = Math.hypot(
        game.x[i] - x,
        centerY - y
      );

      if (distance <= damageRadius) {
        const baseDamage = Math.max(
          0,
          47 * (1 - distance / (damageRadius + 10))
        );

        const armor =
          game.players[i]?.tank?.armor || 1;

        const damage = Math.max(
          4,
          baseDamage / armor
        );

        game.health[i] = clamp(
          game.health[i] - damage,
          0,
          100
        );

        showDamage(
          game.x[i],
          centerY - 20,
          damage
        );
      }
    }

    // Make a crater where the shell lands.
    if (x >= 0 && x <= game.terrainWidth) {
      game.terrain = game.terrain.map((p) => {
        const distance = Math.abs(p.x - x);

        if (distance >= craterRadius) {
          return p;
        }

        const depth =
          35 * (1 - distance / craterRadius);

        return {
          x: p.x,
          y: clamp(
            p.y + depth,
            game.terrainHeight * 0.5,
            game.terrainHeight - 12
          )
        };
      });

      drawTerrain();
      positionTanks();
    }

    updateHUD();
    saveMatch(true);

    if (game.health.some((health) => health <= 0)) {
      finishMatch();
    } else {
      window.setTimeout(() => finishShot(), 350);
    }
       }  function launchProjectile(token) {
    if (
      token !== game.matchToken ||
      !game.running ||
      game.paused
    ) {
      return;
    }

    const i = game.activePlayer;
    const muzzle = getMuzzle(i);
    const direction = i === 0 ? 1 : -1;

    const radians =
      game.angle[i] * Math.PI / 180;

    const speed =
      game.power *
      3.15 *
      (game.players[i]?.tank?.power || 1);

    let x = muzzle.x;
    let y = muzzle.y;

    const vx =
      Math.cos(radians) * speed * direction;

    let vy = -Math.sin(radians) * speed;

    const layer = $("projectile-layer");
    const projectile = document.createElement("div");

    projectile.className = "shell-projectile";

    if (layer) {
      layer.appendChild(projectile);
    }

    let previous = performance.now();

    function frame(now) {
      if (
        token !== game.matchToken ||
        !game.running
      ) {
        projectile.remove();
        return;
      }

      if (game.paused) {
        previous = now;
        requestAnimationFrame(frame);
        return;
      }

      const dt = Math.min(
        0.035,
        Math.max(0.001, (now - previous) / 1000)
      );

      previous = now;

      x += vx * dt;
      y += vy * dt;
      vy += 360 * dt;

      projectile.style.left = `${x}px`;
      projectile.style.top = `${y}px`;

      const w = game.terrainWidth;
      const h = game.terrainHeight;

      if (
        x < -8 ||
        x > w + 8 ||
        y > h + 20 ||
        y < -80
      ) {
        projectile.remove();
        finishShot();
        return;
      }

      const target = 1 - i;
      const targetElement = $(`tank${target + 1}`);

      const targetY =
        terrainYAt(game.x[target]) -
        ((targetElement?.offsetHeight || 40) * 0.55);

      if (
        Math.hypot(
          x - game.x[target],
          y - targetY
        ) < 27
      ) {
        projectile.remove();
        explode(x, y);
        return;
      }

      if (y >= terrainYAt(x)) {
        projectile.remove();
        explode(x, y);
        return;
      }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function fireShell() {
    if (
      !game.running ||
      game.paused ||
      game.busy
    ) {
      return;
    }

    ensureAudio();

    game.busy = true;
    updateControls();

    const token = game.matchToken;
    const muzzle = getMuzzle(game.activePlayer);

    spawnMuzzleFlash(muzzle.x, muzzle.y);
    playShotSound();

    launchProjectile(token);
    saveMatch(true);
  }

  function finishShot() {
    if (
      !game.running ||
      game.paused
    ) {
      return;
    }

    game.busy = false;
    game.activePlayer = 1 - game.activePlayer;

    if (game.activePlayer === 0) {
      game.round++;
    }

    game.movementLeft[game.activePlayer] = 100;

    updateControls();
    positionTanks();
    drawAimGuide();
    saveMatch(true);

    notice(
      `${game.players[game.activePlayer]?.name || "Player"}'s turn`
    );
  }

  function finishMatch() {
    game.running = false;
    game.busy = false;
    game.paused = false;
    game.matchToken++;

    const player1Alive = game.health[0] > 0;
    const player2Alive = game.health[1] > 0;

    const draw = player1Alive === player2Alive;

    const winner = player1Alive
      ? game.players[0]
      : game.players[1];

    setText(
      "victory-title",
      draw ? "DRAW" : "VICTORY"
    );

    setText(
      "winner-name",
      draw
        ? "Both tanks destroyed"
        : winner?.name || "Winner"
    );

    setText(
      "victory-subtitle",
      draw
        ? "A close battle. Fight again!"
        : "The battlefield belongs to you."
    );

    clearSavedMatch();
    hideOverlay("pause-overlay");

    showScreen("victory-screen");
  }

  function hideOverlay(id) {
    const el = $(id);
    if (!el) return;

    el.classList.remove("active");
    el.classList.add("hidden");
  }

  function showOverlay(id) {
    const el = $(id);
    if (!el) return;

    el.classList.remove("hidden");
    el.classList.add("active");
  }

  function pauseMatch() {
    if (
      !game.running ||
      game.paused ||
      game.busy
    ) {
      if (game.busy) {
        notice("Wait for the shell to land before pausing.");
      }

      return;
    }

    game.paused = true;

    showOverlay("pause-overlay");
    updateControls();
  }

  function resumeMatch() {
    game.paused = false;

    hideOverlay("pause-overlay");

    updateControls();
    drawAimGuide();
  }

  function askConfirm(title, message, action) {
    setText("confirm-title", title);
    setText("confirm-message", message);

    game.confirmAction = action;

    showOverlay("confirm-overlay");
  }

  function leaveMatch() {
    game.matchToken++;

    game.running = false;
    game.paused = false;
    game.busy = false;

    hideOverlay("pause-overlay");
    hideOverlay("confirm-overlay");

    clearSavedMatch();

    showScreen("main-menu");
  }

  function restartMatch() {
    game.matchToken++;

    game.running = false;
    game.busy = false;
    game.paused = false;

    hideOverlay("pause-overlay");
    hideOverlay("confirm-overlay");

    clearSavedMatch();

    startMatch();
  }

  function openSettings() {
    game.settingsReturnScreen = game.screen;

    showScreen("settings-screen");

    const volume = $("master-volume");

    if (volume) {
      volume.value = String(
        Math.round(game.settings.volume * 100)
      );
    }

    setText(
      "volume-value",
      `${Math.round(game.settings.volume * 100)}%`
    );

    if ($("music-toggle")) {
      $("music-toggle").checked = game.settings.music;
    }

    if ($("effects-toggle")) {
      $("effects-toggle").checked = game.settings.effects;
    }
  }

  function closeSettings() {
    showScreen(
      game.settingsReturnScreen || "main-menu"
    );

    if (game.screen === "battle-screen") {
      updateControls();
      drawAimGuide();
    }
  }

  function startMusic() {
    stopMusic();

    if (
      !game.settings.music ||
      game.settings.volume <= 0
    ) {
      return;
    }

    const ctx = ensureAudio();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 55;

    gain.gain.value =
      0.018 * game.settings.volume;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();

    ambientTimer = {
      oscillator,
      gain
    };
  }

  function stopMusic() {
    if (
      ambientTimer &&
      ambientTimer.oscillator &&
      game.audioContext
    ) {
      try {
        ambientTimer.gain.gain.setTargetAtTime(
          0.0001,
          game.audioContext.currentTime,
          0.05
        );

        ambientTimer.oscillator.stop(
          game.audioContext.currentTime + 0.25
        );
      } catch (_) {}
    }

    ambientTimer = null;
  }

  function updateTankPreviews() {
    const tank1 = TANKS[game.selectedTanks[0]];
    const tank2 = TANKS[game.selectedTanks[1]];

    setText("tank1-name", tank1.name);
    setText("tank2-name", tank2.name);

    setText("tank1-description", tank1.description);
    setText("tank2-description", tank2.description);

    const previews = [
      $("tank1-preview"),
      $("tank2-preview")
    ];

    previews.forEach((preview, i) => {
      if (!preview) return;

      preview.dataset.tank =
        TANKS[game.selectedTanks[i]].name.toLowerCase();

      const hull = preview.querySelector(".preview-hull");
      const turret = preview.querySelector(".preview-turret");

      if (hull) {
        hull.style.filter =
          `brightness(${i === 0 ? 1.05 : 0.9})`;
      }

      if (turret) {
        turret.style.transform = "rotate(-8deg)";
      }
    });
  }

  function cycleTank(player, direction) {
    game.selectedTanks[player] =
      (
        game.selectedTanks[player] +
        direction +
        TANKS.length
      ) % TANKS.length;

    updateTankPreviews();
  }

  function bindEvents() {
    $("play-btn")?.addEventListener("click", () => {
      ensureAudio();
      showScreen("mode-screen");
    });

    $("resume-match-btn")?.addEventListener(
      "click",
      resumeSavedMatch
    );

    $("settings-btn")?.addEventListener(
      "click",
      openSettings
    );

    $("how-to-btn")?.addEventListener("click", () => {
      showScreen("how-to-screen");
    });

    document.querySelectorAll(".back-to-menu-btn")
      .forEach((button) => {
        button.addEventListener("click", () => {
          showScreen("main-menu");
        });
      });

    $("local-match-btn")?.addEventListener("click", () => {
      game.mode = "local";
      updateTankPreviews();
      showScreen("setup-screen");
    });

    $("online-match-btn")?.addEventListener("click", () => {
      game.mode = "online";
      showScreen("online-screen");
    });

    $("online-back-btn")?.addEventListener("click", () => {
      showScreen("mode-screen");
    });

    $("setup-back-btn")?.addEventListener("click", () => {
      showScreen("mode-screen");
    });

    $("tank1-prev")?.addEventListener("click", () => {
      cycleTank(0, -1);
    });

    $("tank1-next")?.addEventListener("click", () => {
      cycleTank(0, 1);
    });

    $("tank2-prev")?.addEventListener("click", () => {
      cycleTank(1, -1);
    });

    $("tank2-next")?.addEventListener("click", () => {
      cycleTank(1, 1);
    });

    $("start-battle-btn")?.addEventListener(
      "click",
      startMatch
    );

    $("how-to-back-btn")?.addEventListener("click", () => {
      showScreen("main-menu");
    });

    $("pause-btn")?.addEventListener(
      "click",
      pauseMatch
    );

    $("resume-btn")?.addEventListener(
      "click",
      resumeMatch
    );

    $("pause-settings-btn")?.addEventListener(
      "click",
      openSettings
    );

    $("restart-btn")?.addEventListener("click", () => {
      askConfirm(
        "RESTART MATCH?",
        "Your current battle progress will be lost.",
        restartMatch
      );
    });

    $("leave-match-btn")?.addEventListener("click", () => {
      askConfirm(
        "LEAVE MATCH?",
        "Leaving will discard this saved battle.",
        leaveMatch
      );
    });

    $("confirm-yes-btn")?.addEventListener("click", () => {
      const action = game.confirmAction;

      game.confirmAction = null;

      hideOverlay("confirm-overlay");

      if (typeof action === "function") {
        action();
      }
    });

    $("confirm-cancel-btn")?.addEventListener("click", () => {
      game.confirmAction = null;
      hideOverlay("confirm-overlay");
    });

    $("rematch-btn")?.addEventListener(
      "click",
      startMatch
    );

    $("main-menu-btn")?.addEventListener("click", () => {
      showScreen("main-menu");
    });

    $("settings-back-btn")?.addEventListener(
      "click",
      closeSettings
    );

    $("master-volume")?.addEventListener("input", (event) => {
      game.settings.volume = clamp(
        Number(event.target.value) / 100,
        0,
        1
      );

      setText(
        "volume-value",
        `${Math.round(game.settings.volume * 100)}%`
      );

      if (game.settings.music) {
        startMusic();
      }

      try {
        localStorage.setItem(
          "tankWarSettingsV1",
          JSON.stringify(game.settings)
        );
      } catch (_) {}
    });

    $("music-toggle")?.addEventListener("change", (event) => {
      game.settings.music = !!event.target.checked;

      if (game.settings.music) {
        startMusic();
      } else {
        stopMusic();
      }

      try {
        localStorage.setItem(
          "tankWarSettingsV1",
          JSON.stringify(game.settings)
        );
      } catch (_) {}
    });

    $("effects-toggle")?.addEventListener("change", (event) => {
      game.settings.effects = !!event.target.checked;

      try {
        localStorage.setItem(
          "tankWarSettingsV1",
          JSON.stringify(game.settings)
        );
      } catch (_) {}
    });

    $("power-slider")?.addEventListener("input", (event) => {
      game.power = clamp(
        Number(event.target.value) || 65,
        20,
        100
      );

      updateHUD();
      drawAimGuide();
    });

    $("move-left-btn")?.addEventListener("click", () => {
      moveTank(-1);
    });

    $("move-right-btn")?.addEventListener("click", () => {
      moveTank(1);
    });

    $("fire-btn")?.addEventListener(
      "click",
      fireShell
    );

    const field = $("battlefield");

    if (field) {
      let pointerDown = false;

      field.addEventListener("pointerdown", (event) => {
        if (
          event.target.closest(
            "button, input, .battle-controls, .battle-hud"
          )
        ) {
          return;
        }

        pointerDown = true;

        if (field.setPointerCapture) {
          try {
            field.setPointerCapture(event.pointerId);
          } catch (_) {}
        }

        aimFromPointer(event);
      });

      field.addEventListener("pointermove", (event) => {
        if (pointerDown) {
          aimFromPointer(event);
        }
      });

      field.addEventListener("pointerup", () => {
        pointerDown = false;
      });

      field.addEventListener("pointercancel", () => {
        pointerDown = false;
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (
          game.screen === "battle-screen" &&
          !game.paused
        ) {
          pauseMatch();
        } else if (game.paused) {
          resumeMatch();
        }
      }

      if (
        game.screen === "battle-screen" &&
        !game.paused
      ) {
        if (event.key === "ArrowLeft") {
          moveTank(-1);
        }

        if (event.key === "ArrowRight") {
          moveTank(1);
        }

        if (
          event.key === " " ||
          event.key === "Enter"
        ) {
          event.preventDefault();
          fireShell();
        }

        if (event.key === "ArrowUp") {
          setAngle(
            game.angle[game.activePlayer] + 2
          );
        }

        if (event.key === "ArrowDown") {
          setAngle(
            game.angle[game.activePlayer] - 2
          );
        }
      }
    });

    window.addEventListener("resize", () => {
      if (game.screen === "battle-screen") {
        resizeBattlefield();
      }
    });

    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          document.hidden &&
          game.running &&
          !game.paused &&
          !game.busy
        ) {
          pauseMatch();
        }
      }
    );
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(
        localStorage.getItem("tankWarSettingsV1") || "null"
      );

      if (saved) {
        game.settings.volume = clamp(
          Number(saved.volume ?? 0.45),
          0,
          1
        );

        game.settings.music = !!saved.music;
        game.settings.effects = saved.effects !== false;
      }
    } catch (_) {}
  }

  function init() {
    loadSettings();
    bindEvents();
    updateTankPreviews();
    updateSaveButton();

    const volume = $("master-volume");

    if (volume) {
      volume.value = String(
        Math.round(game.settings.volume * 100)
      );
    }

    setText(
      "volume-value",
      `${Math.round(game.settings.volume * 100)}%`
    );

    if ($("music-toggle")) {
      $("music-toggle").checked = game.settings.music;
    }

    if ($("effects-toggle")) {
      $("effects-toggle").checked = game.settings.effects;
    }

    showScreen("main-menu");

    if (
      window.ResizeObserver &&
      $("battlefield")
    ) {
      resizeObserver = new ResizeObserver(() => {
        if (game.screen === "battle-screen") {
          resizeBattlefield();
        }
      });

      resizeObserver.observe($("battlefield"));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
