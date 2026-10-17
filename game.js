(() => {
  "use strict";

  const $ = id => document.getElementById(id);

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
    maxDamage: 45
  };

  const TANK_IMAGES = {
    tank1: "tank1.png",
    tank2: "tank2.png",
    tank3: "tank3.png",
    tank4: "tank4.png"
  };

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
    health: [100, 100],
    angle: [45, 45],
    power: 65,
    steps: [3, 3],
    x: [0, 0],
    terrain: [],

    players: [
      { name: "Player 1", tank: "tank1" },
      { name: "Player 2", tank: "tank2" }
    ],

    dragging: false,
    pointerId: null,
    matchToken: 0,
    aiTimer: null,

    settings: {
      effects: true,
      music: false,
      volume: 45
    },

    audio: null
  };

  const clamp = (n, min, max) =>
    Math.max(min, Math.min(max, n));

  const other = player => player === 0 ? 1 : 0;

  const playerName = player =>
    G.players[player]?.name || `Player ${player + 1}`;

  const tankSrc = player =>
    TANK_IMAGES[G.players[player].tank] || TANK_IMAGES.tank1;

  const size = () => ({
    width: E.field?.clientWidth || 0,
    height: E.field?.clientHeight || 0
  });

  const isBattleActive = () =>
    !!E.battle?.classList.contains("active");

  const canControl = () =>
    G.running &&
    !G.paused &&
    !G.busy &&
    G.health[G.active] > 0 &&
    !(G.mode === "computer" && G.active === 1);

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

  function playButtonSound() {
    if (!G.settings.effects) return;

    try {
      if (!G.audio) {
        G.audio = new Audio("button-sound.mp3");
      }

      G.audio.volume = G.settings.volume / 100;
      G.audio.currentTime = 0;

      const result = G.audio.play();
      if (result?.catch) result.catch(() => {});
    } catch (_) {}
  }

  function showScreen(target) {
    const screens = [
      E.menu, E.mode, E.setup, E.online,
      E.vs, E.battle, E.result, E.settings
    ];

    screens.forEach(screen =>
      screen?.classList.remove("active")
    );

    const next =
      typeof target === "string" ? $(target) : target;

    next?.classList.add("active");
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
    E.projectileLayer?.replaceChildren();
    E.effectLayer?.replaceChildren();
  }

  function goMenu() {
    stopMatch();
    showScreen(E.menu);
  }

  function selectedTank(player) {
    const value = E.tankChoices[player]?.value;

    return TANK_IMAGES[value]
      ? value
      : player === 0 ? "tank1" : "tank2";
  }

  function readPlayerName(player) {
    return (
      E.names[player]?.value?.trim() ||
      `Player ${player + 1}`
    ).slice(0, 18);
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

    G.active = 0;
    G.round = 1;
    G.health = [100, 100];
    G.angle = [45, 45];
    G.power = 65;
    G.steps = [3, 3];

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

    [E.terrainCanvas, E.aimCanvas].forEach(canvas => {
      if (!canvas) return;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    });

    terrainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    aimCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function generateTerrain() {
    const { width, height } = size();
    if (!width || !height) return;

    G.terrain = [];

    for (let x = 0; x <= width; x += 4) {
      const t = x / width;

      const y = clamp(
        height * 0.72 +
        Math.sin(t * Math.PI * 2) * height * 0.055 +
        Math.sin(t * Math.PI * 5) * height * 0.025 +
        (Math.random() - 0.5) * height * 0.012,
        height * 0.48,
        height * 0.84
      );

      G.terrain.push({ x, y });
    }

    const left = Math.floor(G.terrain.length * 0.13);
    const right = Math.floor(G.terrain.length * 0.87);

    if (G.terrain[left]) G.terrain[left].y = height * 0.68;
    if (G.terrain[right]) G.terrain[right].y = height * 0.68;
  }

  function groundAt(x) {
    if (!G.terrain.length) return size().height * 0.7;

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
  }

  function drawTerrain() {
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
      0, height * 0.5, 0, height
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

    G.x[0] = clamp(G.x[0], 28, width * 0.45);
    G.x[1] = clamp(G.x[1], width * 0.55, width - 28);

    for (let p = 0; p < 2; p++) {
      const tank = E.tanks[p];
      if (!tank) continue;

      tank.style.left = `${G.x[p]}px`;
      tank.style.top = `${groundAt(G.x[p]) - 14}px`;
      tank.style.transform = "translate(-50%, -50%)";

      if (E.tankImages[p]) E.tankImages[p].src = tankSrc(p);

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
        notify("Battlefield is too small. Rotate your device.");
        return;
      }

      G.x = [width * 0.13, width * 0.87];

      generateTerrain();
      drawTerrain();
      positionTanks();

      G.running = true;

      updateHUD();
      drawAim();
      maybeComputerTurn();
    });
  }  function getVector(player) {
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

    if (E.round) {
      E.round.textContent = String(G.round);
    }

    if (E.angle) {
      E.angle.textContent = `${Math.round(G.angle[G.active])}°`;
    }

    if (E.power) {
      E.power.value = String(G.power);
    }

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

    if (E.fire) {
      E.fire.disabled = !enabled;
    }
  }

  function moveTank(direction) {
    if (!canControl() || G.steps[G.active] <= 0) return;

    const p = G.active;
    const { width } = size();

    const min = p === 0 ? 28 : width * 0.53;
    const max = p === 0 ? width * 0.47 : width - 28;

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
      E.angle.textContent =
        `${Math.round(G.angle[G.active])}°`;
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

      const dt = Math.min(
        (now - previous) / 1000,
        0.035
      );

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

      if (
        x < 0 ||
        x > width ||
        y >= ground ||
        y > height
      ) {
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

    const damage = Math.round(
      RULES.maxDamage *
      clamp(
        1 - distance / RULES.blastRadius,
        0,
        1
      )
    );

    if (distance <= RULES.blastRadius) {
      G.health[target] = Math.max(
        0,
        G.health[target] -
          Math.max(RULES.minDamage, damage)
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

    if (G.active === 0) {
      G.round++;
    }

    G.steps = [
      RULES.movesPerTurn,
      RULES.movesPerTurn
    ];

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

      const distance = Math.abs(G.x[0] - G.x[1]);

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

    clearTimeout(G.aiTimer);

    const winnerName = playerName(winner);

    if (E.resultEyebrow) {
      E.resultEyebrow.textContent = "BATTLE COMPLETE";
    }

    if (E.resultTitle) {
      E.resultTitle.textContent = "VICTORY!";
    }

    if (E.winner) {
      E.winner.textContent = winnerName;
    }

    if (E.resultImage) {
      E.resultImage.src = tankSrc(winner);
    }

    if (E.resultDescription) {
      E.resultDescription.textContent =
        `${winnerName} won the battle!`;
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
        }
      function saveMatch() {
    try {
      const data = {
        mode: G.mode,
        players: G.players,
        health: G.health,
        active: G.active,
        round: G.round,
        angle: G.angle,
        power: G.power,
        steps: G.steps,
        x: G.x,
        terrain: G.terrain
      };

      localStorage.setItem(
        "tankWarLocalSaveV4",
        JSON.stringify(data)
      );

      notify("Match saved!");
    } catch (error) {
      notify("Could not save this match.");
    }
  }

  function loadSettings() {
    try {
      const data = JSON.parse(
        localStorage.getItem("tankWarSettingsV4") || "null"
      );

      if (data) {
        G.settings = { ...G.settings, ...data };
      }
    } catch (error) {}

    if (E.effects) {
      E.effects.checked = !!G.settings.effects;
    }

    if (E.music) {
      E.music.checked = !!G.settings.music;
    }

    if (E.volume) {
      E.volume.value = String(G.settings.volume);
    }

    if (E.volumeText) {
      E.volumeText.textContent = `${G.settings.volume}%`;
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        "tankWarSettingsV4",
        JSON.stringify(G.settings)
      );
    } catch (error) {}
  }

  function resetSettings() {
    G.settings = {
      effects: true,
      music: false,
      volume: 45
    };

    loadSettings();
    saveSettings();

    notify("Settings reset.");
  }

  function updateOrientation() {
    if (!E.rotate) return;

    const portrait = window.innerHeight > window.innerWidth;
    const mobile = window.matchMedia(
      "(max-width: 800px)"
    ).matches;

    E.rotate.classList.toggle(
      "active",
      portrait && mobile
    );
  }

  function bindNavigation() {
    const bind = (id, callback) => {
      const element = $(id);

      if (!element) {
        console.warn(
          `Tank War: missing element #${id}`
        );
        return;
      }

      element.addEventListener("click", event => {
        event.preventDefault();
        playButtonSound();
        callback();
      });
    };

    bind("play-btn", () => {
      showScreen(E.mode);
    });

    bind("online-btn", () => {
      showScreen(E.online);
    });

    bind("settings-btn", () => {
      showScreen(E.settings);
    });

    bind("local-mode-btn", () => {
      G.mode = "local";
      showScreen(E.setup);
    });

    bind("computer-mode-btn", () => {
      G.mode = "computer";
      showScreen(E.setup);
    });

    bind("start-match-btn", prepareMatch);
    bind("begin-battle-btn", startMatch);

    bind("battle-menu-btn", () => {
      if (!G.running) return;

      G.paused = true;
      G.dragging = false;

      E.pauseOverlay?.classList.remove("hidden");

      drawAim();
      updateHUD();
    });

    bind("continue-btn", () => {
      G.paused = false;

      E.pauseOverlay?.classList.add("hidden");

      drawAim();
      updateHUD();
      maybeComputerTurn();
    });

    bind("save-match-btn", saveMatch);

    bind("restart-match-btn", prepareMatch);

    bind("return-menu-btn", goMenu);
    bind("result-menu-btn", goMenu);

    bind("rematch-btn", prepareMatch);

    bind("reset-settings-btn", resetSettings);

    document.querySelectorAll("[data-back]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        playButtonSound();

        showScreen(button.dataset.back);
      });
    });

    E.effects?.addEventListener("change", () => {
      G.settings.effects = E.effects.checked;
      saveSettings();
    });

    E.music?.addEventListener("change", () => {
      G.settings.music = E.music.checked;
      saveSettings();

      notify(
        "Background music is not connected yet."
      );
    });

    E.volume?.addEventListener("input", () => {
      G.settings.volume = clamp(
        Number(E.volume.value) || 0,
        0,
        100
      );

      if (E.volumeText) {
        E.volumeText.textContent =
          `${G.settings.volume}%`;
      }

      saveSettings();
    });
  }

  function bindGameplay() {
    E.left?.addEventListener("click", () => {
      moveTank(-1);
    });

    E.right?.addEventListener("click", () => {
      moveTank(1);
    });

    E.fire?.addEventListener("click", () => {
      fireShot();
    });

    E.power?.addEventListener("input", () => {
      G.power = clamp(
        Number(E.power.value),
        RULES.minPower,
        RULES.maxPower
      );

      if (E.powerText) {
        E.powerText.textContent =
          `${Math.round(G.power)}%`;
      }

      drawAim();
    });

    document.addEventListener("keydown", event => {
      if (!isBattleActive()) return;

      const key = event.key.toLowerCase();

      if (key === "escape" && G.running) {
        G.paused = !G.paused;

        E.pauseOverlay?.classList.toggle(
          "hidden",
          !G.paused
        );

        drawAim();
        updateHUD();

        if (!G.paused) {
          maybeComputerTurn();
        }

        return;
      }

      if (G.paused || G.busy) return;

      if (key === "arrowleft" || key === "a") {
        event.preventDefault();
        moveTank(-1);
      } else if (key === "arrowright" || key === "d") {
        event.preventDefault();
        moveTank(1);
      } else if (
        key === " " ||
        key === "enter"
      ) {
        event.preventDefault();
        fireShot();
      }
    });

    E.field?.addEventListener(
      "pointerdown",
      event => {
        if (!canControl()) return;

        if (
          event.target.closest(
            ".battle-controls, .battle-topbar, .overlay"
          )
        ) {
          return;
        }

        G.dragging = true;
        G.pointerId = event.pointerId;

        const rect = E.field.getBoundingClientRect();

        setAngleFromPoint({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        });

        try {
          E.field.setPointerCapture(event.pointerId);
        } catch (error) {}
      }
    );

    E.field?.addEventListener(
      "pointermove",
      event => {
        if (
          !G.dragging ||
          event.pointerId !== G.pointerId
        ) {
          return;
        }

        const rect = E.field.getBoundingClientRect();

        setAngleFromPoint({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        });
      }
    );

    const stopDrag = event => {
      if (event.pointerId !== G.pointerId) return;

      G.dragging = false;
      G.pointerId = null;
    };

    E.field?.addEventListener(
      "pointerup",
      stopDrag
    );

    E.field?.addEventListener(
      "pointercancel",
      stopDrag
    );
  }

  function initialize() {
    loadSettings();
    bindNavigation();
    bindGameplay();
    updateOrientation();

    window.addEventListener("resize", () => {
      updateOrientation();

      if (isBattleActive()) {
        resizeCanvases();
        drawTerrain();
        positionTanks();
        drawAim();
      }
    });

    window.addEventListener(
      "orientationchange",
      () => {
        setTimeout(updateOrientation, 150);
      }
    );

    E.tankChoices.forEach((select, player) => {
      select?.addEventListener("change", () => {
        const src =
          TANK_IMAGES[select.value] ||
          TANK_IMAGES.tank1;

        if (E.previews[player]) {
          E.previews[player].src = src;
        }
      });
    });

    showScreen(E.menu);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
