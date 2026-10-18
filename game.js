(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const SAVE_KEY = "tankWarLocalSaveV21";
  const SETTINGS_KEY = "tankWarSettingsV21";

  const RULES = {
    health: 100,
    movesPerTurn: 3,
    moveDistance: 22,
    minAngle: 5,
    maxAngle: 85,
    minPower: 20,
    maxPower: 100,
    gravity: 480,
    blastRadius: 80,
    maxDamage: 32,
    minDamage: 5
  };

  const TANK_IMAGES = {
    tank1: "tank1.png",
    tank2: "tank2.png",
    tank3: "tank3.png",
    tank4: "tank4.png",
    tank5: "tank5.png",
    tank6: "tank6.png"
  };

  const MUZZLE_IMAGES = {
    tank1: "muzzle1.png",
    tank2: "muzzle2.png",
    tank3: "muzzle3.png",
    tank4: "muzzle4.png",
    tank5: "muzzle5.png",
    tank6: "muzzle6.png"
  };

  const MUSIC_FILE = "background-music.mp3";

  const E = {
    rotate: $("rotate-screen"),
    menu: $("main-menu"),
    mode: $("mode-screen"),
    setup: $("setup-screen"),
    online: $("online-screen"),
    vs: $("vs-screen"),
    battle: $("battle-screen"),
    result: $("result-screen"),
    settings: $("settings-screen"),
    field: $("battlefield"),
    world: $("world-container"),
    terrainCanvas: $("terrain-canvas"),
    aimCanvas: $("aim-canvas"),
    tanks: [$("tank1"), $("tank2")],
    tankImages: [$("tank1-image"), $("tank2-image")],
    nameplates: [$("tank1-nameplate"), $("tank2-nameplate")],
    crate: $("supply-crate"),
    projectileLayer: $("projectile-layer"),
    effectLayer: $("effect-layer"),
    names: [$("player1-name"), $("player2-name")],
    tankChoices: [$("player1-tank"), $("player2-tank")],
    previews: [$("player1-preview"), $("player2-preview")],
    vsNames: [$("vs-player1-name"), $("vs-player2-name")],
    vsImages: [$("vs-tank1-image"), $("vs-tank2-image")],
    hudNames: [$("hud-name1"), $("hud-name2")],
    hpTexts: [$("hud-health1-text"), $("hud-health2-text")],
    hpFills: [$("health1-fill"), $("health2-fill")],
    weaponTexts: [$("p1-weapon"), $("p2-weapon")],
    turn: $("turn-indicator"),
    round: $("round-number"),
    steps: $("movement-time"),
    angle: $("angle-value"),
    power: $("shot-power"),
    powerText: $("power-value"),
    left: $("move-left-btn"),
    right: $("move-right-btn"),
    fire: $("fire-btn"),
    pauseOverlay: $("battle-menu-overlay"),
    winner: $("winner-name"),
    resultTankImage: $("result-tank-image"),
    resultHpNames: [$("result-health1-name"), $("result-health2-name")],
    resultHps: [$("result-health1"), $("result-health2")],
    effects: $("effects-toggle"),
    music: $("music-toggle"),
    volume: $("volume-slider"),
    volumeText: $("volume-value")
  };

  const terrainCtx = E.terrainCanvas?.getContext("2d");
  const aimCtx = E.aimCanvas?.getContext("2d");

  const G = {
    running: false,
    paused: false,
    busy: false,
    active: 0,
    round: 1,
    wind: 0,
    health: [RULES.health, RULES.health],
    angle: [45, 45],
    power: 60,
    steps: [RULES.movesPerTurn, RULES.movesPerTurn],
    x: [0, 0],
    weapons: ["standard", "standard"],
    inventory: ["none", "none"],
    crateActive: false,
    cratePos: { x: 0, y: 0 },
    terrain: [],
    players: [
      { name: "Player 1", tank: "tank1" },
      { name: "Player 2", tank: "tank2" }
    ],
    dragging: false,
    pointerId: null,
    matchToken: 0,
    moveInterval: null,
    settings: { effects: true, music: true, volume: 50 },
    audio: null,
    musicAudio: null
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const other = player => player === 0 ? 1 : 0;
  const tankSrc = player => TANK_IMAGES[G.players[player].tank] || TANK_IMAGES.tank1;
  const muzzleSrc = player => MUZZLE_IMAGES[G.players[player].tank] || MUZZLE_IMAGES.tank1;
  const playerName = player => G.players[player]?.name || `Player ${player + 1}`;
  const isBattleActive = () => !!E.battle?.classList.contains("active");

  const canControl = () =>
    G.running && !G.paused && !G.busy && G.health[G.active] > 0;

  const size = () => ({
    width: 1800,
    height: E.field?.clientHeight || window.innerHeight || 500,
    viewWidth: E.field?.clientWidth || window.innerWidth || 800
  });

  function triggerFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    }
  }

  function buttonSound() {
    if (!G.settings.effects || G.settings.volume <= 0) return;
    try {
      if (!G.audio) G.audio = new Audio("button-sound.mp3");
      G.audio.volume = clamp(G.settings.volume / 100, 0, 1);
      G.audio.currentTime = 0;
      G.audio.play().catch(() => {});
    } catch (_) {}
  }

  function updateAudioVolume() {
    const volume = clamp((Number(G.settings.volume) || 0) / 100, 0, 1);
    if (G.audio) G.audio.volume = volume;
    if (G.musicAudio) G.musicAudio.volume = volume;
  }

  function startMusic() {
    try {
      if (!G.musicAudio) {
        G.musicAudio = new Audio(MUSIC_FILE);
        G.musicAudio.loop = true;
      }
      updateAudioVolume();
      G.musicAudio.play().catch(() => {});
    } catch (_) {}
  }

  function stopMusic() {
    if (!G.musicAudio) return;
    G.musicAudio.pause();
    G.musicAudio.currentTime = 0;
  }

  function showScreen(target) {
    stopMatch();
    const screens = [E.menu, E.mode, E.setup, E.online, E.vs, E.battle, E.result, E.settings];
    screens.forEach(screen => screen?.classList.remove("active"));
    const screen = typeof target === "string" ? $(target) : target;
    screen?.classList.add("active");

    requestAnimationFrame(() => {
      if (isBattleActive()) {
        resizeCanvases();
        generateTerrain();
        drawTerrain();
        positionTanks();
        drawAim();
      }
    });
  }

  function stopMatch() {
    G.matchToken++;
    G.running = false;
    G.paused = false;
    G.busy = false;
    G.dragging = false;
    clearInterval(G.moveInterval);
    E.pauseOverlay?.classList.add("hidden");
    E.crate?.classList.add("hidden");
    removeCrateMenu();
    if (E.projectileLayer) E.projectileLayer.replaceChildren();
    if (E.effectLayer) E.effectLayer.replaceChildren();
  }

  function goMenu() {
    stopMatch();
    showScreen(E.menu);
  }

  function selectedTank(player) {
    const value = E.tankChoices[player]?.value;
    return TANK_IMAGES[value] ? value : (player === 0 ? "tank1" : "tank2");
  }

  function readPlayerName(player) {
    const name = E.names[player]?.value?.trim();
    return (name || `Player ${player + 1}`).slice(0, 15);
  }

  function updatePlayerVisuals() {
    for (let p = 0; p < 2; p++) {
      const src = tankSrc(p);
      if (E.previews[p]) {
        E.previews[p].src = src;
        E.previews[p].onerror = () => { E.previews[p].src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='40'><rect width='60' height='40' fill='%2345b8ff'/></svg>"; };
      }
      if (E.vsImages[p]) {
        E.vsImages[p].src = src;
        E.vsImages[p].onerror = () => { E.vsImages[p].src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='40'><rect width='60' height='40' fill='%2345b8ff'/></svg>"; };
      }
      if (E.tankImages[p]) {
        E.tankImages[p].src = src;
        E.tankImages[p].style.transform = p === 1 ? "scaleX(-1)" : "scaleX(1)";
        E.tankImages[p].onerror = () => { E.tankImages[p].src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='40'><rect width='60' height='40' fill='%2345b8ff'/></svg>"; };
      }
      if (E.resultTankImage) {
        E.resultTankImage.onerror = () => { E.resultTankImage.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='40'><rect width='60' height='40' fill='%2345b8ff'/></svg>"; };
      }
      if (E.vsNames[p]) E.vsNames[p].textContent = playerName(p);
      if (E.hudNames[p]) E.hudNames[p].textContent = playerName(p);
      if (E.nameplates[p]) E.nameplates[p].textContent = playerName(p);
    }
  }

  function prepareMatch() {
    stopMatch();
    G.active = 0;
    G.round = 1;
    G.wind = Math.round((Math.random() * 50) - 25);
    G.health = [RULES.health, RULES.health];
    G.angle = [45, 45];
    G.power = 60;
    G.steps = [RULES.movesPerTurn, RULES.movesPerTurn];
    G.weapons = ["standard", "standard"];
    G.inventory = ["none", "none"];
    G.players = [
      { name: readPlayerName(0), tank: selectedTank(0) },
      { name: readPlayerName(1), tank: selectedTank(1) }
    ];
    updatePlayerVisuals();
    updateHUD();
    showScreen(E.vs);
  }

  function resizeCanvases() {
    if (!E.field || !terrainCtx || !aimCtx) return;
    const { width, height } = size();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const canvas of [E.terrainCanvas, E.aimCanvas]) {
      if (!canvas) continue;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    terrainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    aimCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function generateTerrain() {
    const { width, height } = size();
    if (!width || !height) return;
    G.terrain = [];
    const step = 4;
    for (let x = 0; x <= width; x += step) {
      const t = x / width;
      const y = clamp(
        height * .72 + Math.sin(t * Math.PI * 3.5) * height * .08,
        height * .48, height * .82
      );
      G.terrain.push({ x, y });
    }
  }

  function groundAt(x) {
    if (!G.terrain.length) return size().height * .7;
    const last = G.terrain[G.terrain.length - 1];
    x = clamp(x, 0, last.x);
    const index = Math.min(G.terrain.length - 2, Math.floor(x / 4));
    const a = G.terrain[index];
    const b = G.terrain[index + 1];
    if (!a || !b) return last.y;
    const t = (x - a.x) / Math.max(1, b.x - a.x);
    return a.y + (b.y - a.y) * t;
  }

  function drawTerrain() {
    if (!terrainCtx || !G.terrain.length) return;
    const { width, height } = size();
    terrainCtx.clearRect(0, 0, width, height);
    terrainCtx.beginPath();
    terrainCtx.moveTo(0, G.terrain[0].y);
    for (const point of G.terrain) terrainCtx.lineTo(point.x, point.y);
    terrainCtx.lineTo(width, height);
    terrainCtx.lineTo(0, height);
    terrainCtx.closePath();

    const gradient = terrainCtx.createLinearGradient(0, height * .5, 0, height);
    gradient.addColorStop(0, "#786044");
    gradient.addColorStop(1, "#45342b");
    terrainCtx.fillStyle = gradient;
    terrainCtx.fill();

    terrainCtx.beginPath();
    G.terrain.forEach((point, i) => {
      if (i === 0) terrainCtx.moveTo(point.x, point.y);
      else terrainCtx.lineTo(point.x, point.y);
    });
    terrainCtx.strokeStyle = "#9fce62";
    terrainCtx.lineWidth = 4;
    terrainCtx.stroke();
  }

  function positionTanks() {
    const { width } = size();
    if (!width) return;
    G.x[0] = clamp(G.x[0], 60, width * .45);
    G.x[1] = clamp(G.x[1], width * .55, width - 60);
    for (let p = 0; p < 2; p++) {
      const tank = E.tanks[p];
      if (!tank) continue;
      const y = groundAt(G.x[p]);
      tank.style.left = `${G.x[p]}px`;
      tank.style.top = `${y - 14}px`;
      
      if (E.tankImages[p]) {
        E.tankImages[p].style.transform = p === 1 ? "scaleX(-1)" : "scaleX(1)";
      }
    }
    updateCamera();
  }

  function updateCamera() {
    if (!E.world || !E.field) return;
    const viewWidth = E.field.clientWidth || window.innerWidth;
    const centerX = (G.x[0] + G.x[1]) / 2;
    let offsetX = viewWidth / 2 - centerX;
    offsetX = clamp(offsetX, -(1800 - viewWidth), 0);
    E.world.style.transform = `translateX(${offsetX}px)`;
  }

  function spawnCrate() {
    const { width } = size();
    if (!width || !E.crate) return;
    G.cratePos.x = width * (.3 + Math.random() * .4);
    G.cratePos.y = groundAt(G.cratePos.x) - 70;
    G.crateActive = true;

    E.crate.style.left = `${G.cratePos.x}px`;
    E.crate.style.top = `${G.cratePos.y}px`;
    E.crate.classList.remove("hidden");
  }

  function startMatch() {
    stopMatch();
    showScreen(E.battle);
    requestAnimationFrame(() => {
      if (!isBattleActive()) return;
      resizeCanvases();
      const { width } = size();
      G.x = [width * .3, width * .7];
      generateTerrain();
      drawTerrain();
      positionTanks();
      
      G.running = true;
      G.angle = [45, 45];
      G.power = 60;
      G.busy = false;
      updateCamera();
      updateHUD();
      drawAim();
      spawnCrate();
    });
  }

  function getVector(player) {
    const direction = player === 0 ? 1 : -1;
    const rad = G.angle[player] * Math.PI / 180;
    return { x: Math.cos(rad) * direction, y: -Math.sin(rad) };
  }

  function muzzle(player) {
    const v = getVector(player);
    return {
      x: G.x[player] + v.x * 24,
      y: groundAt(G.x[player]) - 14 + v.y * 24
    };
  }

  function drawAim() {
    if (!aimCtx || !E.field) return;
    const { width, height } = size();
    aimCtx.clearRect(0, 0, width, height);
    if (!G.running || G.paused || G.busy) return;

    const start = muzzle(G.active);
    const vector = getVector(G.active);
    const lineLength = 70 + (G.power * 0.6);

    aimCtx.save();
    aimCtx.setLineDash([4, 6]);
    aimCtx.beginPath();
    aimCtx.moveTo(start.x, start.y);
    aimCtx.lineTo(start.x + vector.x * lineLength, start.y + vector.y * lineLength);
    aimCtx.strokeStyle = G.active === 0 ? "#7dc7ff" : "#ff9b9b";
    aimCtx.lineWidth = 3;
    aimCtx.stroke();
    aimCtx.restore();
  }

  function updateHUD() {
    const windDirection = G.wind >= 0 ? "➔" : "⬅";
    if (E.turn) E.turn.textContent = `${playerName(G.active)}'s Turn | 💨 ${windDirection} ${Math.abs(G.wind)}`;
    if (E.round) E.round.textContent = String(G.round);
    if (E.angle) E.angle.textContent = `${Math.round(G.angle[G.active])}°`;
    if (E.power) E.power.value = String(G.power);
    if (E.powerText) E.powerText.textContent = `${Math.round(G.power)}%`;

    for (let p = 0; p < 2; p++) {
      if (E.hudNames[p]) E.hudNames[p].textContent = playerName(p);
      if (E.hpTexts[p]) E.hpTexts[p].textContent = `${Math.max(0, Math.round(G.health[p]))} HP`;
      if (E.hpFills[p]) E.hpFills[p].style.width = `${clamp(G.health[p], 0, 100)}%`;
      if (E.weaponTexts[p]) {
        const w = G.weapons[p];
        const inv = G.inventory[p] !== "none" ? ` (Stored: ${G.inventory[p]})` : "";
        E.weaponTexts[p].textContent = (w === "cluster" ? "Ammo: 💥 Cluster" : w === "heavy" ? "Ammo: 💣 Heavy" : "Ammo: Standard") + inv;
      }
    }

    if (E.steps) E.steps.textContent = `${G.steps[G.active]}/3`;

    const enabled = canControl();
    if (E.left) E.left.disabled = !enabled || G.steps[G.active] <= 0;
    if (E.right) E.right.disabled = !enabled || G.steps[G.active] <= 0;
    if (E.fire) E.fire.disabled = !enabled;
  }

  function moveTank(direction) {
    if (!canControl() || G.steps[G.active] <= 0) return;
    const p = G.active;
    const { width } = size();
    const min = p === 0 ? 60 : width * .52;
    const max = p === 0 ? width * .48 : width - 60;
    const next = clamp(G.x[p] + direction * RULES.moveDistance, min, max);
    if (Math.abs(next - G.x[p]) < 1) return;
    G.x[p] = next;
    G.steps[p]--;
    positionTanks();
    updateCamera();
    drawAim();
    updateHUD();
  }

  function startHoldMove(dir) {
    moveTank(dir);
    clearInterval(G.moveInterval);
    G.moveInterval = setInterval(() => {
      if (G.steps[G.active] > 0) moveTank(dir);
      else clearInterval(G.moveInterval);
    }, 250);
  }

  function stopHoldMove() {
    clearInterval(G.moveInterval);
  }

  function setAngleFromPoint(point) {
    if (!canControl()) return;
    const start = muzzle(G.active);
    const dx = point.x - start.x;
    const dy = start.y - point.y;
    
    if (G.active === 0 && dx < -5) return;
    if (G.active === 1 && dx > 5) return;

    const angleRad = Math.atan2(dy, Math.abs(dx));
    G.angle[G.active] = clamp(angleRad * 180 / Math.PI, RULES.minAngle, RULES.maxAngle);
    if (E.angle) E.angle.textContent = `${Math.round(G.angle[G.active])}°`;
    drawAim();
  }

  function removeCrateMenu() {
    const existing = $("crate-choice-menu");
    if (existing) existing.remove();
  }

  function showCrateChoiceMenu(player) {
    removeCrateMenu();
    G.busy = true;

    const menu = document.createElement("div");
    menu.id = "crate-choice-menu";
    Object.assign(menu.style, {
      position: "absolute", bottom: "75px", left: "50%", transform: "translateX(-50%)",
      zIndex: "999", background: "rgba(18, 28, 38, 0.95)", border: "1px solid #354b5d",
      borderRadius: "10px", padding: "8px 12px", display: "flex", gap: "6px", alignItems: "center",
      boxShadow: "0 8px 25px rgba(0,0,0,0.6)"
    });

    const title = document.createElement("div");
    title.textContent = "🎁 SUPPLY DROP CHOOSE:";
    Object.assign(title.style, { fontSize: "0.6rem", fontWeight: "900", color: "#ffce68", marginRight: "4px" });
    menu.appendChild(title);

    const options = [
      { id: "standard", label: "Standard (Keep)" },
      { id: "cluster", label: "💥 Cluster" },
      { id: "heavy", label: "💣 Heavy" },
      { id: "armor", label: "🛡️ +25 Armor" }
    ];

    options.forEach(opt => {
      const btn = document.createElement("button");
      btn.textContent = opt.label;
      Object.assign(btn.style, {
        background: "#1c2b38", border: "1px solid #354b5d", color: "#fff",
        padding: "6px 10px", borderRadius: "6px", fontSize: "0.65rem", fontWeight: "800", cursor: "pointer"
      });
      btn.addEventListener("click", () => {
        buttonSound();
        if (opt.id === "armor") {
          G.health[player] = clamp(G.health[player] + 25, 0, 125);
        } else if (opt.id !== "standard") {
          G.weapons[player] = opt.id;
          G.inventory[player] = opt.id;
        }
        removeCrateMenu();
        G.busy = false;
        updateHUD();
        endTurn();
      });
      menu.appendChild(btn);
    });

    E.battle?.appendChild(menu);
  }

  function fireShot() {
    if (!canControl()) return;
    G.busy = true;
    G.dragging = false;
    updateHUD();
    drawAim();

    const shooter = G.active;
    const start = muzzle(shooter);
    const vector = getVector(shooter);
    const speed = 190 + G.power * 3.4;
    const weaponType = G.weapons[shooter];

    const flash = document.createElement("img");
    flash.src = muzzleSrc(shooter);
    flash.onerror = () => { flash.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='10' fill='%23ffaa00'/></svg>"; };
    Object.assign(flash.style, {
      position: "absolute", left: `${start.x}px`, top: `${start.y}px`,
      width: "28px", height: "28px", transform: "translate(-50%, -50%) scale(1.4)",
      zIndex: "40", pointerEvents: "none", transition: "transform 0.15s ease-out, opacity 0.15s ease-out"
    });
    E.effectLayer?.appendChild(flash);
    setTimeout(() => {
      flash.style.transform = "translate(-50%, -50%) scale(0.2)";
      flash.style.opacity = "0";
      setTimeout(() => flash.remove(), 150);
    }, 60);

    let x = start.x;
    let y = start.y;
    let vx = vector.x * speed;
    let vy = vector.y * speed;
    let previous = performance.now();
    const token = G.matchToken;

    const shell = document.createElement("div");
    Object.assign(shell.style, {
      position: "absolute", left: `${x}px`, top: `${y}px`, width: "10px", height: "10px",
      borderRadius: "50%", background: weaponType === "heavy" ? "#ff9130" : weaponType === "cluster" ? "#ffd700" : (shooter === 0 ? "#8ed5ff" : "#ff8b72"),
      boxShadow: "0 0 12px rgba(255,190,90,.9)", transform: "translate(-50%, -50%)"
    });
    E.projectileLayer?.appendChild(shell);

    function frame(now) {
      if (token !== G.matchToken || !G.running) {
        shell.remove();
        return;
      }
      if (G.paused) {
        previous = now;
        requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min((now - previous) / 1000, .035);
      previous = now;

      vx += G.wind * 1.5 * dt;
      vy += RULES.gravity * dt;
      x += vx * dt;
      y += vy * dt;
      shell.style.left = `${x}px`;
      shell.style.top = `${y}px`;

      if (G.crateActive && Math.hypot(x - G.cratePos.x, y - G.cratePos.y) < 24) {
        shell.remove();
        G.crateActive = false;
        E.crate?.classList.add("hidden");
        showCrateChoiceMenu(shooter);
        return;
      }

      const { width, height } = size();
      const target = other(shooter);
      const targetPoint = { x: G.x[target], y: groundAt(G.x[target]) - 14 };

      if (Math.hypot(x - targetPoint.x, y - targetPoint.y) < 22) {
        shell.remove();
        explode(x, y, target, shooter, weaponType, token);
        return;
      }

      const ground = groundAt(x);
      if (x < 0 || x > width || y >= ground || y > height) {
        shell.remove();
        explode(clamp(x, 0, width), Math.min(y, ground), target, shooter, weaponType, token);
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function explode(x, y, target, shooter, weaponType, token) {
    if (token !== G.matchToken || !G.running) return;

    const blastRadius = weaponType === "heavy" ? RULES.blastRadius * 1.3 : RULES.blastRadius;
    const maxDmg = weaponType === "heavy" ? RULES.maxDamage * 1.6 : RULES.maxDamage;

    carveTerrain(x, blastRadius * 0.75);

    const blast = document.createElement("div");
    Object.assign(blast.style, {
      position: "absolute", left: `${x}px`, top: `${y}px`,
      width: `${blastRadius * 2}px`, height: `${blastRadius * 2}px`,
      borderRadius: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none",
      background: weaponType === "heavy" ? "radial-gradient(circle, rgba(255,200,100,.95) 0%, rgba(255,80,20,.8) 40%, transparent 70%)" : "radial-gradient(circle, rgba(255,245,170,.95) 0%, rgba(255,145,48,.8) 30%, transparent 65%)"
    });
    E.effectLayer?.appendChild(blast);

    const targetY = groundAt(G.x[target]) - 14;
    const distance = Math.hypot(x - G.x[target], y - targetY);

    if (distance <= blastRadius) {
      const damage = Math.max(RULES.minDamage, Math.round(maxDmg * (1 - distance / blastRadius)));
      G.health[target] = Math.max(0, G.health[target] - damage);
    }

    if (weaponType === "cluster") {
      setTimeout(() => {
        for (let i = -1; i <= 1; i++) {
          const cx = x + i * 30;
          carveTerrain(cx, blastRadius * 0.45);
          const subDist = Math.hypot(cx - G.x[target], groundAt(cx) - 14 - targetY);
          if (subDist <= RULES.blastRadius) {
            G.health[target] = Math.max(0, G.health[target] - 10);
          }
        }
        drawTerrain();
        positionTanks();
        updateHUD();
      }, 200);
    }

    drawTerrain();
    positionTanks();
    G.weapons[shooter] = "standard";
    updateHUD();

    setTimeout(() => blast.remove(), 400);
    setTimeout(() => {
      if (token !== G.matchToken || !G.running) return;
      if (G.health[target] <= 0) {
        playDefeatAnimation(target, shooter);
      } else {
        endTurn();
      }
    }, 400);
  }

  function carveTerrain(cx, radius) {
    G.terrain.forEach(pt => {
      const dist = Math.abs(pt.x - cx);
      if (dist < radius) {
        const depth = Math.sqrt(radius * radius - dist * dist) * 0.45;
        pt.y = Math.min(size().height * 0.88, pt.y + depth);
      }
    });
  }

  function playDefeatAnimation(loser, winner) {
    G.busy = true;
    updateCamera();

    let steps = 0;
    const interval = setInterval(() => {
      steps++;
      const spark = document.createElement("div");
      const offsetX = (Math.random() - 0.5) * 50;
      const offsetY = (Math.random() - 0.5) * 50;
      Object.assign(spark.style, {
        position: "absolute", left: `${G.x[loser] + offsetX}px`, top: `${groundAt(G.x[loser]) + offsetY}px`,
        width: "25px", height: "25px", borderRadius: "50%", background: "radial-gradient(circle, #ffcc00, #ff3300)",
        transform: "translate(-50%, -50%)", zIndex: "50", pointerEvents: "none"
      });
      E.effectLayer?.appendChild(spark);
      setTimeout(() => spark.remove(), 400);

      if (steps >= 6) {
        clearInterval(interval);
        const finalBoom = document.createElement("div");
        Object.assign(finalBoom.style, {
          position: "absolute", left: `${G.x[loser]}px`, top: `${groundAt(G.x[loser])}px`,
          width: "120px", height: "120px", borderRadius: "50%", background: "radial-gradient(circle, #fff, #ff5500, transparent)",
          transform: "translate(-50%, -50%)", zIndex: "60", pointerEvents: "none"
        });
        E.effectLayer?.appendChild(finalBoom);
        setTimeout(() => finalBoom.remove(), 600);

        setTimeout(() => {
          finishMatch(winner);
        }, 800);
      }
    }, 400);
  }

  function endTurn() {
    if (!G.running) return;
    G.active = other(G.active);
    if (G.active === 0) G.round++;
    
    G.wind = Math.round((Math.random() * 50) - 25);
    G.steps = [RULES.movesPerTurn, RULES.movesPerTurn];
    G.angle = [45, 45];
    G.power = 60;
    
    G.busy = false;
    updateCamera();
    updateHUD();
    drawAim();
  }

  function finishMatch(winner) {
    if (!G.running) return;
    G.running = false;
    G.paused = false;
    G.busy = false;
    E.pauseOverlay?.classList.add("hidden");
    E.crate?.classList.add("hidden");
    removeCrateMenu();

    if (E.winner) E.winner.textContent = `${playerName(winner)} WINS!`;
    if (E.resultTankImage) E.resultTankImage.src = tankSrc(winner);

    for (let p = 0; p < 2; p++) {
      if (E.resultHpNames[p]) E.resultHpNames[p].textContent = playerName(p);
      if (E.resultHps[p]) E.resultHps[p].textContent = `${Math.max(0, Math.round(G.health[p]))} HP`;
    }
    showScreen(E.result);
  }

  function togglePause() {
    if (!G.running) return;
    G.paused = !G.paused;
    E.pauseOverlay?.classList.toggle("hidden", !G.paused);
    updateHUD();
    drawAim();
  }

  function saveMatch() {
    if (!G.running) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        active: G.active, round: G.round, health: G.health,
        angle: G.angle, power: G.power, steps: G.steps, x: G.x, terrain: G.terrain, players: G.players, weapons: G.weapons
      }));
    } catch (_) {}
  }

  function resetSettings() {
    G.settings = { effects: true, music: true, volume: 50 };
    if (E.effects) E.effects.checked = true;
    if (E.music) E.music.checked = true;
    if (E.volume) E.volume.value = "50";
    if (E.volumeText) E.volumeText.textContent = "50%";
    stopMusic();
    updateAudioVolume();
    localStorage.removeItem(SETTINGS_KEY);
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (saved) {
        G.settings = { ...G.settings, ...saved };
      }
    } catch (_) {}

    if (E.effects) E.effects.checked = G.settings.effects;
    if (E.music) E.music.checked = G.settings.music;
    if (E.volume) E.volume.value = String(G.settings.volume);
    if (E.volumeText) E.volumeText.textContent = `${G.settings.volume}%`;
    
    updateAudioVolume();
    if (G.settings.music) {
      startMusic();
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-back]").forEach(button => {
      button.addEventListener("click", () => { buttonSound(); showScreen(button.dataset.back); });
    });

    $("play-btn")?.addEventListener("click", () => {
      buttonSound();
      triggerFullscreen();
      if (G.settings.music) startMusic();
      showScreen(E.setup);
    });
    $("online-btn")?.addEventListener("click", () => { buttonSound(); showScreen(E.online); });
    $("settings-btn")?.addEventListener("click", () => { buttonSound(); showScreen(E.settings); });

    $("start-match-btn")?.addEventListener("click", e => { e.preventDefault(); buttonSound(); prepareMatch(); });
    $("begin-battle-btn")?.addEventListener("click", () => { buttonSound(); startMatch(); });

    $("return-menu-btn")?.addEventListener("click", () => { buttonSound(); goMenu(); });
    $("result-menu-btn")?.addEventListener("click", () => { buttonSound(); goMenu(); });
    $("rematch-btn")?.addEventListener("click", () => { buttonSound(); startMatch(); });
    $("restart-match-btn")?.addEventListener("click", () => { buttonSound(); startMatch(); });

    $("battle-menu-btn")?.addEventListener("click", () => { buttonSound(); togglePause(); });
    $("continue-btn")?.addEventListener("click", () => { buttonSound(); if (G.paused) togglePause(); });
    $("save-match-btn")?.addEventListener("click", () => { buttonSound(); saveMatch(); });

    E.left?.addEventListener("pointerdown", () => { buttonSound(); startHoldMove(-1); });
    E.left?.addEventListener("pointerup", stopHoldMove);
    E.left?.addEventListener("pointerleave", stopHoldMove);

    E.right?.addEventListener("pointerdown", () => { buttonSound(); startHoldMove(1); });
    E.right?.addEventListener("pointerup", stopHoldMove);
    E.right?.addEventListener("pointerleave", stopHoldMove);

    E.fire?.addEventListener("click", () => { buttonSound(); fireShot(); });

    E.power?.addEventListener("input", () => {
      G.power = clamp(Number(E.power.value) || 60, RULES.minPower, RULES.maxPower);
      updateHUD();
      drawAim();
    });

    const field = E.field;
    if (field) {
      const newField = field.cloneNode(true);
      field.parentNode.replaceChild(newField, field);
      E.field = newField;

      E.field.addEventListener("pointerdown", e => {
        if (!canControl()) return;
        if (e.target.closest("button") || e.target.closest(".ingame-controls") || e.target.closest(".ingame-hud") || e.target.closest(".overlay") || e.target.closest("#crate-choice-menu")) {
          return;
        }
        const rect = E.field.getBoundingClientRect();
        G.dragging = true;
        G.pointerId = e.pointerId;
        setAngleFromPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      });

      E.field.addEventListener("pointermove", e => {
        if (!G.dragging || e.pointerId !== G.pointerId) return;
        const rect = E.field.getBoundingClientRect();
        setAngleFromPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      });

      const endDrag = e => {
        if (e.pointerId !== G.pointerId) return;
        G.dragging = false;
        G.pointerId = null;
      };
      E.field.addEventListener("pointerup", endDrag);
      E.field.addEventListener("pointercancel", endDrag);
    }

    E.names.forEach((input, index) => {
      input?.addEventListener("input", () => {
        if (G.players[index]) G.players[index].name = input.value.trim() || `Player ${index + 1}`;
        updatePlayerVisuals();
      });
    });

    E.tankChoices.forEach((select, index) => {
      select?.addEventListener("change", () => {
        if (G.players[index]) G.players[index].tank = selectedTank(index);
        updatePlayerVisuals();
      });
    });

    E.effects?.addEventListener("change", () => {
      G.settings.effects = E.effects.checked;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(G.settings));
    });

    E.music?.addEventListener("change", () => {
      G.settings.music = E.music.checked;
      if (G.settings.music) startMusic(); else stopMusic();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(G.settings));
    });

    E.volume?.addEventListener("input", () => {
      G.settings.volume = clamp(Number(E.volume.value) || 0, 0, 100);
      if (E.volumeText) E.volumeText.textContent = `${G.settings.volume}%`;
      updateAudioVolume();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(G.settings));
    });

    $("reset-settings-btn")?.addEventListener("click", () => { buttonSound(); resetSettings(); });

    window.addEventListener("resize", () => {
      if (!isBattleActive()) return;
      resizeCanvases();
      generateTerrain();
      drawTerrain();
      positionTanks();
      drawAim();
    });
  }

  function init() {
    loadSettings();
    bindEvents();
    updatePlayerVisuals();
    if (E.power) E.power.value = String(G.power);
    updateHUD();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
