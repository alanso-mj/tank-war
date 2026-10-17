(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const SAVE_KEY = "tankWarLocalSaveV4";
  const SETTINGS_KEY = "tankWarSettingsV4";

  const RULES = {
    health: 100,
    movesPerTurn: 3,
    moveDistance: 22,
    minAngle: 5,
    maxAngle: 85,
    minPower: 20,
    maxPower: 100,
    gravity: 430,
    blastRadius: 105,
    maxDamage: 45,
    minDamage: 5
  };

  // Use the existing tank images while keeping all four dropdown options.
  const TANK_IMAGES = {
    tank1: "tank-blue.png",
    tank2: "tank-red.png",
    tank3: "tank-blue.png",
    tank4: "tank-red.png"
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
    terrainCanvas: $("terrain-canvas"),
    aimCanvas: $("aim-canvas"),
    tanks: [$("tank1"), $("tank2")],
    tankImages: [$("tank1-image"), $("tank2-image")],
    nameplates: [$("tank1-nameplate"), $("tank2-nameplate")],
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
    resultTitle: $("result-title"),
    resultEyebrow: $("result-eyebrow"),
    resultImage: $("result-tank-image"),
    winner: $("winner-name"),
    resultDescription: $("result-description"),
    resultHpNames: [
      $("result-health1-name"),
      $("result-health2-name")
    ],
    resultHps: [
      $("result-health1"),
      $("result-health2")
    ],
    effects: $("effects-toggle"),
    music: $("music-toggle"),
    volume: $("volume-slider"),
    volumeText: $("volume-value")
  };

  const terrainCtx = E.terrainCanvas?.getContext("2d");
  const aimCtx = E.aimCanvas?.getContext("2d");

  const G = {
    mode: "local",
    running: false,
    paused: false,
    busy: false,
    active: 0,
    round: 1,
    health: [RULES.health, RULES.health],
    angle: [45, 45],
    power: 65,
    steps: [RULES.movesPerTurn, RULES.movesPerTurn],
    x: [0, 0],
    terrain: [],
    players: [
      { name: "Player 1", tank: "tank1" },
      { name: "Player 2", tank: "tank2" }
    ],
    dragging: false,
    pointerId: null,
    matchToken: 0,
    settings: {
      effects: true,
      music: false,
      volume: 45
    },
    audio: null,
    musicAudio: null,
    aiTimer: null
  };

  const clamp = (n, min, max) =>
    Math.max(min, Math.min(max, n));

  const other = player => player === 0 ? 1 : 0;

  const tankSrc = player =>
    TANK_IMAGES[G.players[player].tank] || TANK_IMAGES.tank1;

  const playerName = player =>
    G.players[player]?.name || `Player ${player + 1}`;

  const isBattleActive = () =>
    !!E.battle?.classList.contains("active");

  const canControl = () =>
    G.running &&
    !G.paused &&
    !G.busy &&
    G.health[G.active] > 0 &&
    !(G.mode === "computer" && G.active === 1);

  const size = () => ({
    width: E.field?.clientWidth || 0,
    height: E.field?.clientHeight || 0
  });

  function notify(message) {
    let el = $("game-notice");

    if (!el) {
      el = document.createElement("div");
      el.id = "game-notice";

      Object.assign(el.style, {
        position: "fixed",
        left: "50%",
        bottom: "22px",
        transform: "translateX(-50%)",
        zIndex: "99999",
        padding: "12px 18px",
        borderRadius: "10px",
        background: "#202b39",
        color: "#fff",
        fontSize: "14px",
        fontWeight: "700",
        textAlign: "center",
        pointerEvents: "none",
        opacity: "0",
        transition: "opacity .2s"
      });

      document.body.appendChild(el);
    }

    el.textContent = message;
    el.style.opacity = "1";

    clearTimeout(el._timer);

    el._timer = setTimeout(() => {
      el.style.opacity = "0";
    }, 2200);
  }

  function buttonSound() {
    if (!G.settings.effects || G.settings.volume <= 0) return;

    try {
      if (!G.audio) {
        G.audio = new Audio("button-sound.mp3");
      }

      G.audio.volume = clamp(G.settings.volume / 100, 0, 1);
      G.audio.currentTime = 0;

      const promise = G.audio.play();

      if (promise?.catch) {
        promise.catch(() => {});
      }
    } catch (_) {}
  }

  function updateAudioVolume() {
    const volume = clamp(
      (Number(G.settings.volume) || 0) / 100,
      0,
      1
    );

    if (G.audio) G.audio.volume = volume;
    if (G.musicAudio) G.musicAudio.volume = volume;
  }

  function startMusic() {
    try {
      if (!G.musicAudio) {
        G.musicAudio = new Audio(MUSIC_FILE);
        G.musicAudio.loop = true;
        G.musicAudio.preload = "auto";
      }

      updateAudioVolume();

      const promise = G.musicAudio.play();

      if (promise?.catch) {
        promise.catch(() => {});
      }
    } catch (_) {
      notify("Could not load background-music.mp3.");
    }
  }

  function stopMusic() {
    if (!G.musicAudio) return;

    G.musicAudio.pause();
    G.musicAudio.currentTime = 0;
  }

  function showScreen(target) {
    const screens = [
      E.menu,
      E.mode,
      E.setup,
      E.online,
      E.vs,
      E.battle,
      E.result,
      E.settings
    ];

    screens.forEach(screen => {
      screen?.classList.remove("active");
    });

    const screen =
      typeof target === "string" ? $(target) : target;

    screen?.classList.add("active");
    E.rotate?.classList.remove("active");

    requestAnimationFrame(() => {
      if (isBattleActive()) {
        resizeCanvases();
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

    clearTimeout(G.aiTimer);

    E.pauseOverlay?.classList.add("hidden");

    if (E.projectileLayer) {
      E.projectileLayer.replaceChildren();
    }

    if (E.effectLayer) {
      E.effectLayer.replaceChildren();
    }
  }

  function goMenu() {
    stopMatch();
    showScreen(E.menu);
  }

  function selectedTank(player) {
    const value = E.tankChoices[player]?.value;

    return TANK_IMAGES[value]
      ? value
      : (player === 0 ? "tank1" : "tank2");
  }

  function readPlayerName(player) {
    const name = E.names[player]?.value?.trim();

    return (name || `Player ${player + 1}`).slice(0, 18);
  }

  function updatePlayerVisuals() {
    for (let p = 0; p < 2; p++) {
      const src = tankSrc(p);

      if (E.previews[p]) E.previews[p].src = src;
      if (E.vsImages[p]) E.vsImages[p].src = src;
      if (E.tankImages[p]) E.tankImages[p].src = src;

      if (E.vsNames[p]) {
        E.vsNames[p].textContent = playerName(p);
      }

      if (E.hudNames[p]) {
        E.hudNames[p].textContent = playerName(p);
      }

      if (E.nameplates[p]) {
        E.nameplates[p].textContent = playerName(p);
      }
    }
  }

  function prepareMatch() {
    stopMatch();

    G.mode = G.mode === "computer" ? "computer" : "local";
    G.active = 0;
    G.round = 1;
    G.health = [RULES.health, RULES.health];
    G.angle = [45, 45];
    G.power = 65;
    G.steps = [RULES.movesPerTurn, RULES.movesPerTurn];

    G.players = [
      {
        name: readPlayerName(0),
        tank: selectedTank(0)
      },
      {
        name: G.mode === "computer"
          ? "Computer"
          : readPlayerName(1),
        tank: selectedTank(1)
      }
    ];

    updatePlayerVisuals();
    updateHUD();
    showScreen(E.vs);
  }

  function resizeCanvases() {
    if (!E.field || !terrainCtx || !aimCtx) return;

    const { width, height } = size();

    if (!width || !height) return;

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
        height * .72 +
        Math.sin(t * Math.PI * 2) * height * .055 +
        Math.sin(t * Math.PI * 5) * height * .025 +
        (Math.random() - .5) * height * .012,
        height * .48,
        height * .84
      );

      G.terrain.push({ x, y });
    }

    const li = Math.floor(G.terrain.length * .13);
    const ri = Math.floor(G.terrain.length * .87);

    if (G.terrain[li]) G.terrain[li].y = height * .68;
    if (G.terrain[ri]) G.terrain[ri].y = height * .68;
  }

  function groundAt(x) {
    if (!G.terrain.length) {
      return size().height * .7;
    }

    const last = G.terrain[G.terrain.length - 1];
    x = clamp(x, 0, last.x);

    const index = Math.min(
      G.terrain.length - 2,
      Math.floor(x / 4)
    );

    const a = G.terrain[index];
    const b = G.terrain[index + 1];

    if (!a || !b) return last.y;

    const t = (x - a.x) / Math.max(1, b.x - a.x);

    return a.y + (b.y - a.y) * t;
  }  function drawTerrain() {
    if (!terrainCtx || !G.terrain.length) return;

    const { width, height } = size();

    terrainCtx.clearRect(0, 0, width, height);
    terrainCtx.beginPath();
    terrainCtx.moveTo(0, G.terrain[0].y);

    for (const point of G.terrain) {
      terrainCtx.lineTo(point.x, point.y);
    }

    terrainCtx.lineTo(width, height);
    terrainCtx.lineTo(0, height);
    terrainCtx.closePath();

    const gradient = terrainCtx.createLinearGradient(
      0, height * .5, 0, height
    );

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
    terrainCtx.lineJoin = "round";
    terrainCtx.stroke();
  }

  function positionTanks() {
    const { width } = size();

    if (!width) return;

    G.x[0] = clamp(G.x[0], 28, width * .45);
    G.x[1] = clamp(G.x[1], width * .55, width - 28);

    for (let p = 0; p < 2; p++) {
      const tank = E.tanks[p];

      if (!tank) continue;

      const y = groundAt(G.x[p]);

      tank.style.left = `${G.x[p]}px`;
      tank.style.top = `${y - 14}px`;
      tank.style.transform = "translate(-50%, -50%)";

      if (E.tankImages[p]) {
        E.tankImages[p].src = tankSrc(p);
      }

      if (E.nameplates[p]) {
        E.nameplates[p].textContent = playerName(p);
      }
    }
  }

  function startMatch() {
    stopMatch();
    showScreen(E.battle);

    requestAnimationFrame(() => {
      if (!isBattleActive()) return;

      resizeCanvases();

      const { width } = size();

      if (width < 100) {
        notify("Battlefield is too small. Rotate or enlarge the window.");
        return;
      }

      G.x = [width * .13, width * .87];

      generateTerrain();
      drawTerrain();
      positionTanks();

      G.running = true;

      updateHUD();
      drawAim();
      maybeComputerTurn();
    });
  }

  function getVector(player) {
    const direction = player === 0 ? 1 : -1;
    const rad = G.angle[player] * Math.PI / 180;

    return {
      x: Math.cos(rad) * direction,
      y: -Math.sin(rad)
    };
  }

  function muzzle(player) {
    const v = getVector(player);

    return {
      x: G.x[player] + v.x * 28,
      y: groundAt(G.x[player]) - 18 + v.y * 28
    };
  }

  function drawAim() {
    if (!aimCtx || !E.field) return;

    const { width, height } = size();

    aimCtx.clearRect(0, 0, width, height);

    if (
      !G.running ||
      G.paused ||
      G.busy ||
      (G.mode === "computer" && G.active === 1)
    ) {
      return;
    }

    const start = muzzle(G.active);
    const v = getVector(G.active);
    const length = 65 + G.power * 1.3;

    aimCtx.save();
    aimCtx.setLineDash([6, 6]);
    aimCtx.beginPath();
    aimCtx.moveTo(start.x, start.y);

    aimCtx.lineTo(
      start.x + v.x * length,
      start.y + v.y * length
    );

    aimCtx.strokeStyle =
      G.active === 0 ? "#7dc7ff" : "#ff9b9b";

    aimCtx.lineWidth = 2;
    aimCtx.stroke();
    aimCtx.restore();
  }

  function updateHUD() {
    if (E.turn) {
      E.turn.textContent = `${playerName(G.active)}'s Turn`;
    }

    if (E.round) E.round.textContent = String(G.round);
    if (E.angle) E.angle.textContent = `${Math.round(G.angle[G.active])}°`;

    if (E.power) E.power.value = String(G.power);

    if (E.powerText) {
      E.powerText.textContent = `${Math.round(G.power)}%`;
    }

    for (let p = 0; p < 2; p++) {
      if (E.hudNames[p]) {
        E.hudNames[p].textContent = playerName(p);
      }

      if (E.hpTexts[p]) {
        E.hpTexts[p].textContent =
          `${Math.max(0, Math.round(G.health[p]))} HP`;
      }

      if (E.hpFills[p]) {
        E.hpFills[p].style.width =
          `${clamp(G.health[p], 0, 100)}%`;
      }
    }

    if (E.steps) {
      E.steps.textContent = `${G.steps[G.active]}/3`;
    }

    const enabled = canControl();

    if (E.left) {
      E.left.disabled = !enabled || G.steps[G.active] <= 0;
    }

    if (E.right) {
      E.right.disabled = !enabled || G.steps[G.active] <= 0;
    }

    if (E.fire) E.fire.disabled = !enabled;
  }

  function moveTank(direction) {
    if (!canControl() || G.steps[G.active] <= 0) return;

    const p = G.active;
    const { width } = size();

    const min = p === 0 ? 28 : width * .53;
    const max = p === 0 ? width * .47 : width - 28;

    const next = clamp(
      G.x[p] + direction * RULES.moveDistance,
      min,
      max
    );

    if (Math.abs(next - G.x[p]) < 1) return;

    G.x[p] = next;
    G.steps[p]--;

    positionTanks();
    drawAim();
    updateHUD();
  }

  function setAngleFromPoint(point) {
    if (!canControl()) return;

    const start = muzzle(G.active);
    const direction = G.active === 0 ? 1 : -1;

    const dx = (point.x - start.x) * direction;
    const dy = start.y - point.y;

    if (dx <= 0) return;

    G.angle[G.active] = clamp(
      Math.atan2(dy, dx) * 180 / Math.PI,
      RULES.minAngle,
      RULES.maxAngle
    );

    if (E.angle) {
      E.angle.textContent = `${Math.round(G.angle[G.active])}°`;
    }

    drawAim();
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

    const speed = 230 + G.power * 4.2;

    let x = start.x;
    let y = start.y;

    let vx = vector.x * speed;
    let vy = vector.y * speed;

    let previous = performance.now();

    const token = G.matchToken;

    const shell = document.createElement("div");

    shell.className = "projectile";

    Object.assign(shell.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: "12px",
      height: "12px",
      borderRadius: "50%",
      background: shooter === 0 ? "#8ed5ff" : "#ff8b72",
      boxShadow: "0 0 12px rgba(255,190,90,.9)",
      transform: "translate(-50%, -50%)"
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

      vy += RULES.gravity * dt;

      x += vx * dt;
      y += vy * dt;

      shell.style.left = `${x}px`;
      shell.style.top = `${y}px`;

      const { width, height } = size();

      const target = other(shooter);

      const targetPoint = {
        x: G.x[target],
        y: groundAt(G.x[target]) - 16
      };

      const targetDistance = Math.hypot(
        x - targetPoint.x,
        y - targetPoint.y
      );

      if (targetDistance < 25) {
        shell.remove();
        explode(x, y, target, shooter, token);
        return;
      }

      const ground = groundAt(x);

      if (x < 0 || x > width || y >= ground || y > height) {
        shell.remove();

        explode(
          clamp(x, 0, width),
          Math.min(y, ground),
          target,
          shooter,
          token
        );

        return;
      }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function explode(x, y, target, shooter, token) {
    if (token !== G.matchToken || !G.running) return;

    const blast = document.createElement("div");

    blast.className = "explosion";

    Object.assign(blast.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: `${RULES.blastRadius * 2}px`,
      height: `${RULES.blastRadius * 2}px`,
      borderRadius: "50%",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
      background:
        "radial-gradient(circle, rgba(255,245,170,.95) 0%, rgba(255,145,48,.8) 30%, rgba(255,65,25,.2) 65%, transparent 72%)"
    });

    E.effectLayer?.appendChild(blast);

    const targetY = groundAt(G.x[target]) - 16;

    const distance = Math.hypot(
      x - G.x[target],
      y - targetY
    );

    const damage = Math.max(
      distance <= RULES.blastRadius ? RULES.minDamage : 0,
      Math.round(
        RULES.maxDamage *
        clamp(1 - distance / RULES.blastRadius, 0, 1)
      )
    );

    if (distance <= RULES.blastRadius) {
      G.health[target] = Math.max(
        0,
        G.health[target] - damage
      );
    }

    updateHUD();

    if (blast.animate) {
      blast.animate(
        [
          {
            opacity: 1,
            transform: "translate(-50%, -50%) scale(.15)"
          },
          {
            opacity: 0,
            transform: "translate(-50%, -50%) scale(1)"
          }
        ],
        {
          duration: 420,
          easing: "ease-out"
        }
      );
    }

    setTimeout(() => blast.remove(), 450);

    setTimeout(() => {
      if (token !== G.matchToken || !G.running) return;

      if (G.health[target] <= 0) {
        finishMatch(shooter);
      } else {
        endTurn();
      }
    }, 450);
  }

  function endTurn() {
    if (!G.running) return;

    G.active = other(G.active);

    if (G.active === 0) G.round++;

    G.steps = [RULES.movesPerTurn, RULES.movesPerTurn];
    G.busy = false;

    updateHUD();
    drawAim();
    maybeComputerTurn();
  }

  function maybeComputerTurn() {
    if (
      !G.running ||
      G.paused ||
      G.mode !== "computer" ||
      G.active !== 1
    ) {
      return;
    }

    G.busy = true;
    updateHUD();

    G.aiTimer = setTimeout(() => {
      if (!G.running || G.paused || G.active !== 1) {
        G.busy = false;
        updateHUD();
        return;
      }

      const dx = G.x[0] - G.x[1];
      const distance = Math.abs(dx);

      G.angle[1] = clamp(
        28 + Math.random() * 28,
        RULES.minAngle,
        RULES.maxAngle
      );

      G.power = clamp(
        48 + distance / Math.max(1, size().width) * 40,
        30,
        95
      );

      G.busy = false;

      updateHUD();
      fireShot();
    }, 900);
  }

  function finishMatch(winner) {
    if (!G.running) return;

    G.running = false;
    G.paused = false;
    G.busy = false;
    G.dragging = false;

    clearTimeout(G.aiTimer);

    E.pauseOverlay?.classList.add("hidden");

    if (E.resultTitle) {
      E.resultTitle.textContent = "VICTORY!";
    }

    if (E.resultEyebrow) {
      E.resultEyebrow.textContent = "BATTLE COMPLETE";
    }

    if (E.winner) {
      E.winner.textContent = `${playerName(winner)} WINS!`;
    }

    if (E.resultDescription) {
      E.resultDescription.textContent =
        `${playerName(winner)} defeated ${playerName(other(winner))}!`;
    }

    if (E.resultImage) {
      E.resultImage.src = tankSrc(winner);
    }

    for (let p = 0; p < 2; p++) {
      if (E.resultHpNames[p]) {
        E.resultHpNames[p].textContent = playerName(p);
      }

      if (E.resultHps[p]) {
        E.resultHps[p].textContent =
          `${Math.max(0, Math.round(G.health[p]))} HP`;
      }
    }

    showScreen(E.result);
  }  function togglePause() {
    if (!G.running) return;

    G.paused = !G.paused;

    E.pauseOverlay?.classList.toggle("hidden", !G.paused);

    updateHUD();
    drawAim();
  }

  function saveMatch() {
    if (!G.running) {
      notify("There is no active match to save.");
      return;
    }

    try {
      const save = {
        mode: G.mode,
        active: G.active,
        round: G.round,
        health: G.health,
        angle: G.angle,
        power: G.power,
        steps: G.steps,
        x: G.x,
        terrain: G.terrain,
        players: G.players
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      notify("Match saved successfully!");
    } catch (_) {
      notify("Could not save the match.");
    }
  }

  function loadMatch() {
    let save;

    try {
      const raw = localStorage.getItem(SAVE_KEY);

      if (!raw) {
        notify("No saved match found.");
        return;
      }

      save = JSON.parse(raw);
    } catch (_) {
      notify("Could not read the saved match.");
      return;
    }

    if (
      !save ||
      !Array.isArray(save.health) ||
      !Array.isArray(save.players) ||
      !Array.isArray(save.x) ||
      !Array.isArray(save.terrain) ||
      save.players.length !== 2 ||
      save.health.length !== 2 ||
      save.x.length !== 2 ||
      save.terrain.length < 2
    ) {
      notify("The saved match is invalid.");
      return;
    }

    stopMatch();

    G.mode = save.mode === "computer" ? "computer" : "local";
    G.active = save.active === 1 ? 1 : 0;
    G.round = Math.max(1, Number(save.round) || 1);

    G.health = save.health.map(value =>
      clamp(Number(value) || 0, 0, RULES.health)
    );

    G.angle = save.angle?.map(value =>
      clamp(Number(value) || 45, RULES.minAngle, RULES.maxAngle)
    ) || [45, 45];

    G.power = clamp(Number(save.power) || 65, RULES.minPower, RULES.maxPower);

    G.steps = save.steps?.map(value =>
      clamp(Number(value) || 0, 0, RULES.movesPerTurn)
    ) || [RULES.movesPerTurn, RULES.movesPerTurn];

    G.players = save.players.map((player, index) => ({
      name: String(player.name || `Player ${index + 1}`).slice(0, 18),
      tank: TANK_IMAGES[player.tank]
        ? player.tank
        : (index === 0 ? "tank1" : "tank2")
    }));

    G.x = save.x.map(value => Number(value) || 0);

    G.terrain = save.terrain
      .filter(point =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y)
      )
      .map(point => ({
        x: Number(point.x),
        y: Number(point.y)
      }));

    if (G.terrain.length < 2) {
      notify("The saved terrain is invalid.");
      return;
    }

    showScreen(E.battle);

    requestAnimationFrame(() => {
      resizeCanvases();

      const { width, height } = size();

      if (!width || !height) {
        notify("Could not load the battlefield.");
        return;
      }

      G.x = G.x.map(value => clamp(value, 28, width - 28));

      G.terrain = G.terrain.map(point => ({
        x: clamp(point.x, 0, width),
        y: clamp(point.y, height * .3, height)
      }));

      G.running = true;
      G.paused = false;
      G.busy = false;

      generateTerrainForLoadedMatch();
      drawTerrain();
      updatePlayerVisuals();
      positionTanks();
      updateHUD();
      drawAim();

      notify("Saved match loaded!");
      maybeComputerTurn();
    });
  }

  function generateTerrainForLoadedMatch() {
    const { width } = size();

    if (!G.terrain.length || width <= 0) return;

    const last = G.terrain[G.terrain.length - 1];

    if (last.x < width) {
      G.terrain.push({
        x: width,
        y: last.y
      });
    }
  }

  function resetSettings() {
    G.settings = {
      effects: true,
      music: false,
      volume: 45
    };

    if (E.effects) E.effects.checked = true;
    if (E.music) E.music.checked = false;

    if (E.volume) E.volume.value = "45";
    if (E.volumeText) E.volumeText.textContent = "45%";

    stopMusic();
    updateAudioVolume();
    saveSettings();

    notify("Settings reset.");
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(G.settings)
      );
    } catch (_) {}
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(SETTINGS_KEY) || "null"
      );

      if (!saved) return;

      G.settings.effects = saved.effects !== false;
      G.settings.music = saved.music === true;
      G.settings.volume = clamp(
        Number(saved.volume) || 0,
        0,
        100
      );
    } catch (_) {}

    if (E.effects) {
      E.effects.checked = G.settings.effects;
    }

    if (E.music) {
      E.music.checked = G.settings.music;
    }

    if (E.volume) {
      E.volume.value = String(G.settings.volume);
    }

    if (E.volumeText) {
      E.volumeText.textContent = `${G.settings.volume}%`;
    }

    updateAudioVolume();
  }

  function addLoadButton() {
    const panel = E.pauseOverlay;

    if (!panel || $("load-match-btn")) return;

    const saveButton = $("save-match-btn");

    const button = document.createElement("button");

    button.id = "load-match-btn";
    button.type = "button";
    button.textContent = "Load Saved Match";
    button.className = saveButton?.className || "menu-button";

    if (saveButton?.parentElement) {
      saveButton.insertAdjacentElement("afterend", button);
    } else {
      panel.appendChild(button);
    }

    button.addEventListener("click", () => {
      buttonSound();
      loadMatch();
    });
  }

  function bindEvents() {
    document.querySelectorAll("[data-back]").forEach(button => {
  button.addEventListener("click", () => {
    buttonSound();
    showScreen(button.dataset.back);
  });
});
    $("play-btn")?.addEventListener("click", () => {
      buttonSound();
      showScreen(E.mode);
    });

    $("online-btn")?.addEventListener("click", () => {
      buttonSound();
      showScreen(E.online);
    });

    $("settings-btn")?.addEventListener("click", () => {
      buttonSound();
      showScreen(E.settings);
    });

    $("local-mode-btn")?.addEventListener("click", () => {
      buttonSound();
      G.mode = "local";
      showScreen(E.setup);
    });

    $("computer-mode-btn")?.addEventListener("click", () => {
      buttonSound();
      G.mode = "computer";
      showScreen(E.setup);
    });

    $("begin-battle-btn")?.addEventListener$("start-match-btn")?.addEventListener("click", () => {
  buttonSound();
  prepareMatch();
});$("start-match-btn")?.addEventListener("click", () => {
  alert("START BUTTON WORKS");
  prepareMatch();
});("click", () => {
      buttonSound();
      startMatch();
    });

    $("return-menu-btn")?.addEventListener("click", () => {
      buttonSound();
      goMenu();
    });

    $("result-menu-btn")?.addEventListener("click", () => {
      buttonSound();
      goMenu();
    });

    $("rematch-btn")?.addEventListener("click", () => {
      buttonSound();
      startMatch();
    });

    $("battle-menu-btn")?.addEventListener("click", () => {
      buttonSound();
      togglePause();
    });

    $("continue-btn")?.addEventListener("click", () => {
      buttonSound();

      if (G.paused) togglePause();
    });

    $("restart-match-btn")?.addEventListener("click", () => {
      buttonSound();
      startMatch();
    });

    $("save-match-btn")?.addEventListener("click", () => {
      buttonSound();
      saveMatch();
    });

    $("move-left-btn")?.addEventListener("click", () => {
      buttonSound();
      moveTank(-1);
    });

    $("move-right-btn")?.addEventListener("click", () => {
      buttonSound();
      moveTank(1);
    });

    E.fire?.addEventListener("click", () => {
      buttonSound();
      fireShot();
    });

    E.power?.addEventListener("input", () => {
      G.power = clamp(
        Number(E.power.value) || 65,
        RULES.minPower,
        RULES.maxPower
      );

      updateHUD();
      drawAim();
    });

    E.field?.addEventListener("pointerdown", event => {
      if (!canControl()) return;

      const rect = E.field.getBoundingClientRect();

      G.dragging = true;
      G.pointerId = event.pointerId;

      setAngleFromPoint({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    });

    E.field?.addEventListener("pointermove", event => {
      if (!G.dragging || event.pointerId !== G.pointerId) return;

      const rect = E.field.getBoundingClientRect();

      setAngleFromPoint({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    });

    const endDrag = event => {
      if (event.pointerId !== G.pointerId) return;

      G.dragging = false;
      G.pointerId = null;
    };

    E.field?.addEventListener("pointerup", endDrag);
    E.field?.addEventListener("pointercancel", endDrag);

    E.names.forEach((input, index) => {
      input?.addEventListener("input", () => {
        if (G.players[index]) {
          G.players[index].name =
            input.value.trim() || `Player ${index + 1}`;
        }

        updatePlayerVisuals();
      });
    });

    E.tankChoices.forEach((select, index) => {
      select?.addEventListener("change", () => {
        if (G.players[index]) {
          G.players[index].tank = selectedTank(index);
        }

        updatePlayerVisuals();
      });
    });

    E.effects?.addEventListener("change", () => {
      G.settings.effects = E.effects.checked;
      saveSettings();
    });

    E.music?.addEventListener("change", () => {
      G.settings.music = E.music.checked;

      if (G.settings.music) {
        startMusic();
      } else {
        stopMusic();
      }

      saveSettings();
    });

    E.volume?.addEventListener("input", () => {
      G.settings.volume = clamp(
        Number(E.volume.value) || 0,
        0,
        100
      );

      if (E.volumeText) {
        E.volumeText.textContent = `${G.settings.volume}%`;
      }

      updateAudioVolume();
      saveSettings();
    });

    $("reset-settings-btn")?.addEventListener("click", () => {
      buttonSound();
      resetSettings();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && G.running) {
        event.preventDefault();
        togglePause();
      }

      if (!canControl()) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveTank(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveTank(1);
      } else if (event.key === " ") {
        event.preventDefault();
        fireShot();
      }
    });

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
    addLoadButton();
    updatePlayerVisuals();

    if (G.settings.music) {
      // Browsers may block autoplay until the player interacts.
      startMusic();
    }

    if (E.power) E.power.value = String(G.power);

    updateHUD();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
