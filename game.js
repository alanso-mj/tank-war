/* =====================================================
   TANK WAR — GAME ENGINE
   Fixed battlefield initialization
   Local multiplayer — no Firebase
   ===================================================== */

"use strict";

(() => {
  const $ = id => document.getElementById(id);

  const CONFIG = {
    maxHP: 100,
    moveSeconds: 3,
    gravity: 430,
    blastRadius: 105,
    maxFlightSeconds: 7,
    turnDelay: 1000,
    explosionDuration: 700
  };

  const TANKS = [
    { name: "STRIKER", body: "#287fce", turret: "#3b9ce9" },
    { name: "GUARDIAN", body: "#44815c", turret: "#70b981" }
  ];

  const SCREEN_IDS = [
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

  const state = {
    screen: "main-menu",
    tanks: [],
    tankChoices: [0, 0],
    activePlayer: 0,
    round: 1,
    power: 60,
    paused: false,
    gameOver: false,
    projectileActive: false,
    aiming: false,
    aimPointerId: null,
    movementHeld: null,
    movementRemaining: CONFIG.moveSeconds,
    movementTimer: null,
    animationFrame: null,
    turnTimer: null,
    countdownTimer: null,
    noticeTimer: null,
    messageTimer: null,
    confirmAction: null,
    audioContext: null,
    masterVolume: 0.7,
    musicEnabled: true,
    effectsEnabled: true
  };

  const battlefield = $("battlefield");
  const terrainCanvas = $("terrain-canvas");
  const aimCanvas = $("aim-canvas");

  const terrainContext = terrainCanvas.getContext("2d");
  const aimContext = aimCanvas.getContext("2d");

  let terrainProfile = [];

  /* =====================================================
     UTILITIES
     ===================================================== */

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function screenSize() {
    const rect = battlefield.getBoundingClientRect();

    return {
      width: rect.width,
      height: rect.height
    };
  }

  function showScreen(id) {
    SCREEN_IDS.forEach(screenId => {
      const element = $(screenId);

      if (element) {
        element.classList.toggle("active", screenId === id);
      }
    });

    state.screen = id;
  }

  function showNotice(message, duration = 2200) {
    const element = $("global-notice");

    element.textContent = message;
    element.classList.add("visible");

    clearTimeout(state.noticeTimer);

    state.noticeTimer = setTimeout(() => {
      element.classList.remove("visible");
    }, duration);
  }

  function showBattleMessage(message, duration = 1500) {
    const element = $("battle-message");

    element.textContent = message;

    clearTimeout(state.messageTimer);

    state.messageTimer = setTimeout(() => {
      element.textContent = "";
    }, duration);
  }

  function getNickname(id, fallback) {
    return $(id).value.trim().slice(0, 16) || fallback;
  }

  function currentTank() {
    return state.tanks[state.activePlayer];
  }

  function otherTank() {
    return state.tanks[1 - state.activePlayer];
  }

  /* =====================================================
     MENU NAVIGATION
     ===================================================== */

  $("play-btn").addEventListener("click", () => {
    showScreen("mode-screen");
    playMenuSound();
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
    showNotice("Online multiplayer is coming later.");
  });

  document.querySelectorAll("[data-back]").forEach(button => {
    button.addEventListener("click", () => {
      showScreen(button.dataset.back);
    });
  });

  $("how-to-back-btn").addEventListener("click", () => {
    showScreen("main-menu");
  });

  let settingsReturnScreen = "main-menu";

  function openSettings(returnScreen) {
    settingsReturnScreen = returnScreen;

    $("master-volume").value =
      Math.round(state.masterVolume * 100);

    $("volume-value").textContent =
      `${Math.round(state.masterVolume * 100)}%`;

    $("music-toggle").checked = state.musicEnabled;
    $("effects-toggle").checked = state.effectsEnabled;

    showScreen("settings-screen");
  }

  $("settings-back-btn").addEventListener("click", () => {
    showScreen(settingsReturnScreen);
  });

  $("pause-settings-btn").addEventListener("click", () => {
    openSettings("battle-screen");
  });

  /* =====================================================
     SETTINGS AND AUDIO
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

    oscillator.frequency.setValueAtTime(
      frequency,
      context.currentTime
    );

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
    if (state.musicEnabled) {
      playTone(440, 0.08, 0.04);
    }
  }

  function playFireSound() {
    playTone(95, 0.28, 0.22, "sawtooth");
  }

  function playExplosionSound() {
    playTone(55, 0.42, 0.28, "triangle");

    setTimeout(() => {
      playTone(38, 0.28, 0.12);
    }, 70);
  }

  $("master-volume").addEventListener("input", event => {
    state.masterVolume = Number(event.target.value) / 100;

    $("volume-value").textContent = `${event.target.value}%`;
  });

  $("music-toggle").addEventListener("change", event => {
    state.musicEnabled = event.target.checked;
  });

  $("effects-toggle").addEventListener("change", event => {
    state.effectsEnabled = event.target.checked;
  });

  /* =====================================================
     TANK SELECTION
     ===================================================== */

  function updateTankChoice(player) {
    const index = state.tankChoices[player];
    const selectedTank = TANKS[index];

    $(`tank${player + 1}-name`).textContent =
      `${player === 0 ? "BLUE" : "RED"} ${selectedTank.name}`;

    const preview = $(`tank${player + 1}-preview`);

    preview.querySelector(".preview-body").style.background =
      selectedTank.body;

    preview.querySelector(".preview-turret").style.background =
      selectedTank.turret;
  }

  function changeTankChoice(player, direction) {
    state.tankChoices[player] =
      (state.tankChoices[player] + direction + TANKS.length) %
      TANKS.length;

    updateTankChoice(player);
  }

  $("tank1-prev").addEventListener("click", () => {
    changeTankChoice(0, -1);
  });

  $("tank1-next").addEventListener("click", () => {
    changeTankChoice(0, 1);
  });

  $("tank2-prev").addEventListener("click", () => {
    changeTankChoice(1, -1);
  });

  $("tank2-next").addEventListener("click", () => {
    changeTankChoice(1, 1);
  });

  /* =====================================================
     MATCH SETUP
     ===================================================== */

  $("start-battle-btn").addEventListener("click", startMatch);

  function createTank(player, name, choice, x) {
    return {
      player,
      name,
      choice,
      x,
      y: 0,
      angle: player === 0 ? -0.45 : Math.PI - 0.45,
      hp: CONFIG.maxHP,
      alive: true,
      element: $(`tank${player + 1}`)
    };
  }

  function startMatch() {
    clearTimeout(state.turnTimer);
    clearInterval(state.countdownTimer);

    stopMovement();
    stopGameLoop();

    state.activePlayer = Math.random() < 0.5 ? 0 : 1;
    state.round = 1;
    state.gameOver = false;
    state.paused = false;
    state.projectileActive = false;
    state.aiming = false;
    state.movementRemaining = CONFIG.moveSeconds;
    state.power = 60;

    /*
      IMPORTANT FIX:
      Do not measure the battlefield here.
      The battle screen is hidden during setup,
      so its width and height may be zero.
    */

    state.tanks = [
      createTank(
        0,
        getNickname("player1-name", "Blue Player"),
        state.tankChoices[0],
        0
      ),
      createTank(
        1,
        getNickname("player2-name", "Red Player"),
        state.tankChoices[1],
        0
      )
    ];

    $("hud-name1").textContent = state.tanks[0].name;
    $("hud-name2").textContent = state.tanks[1].name;

    $("power-slider").value = state.power;
    $("power-value").textContent = `${state.power}%`;

    $("pause-overlay").classList.add("hidden");
    $("confirm-overlay").classList.add("hidden");

    clearBattleEffects();

    showScreen("vs-screen");
    runCountdown();
  }

  function runCountdown() {
    clearInterval(state.countdownTimer);

    let count = 3;

    $("vs-countdown").textContent = count;
    $("vs-name1").textContent = state.tanks[0].name;
    $("vs-name2").textContent = state.tanks[1].name;

    state.countdownTimer = setInterval(() => {
      count--;

      if (count > 0) {
        $("vs-countdown").textContent = count;
        return;
      }

      clearInterval(state.countdownTimer);

      $("vs-countdown").textContent = "FIRE!";

      /*
        Reveal the battlefield FIRST.
        Then wait for the browser to lay it out.
        Only then calculate tank and terrain positions.
      */

      showScreen("battle-screen");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (state.screen !== "battle-screen") return;
          if (state.gameOver) return;

          initializeBattlefield();

          startGameLoop();
          beginTurn();
        });
      });
    }, 1000);
  }

  /* =====================================================
     BATTLEFIELD INITIALIZATION — TANK VISIBILITY FIX
     ===================================================== */

  function initializeBattlefield() {
    const { width, height } = screenSize();

    /*
      This function runs only after the battle screen
      has become visible. The dimensions must be positive.
    */

    if (width <= 0 || height <= 0) {
      console.error("Battlefield has invalid dimensions.", width, height);

      showNotice("Battlefield loading failed. Please refresh.");
      return;
    }

    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    [terrainCanvas, aimCanvas].forEach(canvas => {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      canvas.getContext("2d").setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0
      );
    });

    /*
      Generate terrain using the real battlefield dimensions.
    */

    terrainProfile = [];

    const groundY = height * 0.78;
    const pointCount = Math.max(30, Math.ceil(width / 8));

    for (let i = 0; i <= pointCount; i++) {
      const x = (i / pointCount) * width;

      const hills =
        Math.sin(i * 0.31) * height * 0.012 +
        Math.sin(i * 0.13) * height * 0.009;

      terrainProfile.push({
        x,
        y: groundY + hills
      });
    }

    /*
      Place both tanks using the now-visible battlefield size.
    */

    state.tanks[0].x = width * 0.17;
    state.tanks[1].x = width * 0.83;

    state.tanks.forEach(tank => {
      tank.hp = CONFIG.maxHP;
      tank.alive = true;

      tank.element.style.display = "block";
      tank.element.style.visibility = "visible";
      tank.element.style.position = "absolute";
      tank.element.style.zIndex = "10";
      tank.element.style.opacity = "1";
    });

    drawTerrain();
    positionTanks();
    updateHUD();
    updateAimDisplay();
    drawAimPreview();
  }

  /* =====================================================
     TERRAIN
     ===================================================== */

  function groundAt(x) {
    if (!terrainProfile.length) {
      return screenSize().height * 0.78;
    }

    x = clamp(x, 0, screenSize().width);

    for (let i = 1; i < terrainProfile.length; i++) {
      if (terrainProfile[i].x >= x) {
        const a = terrainProfile[i - 1];
        const b = terrainProfile[i];

        const distance = Math.max(1, b.x - a.x);
        const fraction = (x - a.x) / distance;

        return a.y + (b.y - a.y) * fraction;
      }
    }

    return terrainProfile[terrainProfile.length - 1].y;
  }

  function drawTerrain() {
    const { width, height } = screenSize();

    terrainContext.clearRect(0, 0, width, height);

    if (!terrainProfile.length || width <= 0 || height <= 0) {
      return;
    }

    terrainContext.beginPath();
    terrainContext.moveTo(0, height);

    terrainProfile.forEach(point => {
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

    terrainContext.beginPath();

    terrainProfile.forEach((point, index) => {
      if (index === 0) {
        terrainContext.moveTo(point.x, point.y);
      } else {
        terrainContext.lineTo(point.x, point.y);
      }
    });

    terrainContext.strokeStyle = "#efbd78";
    terrainContext.lineWidth = 3;
    terrainContext.stroke();

    /*
      Fixed terrain details: no random changes each frame.
    */

    terrainContext.globalAlpha = 0.16;
    terrainContext.strokeStyle = "#4e3024";
    terrainContext.lineWidth = 1;

    for (let i = 0; i < 90; i++) {
      const x = (i / 90) * width;
      const y = groundAt(x) + (i % 5) * 5;

      terrainContext.beginPath();
      terrainContext.moveTo(x, y);
      terrainContext.lineTo(x + 5 + (i % 7), y + 1);
      terrainContext.stroke();
    }

    terrainContext.globalAlpha = 1;
  }

  function deformTerrain(centerX, radius) {
    const { width, height } = screenSize();

    if (!terrainProfile.length) return;

    centerX = clamp(centerX, 0, width);

    const depth = Math.min(25, height * 0.045);

    terrainProfile = terrainProfile.map(point => {
      const distance = Math.abs(point.x - centerX);

      if (distance >= radius) return point;

      const influence = 1 - distance / radius;

      return {
        x: point.x,
        y: Math.min(
          height,
          point.y + depth * influence * influence
        )
      };
    });

    drawTerrain();
    positionTanks();
  }

  /* =====================================================
     TANK POSITIONING
     ===================================================== */

  function positionTanks() {
    if (!state.tanks.length) return;

    const { width } = screenSize();

    if (width <= 0) return;

    state.tanks.forEach(tank => {
      const element = tank.element;

      if (!element) return;

      const tankWidth = element.offsetWidth || 55;
      const tankHeight = element.offsetHeight || 35;

      tank.x = clamp(
        tank.x,
        tankWidth / 2,
        width - tankWidth / 2
      );

      tank.y = groundAt(tank.x);

      element.style.display = "block";
      element.style.visibility = "visible";
      element.style.position = "absolute";

      element.style.left =
        `${tank.x - tankWidth / 2}px`;

      element.style.top =
        `${tank.y - tankHeight}px`;

      element.style.opacity = tank.alive ? "1" : "0.25";

      const turret = element.querySelector(".tank-turret");

      if (turret) {
        turret.style.transform = `rotate(${tank.angle}rad)`;
      }
    });
  }

  window.addEventListener("resize", () => {
    if (state.screen !== "battle-screen") return;

    /*
      Preserve the tanks' approximate battlefield positions
      when the screen changes size.
    */

    const { width, height } = screenSize();

    if (width <= 0 || height <= 0) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    [terrainCanvas, aimCanvas].forEach(canvas => {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      canvas.getContext("2d").setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0
      );
    });

    if (terrainProfile.length) {
      const oldWidth = terrainProfile[terrainProfile.length - 1].x;

      if (oldWidth > 0) {
        const scale = width / oldWidth;

        terrainProfile = terrainProfile.map(point => ({
          x: point.x * scale,
          y: point.y * (height / Math.max(1, height))
        }));
      }
    } else {
      const groundY = height * 0.78;

      terrainProfile = [
        { x: 0, y: groundY },
        { x: width, y: groundY }
      ];
    }

    drawTerrain();
    positionTanks();
    drawAimPreview();
  });

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

    const tank = currentTank();

    if (tank) {
      $("turn-indicator").textContent =
        `${tank.name.toUpperCase()}'S TURN`;

      $("turn-indicator").style.color =
        tank.player === 0 ? "#7ec4ff" : "#ff969d";
    }
  }

  function updateAimDisplay() {
    $("angle-value").textContent =
      `${Math.round(Math.abs(state.tanks[state.activePlayer]?.angle || 0) * 180 / Math.PI)}°`;

    $("power-value").textContent = `${state.power}%`;
  }

  /* =====================================================
     TURNS
     ===================================================== */

  function beginTurn() {
    if (state.gameOver || state.paused) return;

    stopMovement();

    state.projectileActive = false;
    state.aiming = false;
    state.movementRemaining = CONFIG.moveSeconds;

    const tank = currentTank();
    const target = otherTank();

    if (!tank || !tank.alive) {
      finishMatch(target);
      return;
    }

    /*
      Start with the cannon aimed generally toward
      the opposing tank.
    */

    const dx = target.x - tank.x;
    const dy = groundAt(target.x) - groundAt(tank.x);

    tank.angle = Math.atan2(dy - 25, dx);

    positionTanks();
    updateHUD();
    updateAimDisplay();
    drawAimPreview();

    showBattleMessage(`${tank.name}'S TURN`);

    saveMatch();
  }

  function endTurn() {
    if (state.gameOver || state.paused) return;

    stopMovement();

    state.activePlayer = 1 - state.activePlayer;

    if (state.activePlayer === 0) {
      state.round++;
    }

    clearTimeout(state.turnTimer);

    state.turnTimer = setTimeout(() => {
      if (!state.gameOver && !state.paused) {
        beginTurn();
      }
    }, CONFIG.turnDelay);
  }

  /* =====================================================
     AIMING
     ===================================================== */

  function getBarrelOrigin(tank) {
    const direction = Math.cos(tank.angle) >= 0 ? 1 : -1;

    return {
      x: tank.x + direction * 15,
      y: groundAt(tank.x) - 23
    };
  }

  function calculateAimAngle(x, y, tank) {
    const origin = getBarrelOrigin(tank);

    let angle = Math.atan2(
      y - origin.y,
      x - origin.x
    );

    if (tank.player === 0) {
      angle = clamp(
        angle,
        -Math.PI * 0.48,
        Math.PI * 0.48
      );
    } else {
      if (angle < 0) angle += Math.PI * 2;

      angle = clamp(
        angle,
        Math.PI * 0.52,
        Math.PI * 1.48
      );
    }

    return angle;
  }

  function drawAimPreview() {
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
    const speed = 190 + (state.power / 100) * 300;

    const vx = Math.cos(tank.angle) * speed;
    const vy = Math.sin(tank.angle) * speed;

    aimContext.save();
    aimContext.setLineDash([3, 6]);
    aimContext.lineWidth = 2;
    aimContext.strokeStyle = "rgba(255,255,255,0.75)";

    aimContext.beginPath();
    aimContext.moveTo(origin.x, origin.y);

    let lastX = origin.x;
    let lastY = origin.y;

    for (let t = 0.04; t < 3; t += 0.04) {
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
    aimContext.fillStyle = "#fff";
    aimContext.fill();

    aimContext.restore();
  }

  battlefield.addEventListener("pointerdown", event => {
    if (
      state.screen !== "battle-screen" ||
      state.paused ||
      state.gameOver ||
      state.projectileActive
    ) return;

    if (
      event.target.closest(
        ".battle-controls, .battle-hud, button, input"
      )
    ) return;

    const rect = battlefield.getBoundingClientRect();
    const tank = currentTank();

    if (!tank) return;

    state.aiming = true;
    state.aimPointerId = event.pointerId;

    state.aimAngle = calculateAimAngle(
      event.clientX - rect.left,
      event.clientY - rect.top,
      tank
    );

    tank.angle = state.aimAngle;

    positionTanks();
    updateAimDisplay();
    drawAimPreview();
  });

  battlefield.addEventListener("pointermove", event => {
    if (
      !state.aiming ||
      event.pointerId !== state.aimPointerId
    ) return;

    const rect = battlefield.getBoundingClientRect();
    const tank = currentTank();

    if (!tank) return;

    tank.angle = calculateAimAngle(
      event.clientX - rect.left,
      event.clientY - rect.top,
      tank
    );

    state.aimAngle = tank.angle;

    positionTanks();
    updateAimDisplay();
    drawAimPreview();
  });

  function finishAiming(event) {
    if (!state.aiming) return;

    if (
      event &&
      state.aimPointerId !== undefined &&
      event.pointerId !== state.aimPointerId
    ) return;

    state.aiming = false;
    state.aimPointerId = null;
  }

  battlefield.addEventListener("pointerup", finishAiming);
  battlefield.addEventListener("pointercancel", finishAiming);

  $("power-slider").addEventListener("input", event => {
    state.power = Number(event.target.value);

    updateAimDisplay();
    drawAimPreview();
  });

  /* =====================================================
     MOVEMENT
     ===================================================== */

  function stopMovement() {
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

    stopMovement();

    state.movementHeld = direction;

    let previousTime = performance.now();

    state.movementTimer = setInterval(() => {
      if (
        state.paused ||
        state.gameOver ||
        state.projectileActive ||
        !state.movementHeld
      ) {
        stopMovement();
        return;
      }

      const now = performance.now();

      const dt = Math.min(
        0.06,
        (now - previousTime) / 1000
      );

      previousTime = now;

      const step = Math.min(
        dt,
        state.movementRemaining
      );

      const { width } = screenSize();

      tank.x += state.movementHeld * 95 * step;

      const tankWidth = tank.element.offsetWidth || 55;

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

        stopMovement();

        showNotice("Movement used for this turn.");
      }
    }, 45);
  }

  function bindMovementButton(button, direction) {
    button.addEventListener("pointerdown", event => {
      event.preventDefault();

      button.setPointerCapture?.(event.pointerId);

      startMovement(direction);
    });

    button.addEventListener("pointerup", stopMovement);
    button.addEventListener("pointercancel", stopMovement);
    button.addEventListener("lostpointercapture", stopMovement);
  }

  bindMovementButton($("move-left-btn"), -1);
  bindMovementButton($("move-right-btn"), 1);

  /* =====================================================
     PROJECTILES
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

    stopMovement();

    state.aiming = false;
    state.projectileActive = true;

    const origin = getBarrelOrigin(tank);
    const speed = 190 + (state.power / 100) * 300;

    const projectile = {
      x: origin.x,
      y: origin.y,
      vx: Math.cos(tank.angle) * speed,
      vy: Math.sin(tank.angle) * speed,
      age: 0,
      lastSmoke: 0,
      element: document.createElement("div")
    };

    projectile.element.className = "projectile";

    $("projectile-layer").appendChild(projectile.element);

    playFireSound();
    drawAimPreview();

    let previousTime = performance.now();

    function animate(now) {
      if (state.gameOver) return;

      if (state.paused) {
        state.animationFrame = requestAnimationFrame(animate);
        previousTime = now;
        return;
      }

      const dt = Math.min(
        0.035,
        (now - previousTime) / 1000
      );

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

      const impact =
        projectile.y >= groundAt(clamp(projectile.x, 0, width)) ||
        projectile.x < 0 ||
        projectile.x > width ||
        projectile.y > height ||
        projectile.age > CONFIG.maxFlightSeconds;

      if (impact) {
        projectile.element.remove();

        explodeAt(
          clamp(projectile.x, 0, width),
          clamp(projectile.y, 0, height)
        );

        return;
      }

      state.animationFrame = requestAnimationFrame(animate);
    }

    state.animationFrame = requestAnimationFrame(animate);
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
      {
        duration: 450,
        easing: "ease-out"
      }
    );

    setTimeout(() => smoke.remove(), 500);
  }

  /* =====================================================
     EXPLOSIONS AND DAMAGE
     ===================================================== */

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

    state.tanks.forEach(tank => {
      if (!tank.alive) return;

      const dx = tank.x - x;
      const dy = groundAt(tank.x) - 20 - y;

      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= CONFIG.blastRadius) {
        const damage = Math.round(
          48 * (1 - distance / CONFIG.blastRadius)
        );

        if (damage > 0) {
          applyDamage(tank, damage);
        }
      }
    });

    state.turnTimer = setTimeout(() => {
      if (state.gameOver) return;

      state.projectileActive = false;

      const defeated = state.tanks.find(tank => tank.hp <= 0);

      if (defeated) {
        finishMatch(state.tanks[1 - defeated.player]);
      } else {
        endTurn();
      }
    }, CONFIG.explosionDuration);
  }

  function applyDamage(tank, damage) {
    tank.hp = clamp(
      tank.hp - damage,
      0,
      CONFIG.maxHP
    );

    showDamageNumber(
      tank.x,
      groundAt(tank.x) - 35,
      damage
    );

    updateHUD();

    if (tank.hp <= 0) {
      tank.alive = false;

      tank.element.style.opacity = "0.25";

      showBattleMessage(`${tank.name} DESTROYED!`);
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
        { transform: "translate(0,0)" },
        { transform: "translate(-3px,2px)" },
        { transform: "translate(3px,-2px)" },
        { transform: "translate(-2px,-1px)" },
        { transform: "translate(0,0)" }
      ],
      { duration: 180 }
    );
  }

  /* =====================================================
     GAME LOOP
     ===================================================== */

  function startGameLoop() {
    stopGameLoop();

    function loop() {
      if (
        state.screen !== "battle-screen" ||
        state.gameOver
      ) {
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

  function clearBattleEffects() {
    [
      "projectile-layer",
      "explosion-layer",
      "damage-layer",
      "effect-layer"
    ].forEach(id => {
      $(id).replaceChildren();
    });

    aimContext.clearRect(
      0,
      0,
      aimCanvas.width,
      aimCanvas.height
    );
  }

  /* =====================================================
     PAUSE / RESTART / LEAVE
     ===================================================== */

  $("pause-btn").addEventListener("click", pauseMatch);

  function pauseMatch() {
    if (
      state.screen !== "battle-screen" ||
      state.gameOver
    ) return;

    state.paused = true;

    stopMovement();

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

    if (typeof action === "function") {
      action();
    }
  });

  $("restart-btn").addEventListener("click", () => {
    askConfirmation(
      "RESTART MATCH?",
      "The current battle will be lost. Start again?",
      () => {
        $("pause-overlay").classList.add("hidden");

        state.paused = false;

        clearMatchSave();

        startMatch();
      }
    );
  });

  $("leave-match-btn").addEventListener("click", () => {
    askConfirmation(
      "LEAVE MATCH?",
      "Return to the main menu?",
      () => {
        $("pause-overlay").classList.add("hidden");

        state.paused = false;

        stopMovement();
        stopGameLoop();

        clearMatchSave();

        showScreen("main-menu");
      }
    );
  });

  /* =====================================================
     VICTORY
     ===================================================== */

  function finishMatch(winner) {
    if (state.gameOver) return;

    state.gameOver = true;
    state.paused = false;
    state.projectileActive = false;

    stopMovement();
    stopGameLoop();

    $("pause-overlay").classList.add("hidden");
    $("confirm-overlay").classList.add("hidden");

    $("victory-title").textContent = winner
      ? "VICTORY!"
      : "DRAW!";

    $("winner-name").textContent = winner
      ? winner.name
      : "DRAW";

    $("winner-tank").textContent = "🚜";

    $("victory-subtitle").textContent = "BATTLE COMPLETE";

    if (winner) {
      $("winner-name").style.color =
        winner.player === 0 ? "#7ec4ff" : "#ff969d";
    }

    clearMatchSave();

    showScreen("victory-screen");
  }

  $("rematch-btn").addEventListener("click", () => {
    showScreen("setup-screen");
  });

  $("main-menu-btn").addEventListener("click", () => {
    stopMovement();
    stopGameLoop();

    clearMatchSave();

    showScreen("main-menu");
  });

  /* =====================================================
     LOCAL SAVE
     ===================================================== */

  const SAVE_KEY = "tank-war-local-match";

  function saveMatch() {
    if (
      state.gameOver ||
      !state.tanks.length ||
      state.screen !== "battle-screen"
    ) return;

    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          version: 1,
          activePlayer: state.activePlayer,
          round: state.round,
          power: state.power,
          movementRemaining: state.movementRemaining,
          tanks: state.tanks.map(tank => ({
            player: tank.player,
            name: tank.name,
            choice: tank.choice,
            x: tank.x,
            hp: tank.hp,
            angle: tank.angle,
            alive: tank.alive
          })),
          terrainProfile
        })
      );
    } catch (error) {
      console.warn("Could not save match.", error);
    }
  }

  function clearMatchSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (error) {
      // Storage may be unavailable.
    }
  }

  /* =====================================================
     KEYBOARD SUPPORT
     ===================================================== */

  window.addEventListener("keydown", event => {
    if (
      state.screen !== "battle-screen" ||
      state.paused
    ) return;

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

  window.addEventListener("keyup", event => {
    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight"
    ) {
      stopMovement();
    }
  });

  /* =====================================================
     INITIALIZE
     ===================================================== */

  function initialize() {
    updateTankChoice(0);
    updateTankChoice(1);

    $("pause-overlay").classList.add("hidden");
    $("confirm-overlay").classList.add("hidden");

    showScreen("main-menu");

    console.log("Tank War ready.");
  }

  initialize();
})();
