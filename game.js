/* =====================================================
   TANK WAR — GAME ENGINE
   Fresh local-game implementation
   No Firebase connection
   ===================================================== */

"use strict";

(() => {
  const $ = (id) => document.getElementById(id);

  const screens = [
    "main-menu",
    "mode-screen",
    "setup-screen",
    "vs-screen",
    "battle-screen",
    "victory-screen",
    "settings-screen",
    "how-to-screen",
    "online-screen"
  ];

  const CONFIG = {
    maxHP: 100,
    moveSeconds: 3,
    gravity: 430,
    minPower: 10,
    maxPower: 100,
    defaultPower: 60,
    blastRadius: 105,
    maxFlightSeconds: 7,
    turnDelay: 1000,
    effectsDuration: 700
  };

  const TANKS = [
    { name: "STRIKER", body: "#287fce", turret: "#3b9ce9" },
    { name: "GUARDIAN", body: "#44815c", turret: "#70b981" }
  ];

  const state = {
    screen: "main-menu",
    paused: false,
    gameOver: false,
    activePlayer: 0,
    round: 1,
    tanks: [],
    tankChoices: [0, 0],
    power: CONFIG.defaultPower,
    aiming: false,
    aimAngle: 0,
    projectileActive: false,
    movementHeld: null,
    movementRemaining: CONFIG.moveSeconds,
    movementTimer: null,
    animationFrame: null,
    lastFrame: 0,
    confirmAction: null,
    noticeTimer: null,
    messageTimer: null,
    resizeObserver: null,
    audioContext: null,
    masterVolume: 0.7,
    musicEnabled: true,
    effectsEnabled: true,
    menuMusic: null,
    matchNumber: 0,
    restorePromptShown: false
  };

  const battlefield = $("battlefield");
  const terrainCanvas = $("terrain-canvas");
  const aimCanvas = $("aim-canvas");
  const terrainContext = terrainCanvas.getContext("2d");
  const aimContext = aimCanvas.getContext("2d");

  /* =====================================================
     GENERAL UTILITIES
     ===================================================== */

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function screenSize() {
    const rect = battlefield.getBoundingClientRect();

    return {
      width: rect.width,
      height: rect.height
    };
  }

  function showScreen(id) {
    screens.forEach((screenId) => {
      const screen = $(screenId);
      if (screen) screen.classList.toggle("active", screenId === id);
    });

    state.screen = id;
  }

  function showNotice(message, duration = 2200) {
    const notice = $("global-notice");

    notice.textContent = message;
    notice.classList.add("visible");

    clearTimeout(state.noticeTimer);

    state.noticeTimer = setTimeout(() => {
      notice.classList.remove("visible");
    }, duration);
  }

  function showBattleMessage(message, duration = 1500) {
    const element = $("battle-message");

    element.textContent = message;
    element.classList.remove("hidden");

    clearTimeout(state.messageTimer);

    state.messageTimer = setTimeout(() => {
      element.textContent = "";
    }, duration);
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function nickname(inputId, fallback) {
    const value = $(inputId).value.trim().slice(0, 16);
    return value || fallback;
  }

  /* =====================================================
     MENU NAVIGATION
     ===================================================== */

  function goBack(screenId) {
    if (state.screen === "battle-screen") return;
    showScreen(screenId);
  }

  $("play-btn").addEventListener("click", () => {
    playMenuSound();
    showScreen("mode-screen");
  });

  $("settings-btn").addEventListener("click", () => {
    openSettings("main-menu");
  });

  $("how-to-btn").addEventListener("click", () => {
    showScreen("how-to-screen");
  });

  $("local-match-btn").addEventListener("click", () => {
    showScreen("setup-screen");
  });

  $("online-match-btn").addEventListener("click", () => {
    showScreen("online-screen");
    showNotice("Online multiplayer will be added later.");
  });

  document.querySelectorAll("[data-back]").forEach((button) => {
    button.addEventListener("click", () => {
      goBack(button.dataset.back);
    });
  });

  let settingsReturnScreen = "main-menu";

  function openSettings(returnScreen = "main-menu") {
    settingsReturnScreen = returnScreen;
    syncSettingsUI();
    showScreen("settings-screen");
  }

  $("settings-back-btn").addEventListener("click", () => {
    showScreen(settingsReturnScreen);
  });

  $("how-to-back-btn").addEventListener("click", () => {
    showScreen("main-menu");
  });

  $("pause-settings-btn").addEventListener("click", () => {
    openSettings("battle-screen");
  });

  /* =====================================================
     TANK SELECTION
     ===================================================== */

  function updateTankChoice(player) {
    const index = state.tankChoices[player];
    const tank = TANKS[index];

    $(`tank${player + 1}-name`).textContent =
      `${player === 0 ? "BLUE" : "RED"} ${tank.name}`;

    const preview = $(`tank${player + 1}-preview`);
    const body = preview.querySelector(".preview-body");
    const turret = preview.querySelector(".preview-turret");

    body.style.background = tank.body;
    turret.style.background = tank.turret;
  }

  function changeTankChoice(player, direction) {
    state.tankChoices[player] =
      (state.tankChoices[player] + direction + TANKS.length) %
      TANKS.length;

    updateTankChoice(player);
  }

  $("tank1-prev").addEventListener("click", () => changeTankChoice(0, -1));
  $("tank1-next").addEventListener("click", () => changeTankChoice(0, 1));
  $("tank2-prev").addEventListener("click", () => changeTankChoice(1, -1));
  $("tank2-next").addEventListener("click", () => changeTankChoice(1, 1));

  /* =====================================================
     AUDIO
     ===================================================== */

  function getAudioContext() {
    if (state.audioContext) return state.audioContext;

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return null;

    state.audioContext = new AudioContextClass();
    return state.audioContext;
  }

  function playTone(frequency, duration, volume, type = "sine") {
    if (!state.effectsEnabled || state.masterVolume <= 0) return;

    const context = getAudioContext();
    if (!context) return;

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);

    gain.gain.setValueAtTime(
      Math.max(0.0001, volume * state.masterVolume),
      context.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  function playMenuSound() {
    if (!state.musicEnabled) return;
    playTone(440, 0.08, 0.04, "sine");
  }

  function playFireSound() {
    playTone(95, 0.28, 0.22, "sawtooth");
  }

  function playExplosionSound() {
    playTone(55, 0.42, 0.28, "triangle");
    setTimeout(() => playTone(38, 0.28, 0.12, "sine"), 70);
  }

  function syncSettingsUI() {
    $("master-volume").value = Math.round(state.masterVolume * 100);
    $("volume-value").textContent =
      `${Math.round(state.masterVolume * 100)}%`;

    $("music-toggle").checked = state.musicEnabled;
    $("effects-toggle").checked = state.effectsEnabled;
  }

  $("master-volume").addEventListener("input", (event) => {
    state.masterVolume = Number(event.target.value) / 100;
    $("volume-value").textContent = `${event.target.value}%`;
  });

  $("music-toggle").addEventListener("change", (event) => {
    state.musicEnabled = event.target.checked;
  });

  $("effects-toggle").addEventListener("change", (event) => {
    state.effectsEnabled = event.target.checked;
  });

  /* =====================================================
     MATCH SETUP
     ===================================================== */

  $("start-battle-btn").addEventListener("click", startMatch);

  function createTank(player, name, choice, x, facing) {
    return {
      player,
      name,
      choice,
      x,
      y: 0,
      facing,
      angle: player === 0 ? -0.48 : Math.PI - 0.48,
      hp: CONFIG.maxHP,
      movementUsed: 0,
      alive: true,
      element: $(`tank${player + 1}`)
    };
  }

  function startMatch() {
    stopGameLoop();
    clearMovement();

    state.matchNumber++;
    state.activePlayer = Math.random() < 0.5 ? 0 : 1;
    state.round = 1;
    state.gameOver = false;
    state.paused = false;
    state.projectileActive = false;
    state.aiming = false;
    state.movementRemaining = CONFIG.moveSeconds;

    const { width, height } = screenSize();

    state.tanks = [
      createTank(
        0,
        nickname("player1-name", "Blue Player"),
        state.tankChoices[0],
        width * 0.17,
        1
      ),
      createTank(
        1,
        nickname("player2-name", "Red Player"),
        state.tankChoices[1],
        width * 0.83,
        -1
      )
    ];

    state.tanks.forEach((tank) => {
      tank.y = height * 0.74;
      tank.element.classList.remove("tank-defeated");
    });

    $("hud-name1").textContent = state.tanks[0].name;
    $("hud-name2").textContent = state.tanks[1].name;

    $("connection-indicator").classList.add("hidden");
    $("power-slider").value = CONFIG.defaultPower;
    state.power = CONFIG.defaultPower;
    $("power-value").textContent = `${CONFIG.defaultPower}%`;

    resetTerrain();
    resizeCanvases();
    positionTanks();
    updateHUD();
    updateAimDisplay();

    showScreen("vs-screen");
    runCountdown();
  }

  let countdownTimer = null;

  function runCountdown() {
    clearInterval(countdownTimer);

    let count = 3;
    $("vs-countdown").textContent = count;
    $("vs-name1").textContent = state.tanks[0].name;
    $("vs-name2").textContent = state.tanks[1].name;

    $("vs-tank1").textContent = "🚜";
    $("vs-tank2").textContent = "🚜";

    countdownTimer = setInterval(() => {
      count--;

      if (count > 0) {
        $("vs-countdown").textContent = count;
      } else {
        clearInterval(countdownTimer);
        $("vs-countdown").textContent = "FIRE!";
        showScreen("battle-screen");
        resizeCanvases();
        positionTanks();
        setTimeout(() => {
          if (state.screen !== "battle-screen" || state.gameOver) return;
          startGameLoop();
          beginTurn();
        }, 500);
      }
    }, 1000);
  }

  /* =====================================================
     TERRAIN
     ===================================================== */

  let terrainProfile = [];
  let craterList = [];

  function resetTerrain() {
    const { width, height } = screenSize();

    terrainProfile = [];
    craterList = [];

    const groundY = height * 0.78;
    const points = Math.max(30, Math.ceil(width / 8));

    for (let i = 0; i <= points; i++) {
      const x = (i / points) * width;
      const hills =
        Math.sin(i * 0.31) * height * 0.012 +
        Math.sin(i * 0.13) * height * 0.009;

      terrainProfile.push({
        x,
        y: groundY + hills
      });
    }

    drawTerrain();
  }

  function groundAt(x) {
    if (!terrainProfile.length) return screenSize().height * 0.78;

    x = clamp(x, 0, screenSize().width);

    for (let i = 1; i < terrainProfile.length; i++) {
      if (terrainProfile[i].x >= x) {
        const a = terrainProfile[i - 1];
        const b = terrainProfile[i];
        const amount = (x - a.x) / Math.max(1, b.x - a.x);

        return a.y + (b.y - a.y) * amount;
      }
    }

    return terrainProfile[terrainProfile.length - 1].y;
  }

  function drawTerrain() {
    const { width, height } = screenSize();

    terrainContext.clearRect(0, 0, width, height);

    if (!terrainProfile.length) return;

    terrainContext.beginPath();
    terrainContext.moveTo(0, height);

    terrainProfile.forEach((point) => {
      terrainContext.lineTo(point.x, point.y);
    });

    terrainContext.lineTo(width, height);
    terrainContext.closePath();

    const gradient = terrainContext.createLinearGradient(
      0,
      height * 0.7,
      0,
      height
    );

    gradient.addColorStop(0, "#d99a60");
    gradient.addColorStop(1, "#75472f");

    terrainContext.fillStyle = gradient;
    terrainContext.fill();

    terrainContext.strokeStyle = "#efbd78";
    terrainContext.lineWidth = 3;
    terrainContext.beginPath();

    terrainProfile.forEach((point, index) => {
      if (index === 0) {
        terrainContext.moveTo(point.x, point.y);
      } else {
        terrainContext.lineTo(point.x, point.y);
      }
    });

    terrainContext.stroke();

    terrainContext.globalAlpha = 0.16;
    terrainContext.strokeStyle = "#4e3024";
    terrainContext.lineWidth = 1;

    for (let i = 0; i < 90; i++) {
      const x = Math.random() * width;
      const y = groundAt(x) + Math.random() * Math.max(1, height * 0.18);

      terrainContext.beginPath();
      terrainContext.moveTo(x, y);
      terrainContext.lineTo(x + randomBetween(2, 12), y + 1);
      terrainContext.stroke();
    }

    terrainContext.globalAlpha = 1;
  }

  function deformTerrain(centerX, radius) {
    const { width, height } = screenSize();

    centerX = clamp(centerX, 0, width);
    radius = Math.min(radius, width * 0.25);

    const depth = Math.min(25, height * 0.045);

    terrainProfile = terrainProfile.map((point) => {
      const distance = Math.abs(point.x - centerX);

      if (distance >= radius) return point;

      const influence = 1 - distance / radius;

      return {
        x: point.x,
        y: Math.min(height, point.y + depth * influence * influence)
      };
    });

    drawTerrain();
    positionTanks();
  }

  /* =====================================================
     CANVAS SIZE AND TANK POSITION
     ===================================================== */

  function resizeCanvases() {
    const { width, height } = screenSize();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    [terrainCanvas, aimCanvas].forEach((canvas) => {
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const context = canvas.getContext("2d");
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    });

    drawTerrain();
    drawAimPreview();
    positionTanks();
  }

  function positionTanks() {
    if (!state.tanks.length) return;

    const { width, height } = screenSize();

    state.tanks.forEach((tank) => {
      tank.x = clamp(tank.x, 10, width - 10);
      tank.y = groundAt(tank.x);

      const element = tank.element;
      const tankWidth = element.offsetWidth || 55;
      const tankHeight = element.offsetHeight || 35;

      element.style.left = `${tank.x - tankWidth / 2}px`;
      element.style.top = `${tank.y - tankHeight}px`;

      const turret = element.querySelector(".tank-turret");
      turret.style.transform = `rotate(${tank.angle}rad)`;

      element.style.opacity = tank.alive ? "1" : "0.25";
    });
  }

  window.addEventListener("resize", () => {
    if (state.screen === "battle-screen") {
      resizeCanvases();
    }
  });

  if ("ResizeObserver" in window) {
    state.resizeObserver = new ResizeObserver(() => {
      if (state.screen === "battle-screen") {
        resizeCanvases();
      }
    });

    state.resizeObserver.observe(battlefield);
  }

  /* =====================================================
     HEALTH AND TURN HUD
     ===================================================== */

  function updateHUD() {
    state.tanks.forEach((tank, index) => {
      const health = clamp(tank.hp, 0, CONFIG.maxHP);

      $(`health${index + 1}`).style.width = `${health}%`;
      $(`hp${index + 1}-text`).textContent = `${health} HP`;
    });

    $("round-label").textContent = `ROUND ${state.round}`;

    const currentTank = state.tanks[state.activePlayer];

    if (currentTank) {
      $("turn-indicator").textContent =
        `${currentTank.name.toUpperCase()}'S TURN`;

      $("turn-indicator").style.color =
        state.activePlayer === 0 ? "#7ec4ff" : "#ff969d";
    }
  }

  function updateAimDisplay() {
    const degrees = Math.round(
      Math.abs(state.aimAngle * 180 / Math.PI)
    );

    $("angle-value").textContent = `${degrees}°`;
    $("power-value").textContent = `${state.power}%`;
  }

  function beginTurn() {
    if (state.gameOver || state.paused) return;

    clearMovement();

    state.aiming = false;
    state.projectileActive = false;
    state.movementRemaining = CONFIG.moveSeconds;

    const tank = state.tanks[state.activePlayer];

    if (!tank || !tank.alive) {
      finishMatch(state.tanks[1 - state.activePlayer]);
      return;
    }

    const target = state.tanks[1 - state.activePlayer];

    tank.angle = tank.player === 0
      ? -0.48
      : Math.PI + 0.48;

    if (target) {
      const dx = target.x - tank.x;
      const dy = groundAt(target.x) - groundAt(tank.x);
      tank.angle = Math.atan2(dy - 25, dx);
    }

    positionTanks();
    drawAimPreview();
    updateHUD();

    showBattleMessage(`${tank.name}'S TURN`, 1200);
    saveLocalMatch();
  }

  function endTurn() {
    if (state.gameOver || state.paused) return;

    clearMovement();

    state.activePlayer = 1 - state.activePlayer;

    if (state.activePlayer === 0) {
      state.round++;
    }

    setTimeout(() => {
      if (!state.gameOver && !state.paused) beginTurn();
    }, CONFIG.turnDelay);
  }

  /* =====================================================
     AIMING
     ===================================================== */

  function currentTank() {
    return state.tanks[state.activePlayer];
  }

  function getBarrelOrigin(tank) {
    const { height } = screenSize();

    const direction = Math.cos(tank.angle) >= 0 ? 1 : -1;

    return {
      x: tank.x + direction * 15,
      y: groundAt(tank.x) - 23
    };
  }

  function calculateAimAngle(pointerX, pointerY, tank) {
    const origin = getBarrelOrigin(tank);

    let angle = Math.atan2(
      pointerY - origin.y,
      pointerX - origin.x
    );

    if (tank.player === 0) {
      angle = clamp(angle, -Math.PI * 0.48, Math.PI * 0.48);
    } else {
      if (angle < 0) angle += Math.PI * 2;

      angle = clamp(angle, Math.PI * 0.52, Math.PI * 1.48);
    }

    return angle;
  }

  function drawAimPreview() {
    if (!aimContext) return;

    const { width, height } = screenSize();

    aimContext.clearRect(0, 0, width, height);

    if (
      state.screen !== "battle-screen" ||
      state.paused ||
      state.gameOver ||
      state.projectileActive
    ) {
      return;
    }

    const tank = currentTank();

    if (!tank || !tank.alive) return;

    const origin = getBarrelOrigin(tank);
    const power = state.power / 100;

    const speed = 190 + power * 300;
    const vx = Math.cos(tank.angle) * speed;
    const vy = Math.sin(tank.angle) * speed;

    aimContext.save();
    aimContext.setLineDash([3, 6]);
    aimContext.lineWidth = 2;
    aimContext.strokeStyle = "rgba(255,255,255,0.7)";
    aimContext.beginPath();
    aimContext.moveTo(origin.x, origin.y);

    let lastX = origin.x;
    let lastY = origin.y;

    for (let t = 0.04; t < 2.8; t += 0.04) {
      const x = origin.x + vx * t;
      const y = origin.y + vy * t + 0.5 * CONFIG.gravity * t * t;

      if (x < 0 || x > width || y > height) break;

      aimContext.lineTo(x, y);

      lastX = x;
      lastY = y;

      if (y >= groundAt(x)) break;
    }

    aimContext.stroke();
    aimContext.setLineDash([]);

    aimContext.beginPath();
    aimContext.arc(lastX, lastY, 3, 0, Math.PI * 2);
    aimContext.fillStyle = "rgba(255,255,255,0.9)";
    aimContext.fill();

    aimContext.restore();
  }

  let aimPointerId = null;

  battlefield.addEventListener("pointerdown", (event) => {
    if (
      state.screen !== "battle-screen" ||
      state.paused ||
      state.gameOver ||
      state.projectileActive
    ) return;

    if (event.target.closest(".battle-controls, .battle-hud, button, input")) {
      return;
    }

    const rect = battlefield.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const tank = currentTank();
    if (!tank) return;

    aimPointerId = event.pointerId;
    state.aiming = true;

    battlefield.setPointerCapture?.(event.pointerId);

    state.aimAngle = calculateAimAngle(x, y, tank);
    tank.angle = state.aimAngle;

    positionTanks();
    drawAimPreview();
    updateAimDisplay();
  });

  battlefield.addEventListener("pointermove", (event) => {
    if (!state.aiming || event.pointerId !== aimPointerId) return;

    const rect = battlefield.getBoundingClientRect();
    const tank = currentTank();

    if (!tank) return;

    state.aimAngle = calculateAimAngle(
      event.clientX - rect.left,
      event.clientY - rect.top,
      tank
    );

    tank.angle = state.aimAngle;

    positionTanks();
    drawAimPreview();
    updateAimDisplay();
  });

  function finishAiming(event) {
    if (!state.aiming) return;
    if (event && aimPointerId !== null && event.pointerId !== aimPointerId) return;

    state.aiming = false;
    aimPointerId = null;
  }

  battlefield.addEventListener("pointerup", finishAiming);
  battlefield.addEventListener("pointercancel", finishAiming);

  $("power-slider").addEventListener("input", (event) => {
    state.power = Number(event.target.value);
    updateAimDisplay();
    drawAimPreview();
  });

  /* =====================================================
     MOVEMENT
     ===================================================== */

  function clearMovement() {
    if (state.movementTimer) {
      clearInterval(state.movementTimer);
    }

    state.movementTimer = null;
    state.movementHeld = null;
  }

  function startMovement(direction) {
    if (
      state.screen !== "battle-screen" ||
      state.paused ||
      state.gameOver ||
      state.projectileActive ||
      state.aiming
    ) return;

    if (state.movementRemaining <= 0) {
      showNotice("Movement used for this turn.");
      return;
    }

    const tank = currentTank();
    if (!tank || !tank.alive) return;

    clearMovement();
    state.movementHeld = direction;

    const start = performance.now();

    state.movementTimer = setInterval(() => {
      if (
        state.paused ||
        state.gameOver ||
        state.projectileActive ||
        !state.movementHeld
      ) {
        clearMovement();
        return;
      }

      const now = performance.now();
      const elapsed = Math.min(0.06, (now - start) / 1000);

      if (elapsed <= 0) return;

      const step = Math.min(
        elapsed,
        state.movementRemaining
      );

      const { width } = screenSize();
      const tankWidth = tank.element.offsetWidth || 55;

      tank.x += state.movementHeld * 95 * step;
      tank.x = clamp(
        tank.x,
        tankWidth / 2,
        width - tankWidth / 2
      );

      state.movementRemaining -= step;

      positionTanks();
      drawAimPreview();

      if (state.movementRemaining <= 0) {
        state.movementRemaining = 0;
        clearMovement();
        showNotice("Movement used for this turn.");
      }
    }, 45);
  }

  function stopMovement() {
    clearMovement();
  }

  const leftButton = $("move-left-btn");
  const rightButton = $("move-right-btn");

  function bindMovementButton(button, direction) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      startMovement(direction);
    });

    button.addEventListener("pointerup", stopMovement);
    button.addEventListener("pointercancel", stopMovement);
    button.addEventListener("lostpointercapture", stopMovement);
  }

  bindMovementButton(leftButton, -1);
  bindMovementButton(rightButton, 1);

  /* =====================================================
     SHOOTING AND PROJECTILE PHYSICS
     ===================================================== */

  $("fire-btn").addEventListener("click", fireShot);

  function fireShot() {
    if (
      state.screen !== "battle-screen" ||
      state.paused ||
      state.gameOver ||
      state.projectileActive
    ) return;

    const tank = currentTank();
    if (!tank || !tank.alive) return;

    clearMovement();
    state.aiming = false;
    state.projectileActive = true;

    const origin = getBarrelOrigin(tank);
    const power = state.power / 100;
    const speed = 190 + power * 300;

    const projectile = {
      x: origin.x,
      y: origin.y,
      vx: Math.cos(tank.angle) * speed,
      vy: Math.sin(tank.angle) * speed,
      age: 0,
      element: document.createElement("div"),
      lastSmoke: 0
    };

    projectile.element.className = "projectile";
    $("projectile-layer").appendChild(projectile.element);

    playFireSound();
    drawAimPreview();

    let previousTime = performance.now();

    function animateProjectile(now) {
      if (state.paused || state.gameOver) {
        state.animationFrame = requestAnimationFrame(animateProjectile);
        previousTime = now;
        return;
      }

      const dt = Math.min(0.035, (now - previousTime) / 1000);
      previousTime = now;

      projectile.age += dt;

      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.vy += CONFIG.gravity * dt;

      projectile.element.style.left =
        `${projectile.x - 4}px`;

      projectile.element.style.top =
        `${projectile.y - 4}px`;

      if (projectile.age - projectile.lastSmoke > 0.055) {
        projectile.lastSmoke = projectile.age;
        addSmoke(projectile.x, projectile.y);
      }

      const { width, height } = screenSize();

      if (
        projectile.y >= groundAt(clamp(projectile.x, 0, width)) ||
        projectile.x < 0 ||
        projectile.x > width ||
        projectile.y > height ||
        projectile.age > CONFIG.maxFlightSeconds
      ) {
        projectile.element.remove();
        explodeAt(
          clamp(projectile.x, 0, width),
          clamp(projectile.y, 0, height)
        );
        return;
      }

      state.animationFrame = requestAnimationFrame(animateProjectile);
    }

    state.animationFrame = requestAnimationFrame(animateProjectile);
  }

  function addSmoke(x, y) {
    const smoke = document.createElement("div");
    smoke.className = "projectile-smoke";
    smoke.style.left = `${x - 3}px`;
    smoke.style.top = `${y - 3}px`;

    $("effect-layer").appendChild(smoke);

    smoke.animate(
      [
        { opacity: 0.6, transform: "scale(0.6)" },
        { opacity: 0, transform: "scale(2.3)" }
      ],
      { duration: 450, easing: "ease-out" }
    );

    setTimeout(() => smoke.remove(), 500);
  }

  function explodeAt(x, y) {
    if (state.gameOver) return;

    playExplosionSound();

    const explosion = document.createElement("div");
    explosion.className = "explosion";
    explosion.style.left = `${x - 15}px`;
    explosion.style.top = `${y - 15}px`;

    $("explosion-layer").appendChild(explosion);

    setTimeout(() => explosion.remove(), 500);

    screenShake();
    deformTerrain(x, 55);

    const blastRadius = CONFIG.blastRadius;

    state.tanks.forEach((tank) => {
      if (!tank.alive) return;

      const dx = tank.x - x;
      const dy = (groundAt(tank.x) - 20) - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= blastRadius) {
        const damage = Math.round(
          48 * (1 - distance / blastRadius)
        );

        if (damage > 0) {
          applyDamage(tank, damage, x, y);
        }
      }
    });

    setTimeout(() => {
      if (state.gameOver) return;

      state.projectileActive = false;
      drawAimPreview();

      const defeated = state.tanks.find((tank) => tank.hp <= 0);

      if (defeated) {
        finishMatch(state.tanks[1 - defeated.player]);
      } else {
        endTurn();
      }
    }, CONFIG.effectsDuration);
  }

  function applyDamage(tank, damage, x, y) {
    tank.hp = clamp(tank.hp - damage, 0, CONFIG.maxHP);

    showDamageNumber(tank.x, groundAt(tank.x) - 35, damage);
    updateHUD();

    if (tank.hp <= 0) {
      tank.alive = false;
      tank.element.style.opacity = "0.25";
      showBattleMessage(`${tank.name} DESTROYED!`, 1800);
    }
  }

  function showDamageNumber(x, y, damage) {
    const element = document.createElement("div");
    element.className = "damage-number";
    element.textContent = `-${damage}`;

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;

    $("damage-layer").appendChild(element);

    setTimeout(() => element.remove(), 950);
  }

  function screenShake() {
    battlefield.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: "translate(-3px, 2px)" },
        { transform: "translate(3px, -2px)" },
        { transform: "translate(-2px, -1px)" },
        { transform: "translate(0, 0)" }
      ],
      { duration: 180, iterations: 1 }
    );
  }

  /* =====================================================
     GAME LOOP
     ===================================================== */

  function startGameLoop() {
    stopGameLoop();

    state.lastFrame = performance.now();

    function loop(now) {
      if (state.screen !== "battle-screen" || state.gameOver) {
        state.animationFrame = null;
        return;
      }

      if (!state.paused && !state.projectileActive) {
        drawAimPreview();
      }

      state.animationFrame = requestAnimationFrame(loop);
    }

    state.animationFrame = requestAnimationFrame(loop);
  }

  function stopGameLoop() {
    if (state.animationFrame !== null) {
      cancelAnimationFrame(state.animationFrame);
    }

    state.animationFrame = null;
  }

  /* =====================================================
     PAUSE / RESTART / LEAVE
     ===================================================== */

  $("pause-btn").addEventListener("click", pauseMatch);

  function pauseMatch() {
    if (state.screen !== "battle-screen" || state.gameOver) return;

    state.paused = true;
    clearMovement();
    $("pause-overlay").classList.remove("hidden");
  }

  $("resume-btn").addEventListener("click", () => {
    state.paused = false;
    $("pause-overlay").classList.add("hidden");
    drawAimPreview();
  });

  function askConfirmation(title, message, action) {
    $("confirm-title").textContent = title;
    $("confirm-message").textContent = message;

    state.confirmAction = action;
    $("confirm-overlay").classList.remove("hidden");
  }

  function closeConfirmation() {
    $("confirm-overlay").classList.add("hidden");
    state.confirmAction = null;
  }

  $("confirm-cancel-btn").addEventListener("click", closeConfirmation);

  $("confirm-yes-btn").addEventListener("click", () => {
    const action = state.confirmAction;
    closeConfirmation();

    if (typeof action === "function") action();
  });

  $("restart-btn").addEventListener("click", () => {
    askConfirmation(
      "RESTART MATCH?",
      "The current battle will be lost. Start a new match?",
      () => {
        $("pause-overlay").classList.add("hidden");
        state.paused = false;
        clearLocalMatch();
        startMatch();
      }
    );
  });

  $("leave-match-btn").addEventListener("click", () => {
    askConfirmation(
      "LEAVE MATCH?",
      "Leave the current battle and return to the main menu?",
      () => {
        $("pause-overlay").classList.add("hidden");
        state.paused = false;
        stopGameLoop();
        clearMovement();
        clearLocalMatch();
        showScreen("main-menu");
      }
    );
  });

  /* =====================================================
     VICTORY / REMATCH
     ===================================================== */

  function finishMatch(winner) {
    if (state.gameOver) return;

    state.gameOver = true;
    state.projectileActive = false;
    state.paused = false;

    clearMovement();
    stopGameLoop();

    $("pause-overlay").classList.add("hidden");
    $("confirm-overlay").classList.add("hidden");

    $("victory-title").textContent = winner ? "VICTORY!" : "DRAW!";
    $("winner-name").textContent = winner ? winner.name : "DRAW";
    $("winner-tank").textContent = "🚜";
    $("victory-subtitle").textContent = "BATTLE COMPLETE";

    if (winner) {
      $("winner-name").style.color =
        winner.player === 0 ? "#7ec4ff" : "#ff969d";
    }

    clearLocalMatch();
    showScreen("victory-screen");
  }

  $("rematch-btn").addEventListener("click", () => {
    showScreen("setup-screen");
  });

  $("main-menu-btn").addEventListener("click", () => {
    stopGameLoop();
    clearMovement();
    clearLocalMatch();
    showScreen("main-menu");
  });

  /* =====================================================
     LOCAL SAVE / RESUME
     ===================================================== */

  const SAVE_KEY = "tank-war-local-match";

  function saveLocalMatch() {
    if (
      state.gameOver ||
      !state.tanks.length ||
      state.screen !== "battle-screen"
    ) return;

    try {
      const save = {
        version: 1,
        activePlayer: state.activePlayer,
        round: state.round,
        movementRemaining: state.movementRemaining,
        power: state.power,
        tanks: state.tanks.map((tank) => ({
          player: tank.player,
          name: tank.name,
          choice: tank.choice,
          x: tank.x,
          hp: tank.hp,
          angle: tank.angle,
          alive: tank.alive
        })),
        terrainProfile
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (error) {
      console.warn("Could not save match.", error);
    }
  }

  function clearLocalMatch() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (error) {
      // Storage may be unavailable.
    }
  }

  function restoreLocalMatch() {
    if (state.restorePromptShown) return;

    state.restorePromptShown = true;

    let save;

    try {
      save = JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch (error) {
      return;
    }

    if (
      !save ||
      save.version !== 1 ||
      !Array.isArray(save.tanks) ||
      save.tanks.length !== 2
    ) return;

    const resume = window.confirm(
      "A saved Tank War match was found. Resume it?"
    );

    if (!resume) {
      clearLocalMatch();
      return;
    }

    state.activePlayer = clamp(Number(save.activePlayer) || 0, 0, 1);
    state.round = Math.max(1, Number(save.round) || 1);
    state.movementRemaining = clamp(
      Number(save.movementRemaining) || CONFIG.moveSeconds,
      0,
      CONFIG.moveSeconds
    );

    state.power = clamp(
      Number(save.power) || CONFIG.defaultPower,
      CONFIG.minPower,
      CONFIG.maxPower
    );

    state.tanks = save.tanks.map((savedTank, index) => {
      const tank = createTank(
        index,
        String(savedTank.name || `Player ${index + 1}`).slice(0, 16),
        clamp(Number(savedTank.choice) || 0, 0, TANKS.length - 1),
        Number(savedTank.x) || screenSize().width * (index === 0 ? 0.17 : 0.83),
        index === 0 ? 1 : -1
      );

      tank.hp = clamp(Number(savedTank.hp), 0, CONFIG.maxHP);
      tank.angle = Number(savedTank.angle) || 0;
      tank.alive = savedTank.alive !== false;

      return tank;
    });

    if (Array.isArray(save.terrainProfile)) {
      terrainProfile = save.terrainProfile
        .filter((point) =>
          Number.isFinite(point.x) && Number.isFinite(point.y)
        )
        .map((point) => ({ x: point.x, y: point.y }));
    }

    state.gameOver = false;
    state.paused = false;
    state.projectileActive = false;

    showScreen("battle-screen");
    $("power-slider").value = state.power;

    resizeCanvases();
    positionTanks();
    updateHUD();
    updateAimDisplay();
    startGameLoop();
    beginTurn();

    showNotice("Match resumed.");
  }

  /* =====================================================
     KEYBOARD SUPPORT
     ===================================================== */

  window.addEventListener("keydown", (event) => {
    if (state.screen !== "battle-screen" || state.paused) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (!event.repeat) startMovement(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (!event.repeat) startMovement(1);
    }

    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) fireShot();
    }

    if (event.key === "Escape") {
      pauseMatch();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      stopMovement();
    }
  });

  /* =====================================================
     INITIALIZE
     ===================================================== */

  function initialize() {
    updateTankChoice(0);
    updateTankChoice(1);
    syncSettingsUI();

    state.tanks = [];
    showScreen("main-menu");

    $("pause-overlay").classList.add("hidden");
    $("confirm-overlay").classList.add("hidden");

    restoreLocalMatch();

    console.log("Tank War initialized.");
  }

  initialize();
})();
