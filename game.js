"use strict";

/* =========================================
   TANK WAR V2 — GAME ENGINE
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);

  const screenIds = [
    "main-menu",
    "mode-screen",
    "local-setup-screen",
    "vs-screen",
    "battle-screen",
    "online-screen",
    "settings-screen",
    "how-to-screen"
  ];

  const SAVE_KEY = "tankWarV2LocalMatch";
  const SETTINGS_KEY = "tankWarV2Settings";

  const CONFIG = {
    startingHP: 100,
    movementSeconds: 3,
    movementSpeed: 13,
    minTankGap: 10,
    shellRadius: 10,
    gravity: 330,
    minimumPower: 10,
    maximumPower: 100,
    explosionRadius: 105,
    maximumDamage: 45,
    directHitBonus: 0
  };

  const game = {
    players: [],
    current: 0,
    movementLeft: CONFIG.movementSeconds,
    movingDirection: 0,
    movementTimer: null,
    aimPointer: null,
    aimStart: null,
    paused: false,
    projectileActive: false,
    matchActive: false,
    angle: 45,
    power: 50,
    soundEnabled: true,
    effectsEnabled: true,
    audioContext: null,
    animationFrame: null,
    lastFrame: 0,
    settings: {
      musicVolume: 60,
      effectsVolume: 80,
      musicEnabled: true,
      effectsEnabled: true
    }
  };

  /* =========================================
     SCREEN NAVIGATION
     ========================================= */

  function showScreen(id) {
    if (!screenIds.includes(id)) return;

    for (const screenId of screenIds) {
      const screen = $(screenId);
      if (!screen) continue;

      screen.classList.remove("active");
      screen.setAttribute("aria-hidden", "true");
    }

    const target = $(id);
    if (!target) return;

    target.classList.add("active");
    target.setAttribute("aria-hidden", "false");
  }

  function setMessage(message) {
    $("battle-message").textContent = message;
  }

  /* =========================================
     PLAYER AND TANK STATE
     ========================================= */

  function createPlayer(name, tank, x, facing) {
    return {
      name,
      tank,
      hp: CONFIG.startingHP,
      x,
      facing,
      angle: 45,
      power: 50,
      moved: 0
    };
  }

  function currentPlayer() {
    return game.players[game.current];
  }

  function opponentPlayer() {
    return game.players[1 - game.current];
  }

  function tankElement(index) {
    return $("tank" + (index + 1));
  }

  function barrelElement(index) {
    return tankElement(index).querySelector(".tank-turret");
  }

  function setTankAppearance(index, tank) {
    const element = tankElement(index);
    element.classList.remove(
      "tank-blue",
      "tank-red",
      "tank-heavy"
    );

    if (index === 0) {
      element.classList.add("tank-blue");
    } else {
      element.classList.add("tank-red");
    }

    if (tank.includes("heavy")) {
      element.classList.add("tank-heavy");
    }
  }

  function updateTankPositions() {
    game.players.forEach((player, index) => {
      const element = tankElement(index);

      element.style.left = player.x + "%";
      element.style.right = "auto";
      element.style.transform = "none";

      // The body stays horizontal; only the turret rotates.
      const turret = barrelElement(index);
      const signedAngle = player.facing === 1
        ? player.angle
        : 180 - player.angle;

      turret.style.transform = `rotate(${-signedAngle}deg)`;

      setTankAppearance(index, player.tank);
    });
  }

  /* =========================================
     HEALTH AND HUD
     ========================================= */

  function updateHealthBar(element, hp) {
    const safeHP = Math.max(0, Math.min(100, hp));

    element.style.width = safeHP + "%";

    if (safeHP > 60) {
      element.style.background = "#36d982";
    } else if (safeHP > 30) {
      element.style.background = "#ffd34d";
    } else {
      element.style.background = "#ed4942";
    }
  }

  function updateHUD() {
    if (game.players.length !== 2) return;

    game.players.forEach((player, index) => {
      const number = index + 1;

      $("battle-name" + number).textContent = player.name;
      $("hp-text" + number).textContent = player.hp + " HP";

      updateHealthBar(
        $("health" + number),
        player.hp
      );
    });

    $("turn-indicator").textContent =
      currentPlayer().name;

    $("movement-remaining").textContent =
      game.movementLeft.toFixed(1) + "s";

    $("angle-display").textContent =
      Math.round(currentPlayer().angle) + "°";

    $("power-display").textContent =
      Math.round(game.power) + "%";

    $("angle-value").textContent =
      Math.round(currentPlayer().angle) + "°";

    $("power-value").textContent =
      Math.round(game.power) + "%";

    $("move-left-btn").disabled =
      !game.matchActive ||
      game.paused ||
      game.projectileActive ||
      game.movementLeft <= 0;

    $("move-right-btn").disabled =
      !game.matchActive ||
      game.paused ||
      game.projectileActive ||
      game.movementLeft <= 0;

    $("fire-btn").disabled =
      !game.matchActive ||
      game.paused ||
      game.projectileActive;

    $("power-slider").disabled =
      !game.matchActive ||
      game.paused ||
      game.projectileActive;
  }

  /* =========================================
     LOCAL MATCH SETUP
     ========================================= */

  function setupVersusScreen() {
    const name1 =
      $("player1-name").value.trim() || "PLAYER 1";

    const name2 =
      $("player2-name").value.trim() || "PLAYER 2";

    if (name1.toLowerCase() === name2.toLowerCase()) {
      alert("Please choose different nicknames.");
      return false;
    }

    $("vs-player1-name").textContent = name1;
    $("vs-player2-name").textContent = name2;

    const tank1 = $("tank1-select").value;
    const tank2 = $("tank2-select").value;

    $("vs-tank1").textContent =
      tank1.includes("heavy") ? "🔵" : "🔷";

    $("vs-tank2").textContent =
      tank2.includes("heavy") ? "🔴" : "🔶";

    game.players = [
      createPlayer(name1, tank1, 10, 1),
      createPlayer(name2, tank2, 78, -1)
    ];

    return true;
  }

  function startNewBattle() {
    stopMovement();
    stopProjectileAnimation();

    if (game.players.length !== 2) {
      if (!setupVersusScreen()) return;
    }

    game.players.forEach((player, index) => {
      player.hp = CONFIG.startingHP;
      player.x = index === 0 ? 10 : 78;
      player.angle = 45;
      player.power = 50;
      player.moved = 0;
    });

    game.current = 0;
    game.movementLeft = CONFIG.movementSeconds;
    game.angle = 45;
    game.power = 50;
    game.paused = false;
    game.projectileActive = false;
    game.matchActive = true;

    $("power-slider").value = 50;

    $("pause-overlay").hidden = true;
    $("victory-overlay").hidden = true;
    $("leave-overlay").hidden = true;

    updateTankPositions();
    updateHUD();

    $("aim-indicator").hidden = true;

    setMessage(
      currentPlayer().name + ": AIM, MOVE AND FIRE"
    );

    showScreen("battle-screen");
    saveMatch();
  }

  /* =========================================
     MOVEMENT
     ========================================= */

  function stopMovement() {
    if (game.movementTimer !== null) {
      clearInterval(game.movementTimer);
      game.movementTimer = null;
    }

    game.movingDirection = 0;
  }

  function startMovement(direction) {
    if (
      !game.matchActive ||
      game.paused ||
      game.projectileActive ||
      game.movementLeft <= 0 ||
      game.movementTimer !== null
    ) {
      return;
    }

    game.movingDirection = direction;

    game.movementTimer = setInterval(() => {
      if (
        game.paused ||
        !game.matchActive ||
        game.projectileActive
      ) {
        stopMovement();
        return;
      }

      const player = currentPlayer();
      const opponent = opponentPlayer();

      const battlefield = $("battlefield");
      const tank = tankElement(game.current);

      if (!battlefield || !tank) return;

      const tankWidth =
        tank.getBoundingClientRect().width;

      const fieldWidth =
        battlefield.getBoundingClientRect().width;

      const step =
        (CONFIG.movementSpeed * 0.05 / fieldWidth) * 100;

      const gapPercent =
        (CONFIG.minTankGap * tankWidth / fieldWidth) * 100;

      let nextX = player.x + direction * step;

      if (game.current === 0) {
        nextX = Math.max(1, Math.min(
          nextX,
          opponent.x - gapPercent
        ));
      } else {
        nextX = Math.max(
          opponent.x + gapPercent,
          Math.min(nextX, 100 - gapPercent)
        );
      }

      player.x = nextX;

      game.movementLeft = Math.max(
        0,
        game.movementLeft - 0.05
      );

      updateTankPositions();
      updateHUD();
      saveMatch();

      if (game.movementLeft <= 0) {
        stopMovement();
        setMessage(
          currentPlayer().name +
          ": MOVEMENT USED — AIM AND FIRE"
        );
      }
    }, 50);
  }

  /* =========================================
     TOUCH AIMING
     ========================================= */

  function pointInsideTankArea(event, index) {
    const rect = tankElement(index).getBoundingClientRect();

    const extra = 70;

    return (
      event.clientX >= rect.left - extra &&
      event.clientX <= rect.right + extra &&
      event.clientY >= rect.top - extra &&
      event.clientY <= rect.bottom + extra
    );
  }

  function aimFromPointer(event) {
    if (
      game.paused ||
      !game.matchActive ||
      game.projectileActive ||
      game.aimPointer === null
    ) {
      return;
    }

    const tank = tankElement(game.current);
    const rect = tank.getBoundingClientRect();

    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.4;

    let dx = event.clientX - centerX;
    let dy = centerY - event.clientY;

    if (currentPlayer().facing === -1) {
      dx = -dx;
    }

    if (dx < 0) dx = 0;

    let angle = Math.atan2(
      Math.max(0, dy),
      Math.max(0, dx)
    ) * 180 / Math.PI;

    angle = Math.max(5, Math.min(85, angle));

    currentPlayer().angle = angle;
    game.angle = angle;

    updateTankPositions();
    updateHUD();
    drawTrajectoryPreview();
    saveMatch();
  }

  function onAimStart(event) {
    if (
      !game.matchActive ||
      game.paused ||
      game.projectileActive
    ) {
      return;
    }

    if (!pointInsideTankArea(event, game.current)) {
      return;
    }

    event.preventDefault();

    game.aimPointer = event.pointerId;

    const tank = tankElement(game.current);

    try {
      tank.setPointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture may not be available in all browsers.
    }

    $("aim-indicator").hidden = false;

    aimFromPointer(event);
  }

  function onAimMove(event) {
    if (event.pointerId !== game.aimPointer) return;

    event.preventDefault();
    aimFromPointer(event);
  }

  function onAimEnd(event) {
    if (event.pointerId !== game.aimPointer) return;

    game.aimPointer = null;

    $("aim-indicator").hidden = true;

    clearTrajectoryPreview();
  }

  /* =========================================
     TRAJECTORY PREVIEW
     ========================================= */

  let previewCanvas = null;
  let previewContext = null;

  function ensurePreviewCanvas() {
    if (previewCanvas) return;

    previewCanvas = document.createElement("canvas");
    previewCanvas.id = "trajectory-canvas";

    previewCanvas.style.position = "absolute";
    previewCanvas.style.inset = "0";
    previewCanvas.style.width = "100%";
    previewCanvas.style.height = "100%";
    previewCanvas.style.pointerEvents = "none";
    previewCanvas.style.zIndex = "6";

    $("battlefield").appendChild(previewCanvas);

    previewContext = previewCanvas.getContext("2d");
  }

  function resizePreviewCanvas() {
    ensurePreviewCanvas();

    const field = $("battlefield");
    const rect = field.getBoundingClientRect();

    const ratio = window.devicePixelRatio || 1;

    previewCanvas.width = Math.max(
      1,
      Math.round(rect.width * ratio)
    );

    previewCanvas.height = Math.max(
      1,
      Math.round(rect.height * ratio)
    );

    previewContext.setTransform(
      ratio, 0, 0, ratio, 0, 0
    );
  }

  function drawTrajectoryPreview() {
    if (
      !game.matchActive ||
      game.paused ||
      game.projectileActive
    ) {
      clearTrajectoryPreview();
      return;
    }

    resizePreviewCanvas();

    const field = $("battlefield");
    const fieldRect = field.getBoundingClientRect();

    const tankRect =
      tankElement(game.current).getBoundingClientRect();

    const x0 =
      tankRect.left - fieldRect.left + tankRect.width * 0.55;

    const y0 =
      tankRect.top - fieldRect.top + tankRect.height * 0.15;

    const player = currentPlayer();

    const angleRad = player.angle * Math.PI / 180;
    const direction = player.facing;

    const power = game.power;

    const speed = 150 + power * 2.4;

    const vx = Math.cos(angleRad) * speed * direction;
    const vy = -Math.sin(angleRad) * speed;

    const gravity = CONFIG.gravity;

    previewContext.clearRect(
      0, 0, fieldRect.width, fieldRect.height
    );

    previewContext.setLineDash([4, 6]);
    previewContext.lineWidth = 2;
    previewContext.strokeStyle =
      "rgba(255,255,255,0.8)";

    previewContext.beginPath();

    for (let time = 0; time < 2.2; time += 0.07) {
      const x = x0 + vx * time;
      const y = y0 + vy * time +
        0.5 * gravity * time * time;

      if (
        x < 0 ||
        x > fieldRect.width ||
        y > fieldRect.height
      ) {
        break;
      }

      if (time === 0) {
        previewContext.moveTo(x, y);
      } else {
        previewContext.lineTo(x, y);
      }
    }

    previewContext.stroke();
    previewContext.setLineDash([]);
  }

  function clearTrajectoryPreview() {
    if (!previewContext || !previewCanvas) return;

    previewContext.clearRect(
      0,
      0,
      previewCanvas.width,
      previewCanvas.height
    );
  }

  /* =========================================
     SOUND EFFECTS
     ========================================= */

  function playTone(frequency, duration, type = "sine") {
    if (
      !game.settings.effectsEnabled ||
      game.settings.effectsVolume <= 0
    ) {
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) return;

      if (!game.audioContext) {
        game.audioContext = new AudioContextClass();
      }

      const ctx = game.audioContext;

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.value = frequency;

      gain.gain.value =
        (game.settings.effectsVolume / 100) * 0.08;

      gain.gain.setTargetAtTime(
        0.001,
        ctx.currentTime + duration * 0.4,
        duration * 0.15
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    } catch (_) {
      // Sound is optional; the game must continue without it.
    }
  }

  function playExplosionSound() {
    playTone(90, 0.4, "sawtooth");
    setTimeout(() => playTone(55, 0.25, "triangle"), 60);
  }

  /* =========================================
     PROJECTILE ANIMATION
     ========================================= */

  function stopProjectileAnimation() {
    if (game.animationFrame !== null) {
      cancelAnimationFrame(game.animationFrame);
      game.animationFrame = null;
    }

    game.projectileActive = false;
    game.lastFrame = 0;

    $("projectile-layer").replaceChildren();
    clearTrajectoryPreview();
  }

  function createProjectile() {
    const projectile = document.createElement("div");
    projectile.className = "projectile";

    $("projectile-layer").appendChild(projectile);

    return projectile;
  }

  function createSmoke(x, y) {
    const smoke = document.createElement("div");
    smoke.className = "projectile-smoke";

    smoke.style.left = x + "px";
    smoke.style.top = y + "px";

    $("projectile-layer").appendChild(smoke);

    setTimeout(() => smoke.remove(), 700);
  }

  function animateExplosion(x, y, callback) {
    const field = $("battlefield");
    const rect = field.getBoundingClientRect();

    const explosion = document.createElement("div");
    explosion.className = "explosion";

    explosion.style.left = x + "px";
    explosion.style.top = y + "px";

    $("explosion-layer").appendChild(explosion);

    // Subtle explosion shake.
    field.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(-2px)" },
        { transform: "translateX(0)" }
      ],
      { duration: 200, iterations: 1 }
    );

    playExplosionSound();

    setTimeout(() => {
      explosion.remove();

      if (typeof callback === "function") {
        callback(rect);
      }
    }, 450);
  }

  function calculateDamage(distance, directHit) {
    if (distance >= CONFIG.explosionRadius) return 0;

    const ratio = Math.max(
      0,
      1 - distance / CONFIG.explosionRadius
    );

    const damage = CONFIG.maximumDamage * ratio;

    return Math.round(damage);
  }

  function showDamageNumber(index, damage) {
    if (damage <= 0) return;

    const tank = tankElement(index);
    const field = $("battlefield");

    const tankRect = tank.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();

    const damageText = document.createElement("div");

    damageText.textContent = "-" + damage;
    damageText.style.position = "absolute";
    damageText.style.left =
      (tankRect.left - fieldRect.left +
        tankRect.width / 2) + "px";

    damageText.style.top =
      (tankRect.top - fieldRect.top - 12) + "px";

    damageText.style.zIndex = "12";
    damageText.style.color = "#fff4a3";
    damageText.style.fontSize = "22px";
    damageText.style.fontWeight = "1000";
    damageText.style.pointerEvents = "none";
    damageText.style.textShadow = "0 2px 4px #000";

    field.appendChild(damageText);

    damageText.animate(
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(-35px)" }
      ],
      { duration: 850, easing: "ease-out" }
    );

    setTimeout(() => damageText.remove(), 900);
  }

  function applyExplosionDamage(x, y) {
    const fieldRect =
      $("battlefield").getBoundingClientRect();

    game.players.forEach((player, index) => {
      const tankRect =
        tankElement(index).getBoundingClientRect();

      const centerX =
        tankRect.left - fieldRect.left +
        tankRect.width / 2;

      const centerY =
        tankRect.top - fieldRect.top +
        tankRect.height / 2;

      const distance = Math.hypot(
        centerX - x,
        centerY - y
      );

      const directHit =
        distance < Math.max(tankRect.width, tankRect.height) * 0.35;

      const damage = calculateDamage(
        distance,
        directHit
      );

      if (damage > 0) {
        player.hp = Math.max(0, player.hp - damage);
        showDamageNumber(index, damage);
      }
    });

    updateHUD();
    saveMatch();
  }

  function finishProjectile() {
    game.projectileActive = false;
    game.animationFrame = null;

    if (game.players.some(player => player.hp <= 0)) {
      const defeated = game.players.findIndex(
        player => player.hp <= 0
      );

      const winnerIndex = 1 - defeated;

      game.matchActive = false;
      stopMovement();

      $("victory-title").textContent = "VICTORY!";
      $("victory-message").textContent =
        game.players[winnerIndex].name + " WINS!";

      $("victory-overlay").hidden = false;

      updateHUD();
      saveMatch();

      return;
    }

    game.current = 1 - game.current;
    game.movementLeft = CONFIG.movementSeconds;

    game.players.forEach(player => {
      player.moved = 0;
    });

    game.angle = currentPlayer().angle;
    game.power = currentPlayer().power;

    $("power-slider").value = game.power;

    updateHUD();
    updateTankPositions();

    setMessage(
      currentPlayer().name + ": YOUR TURN"
    );

    saveMatch();
  }

  function fireShell() {
    if (
      !game.matchActive ||
      game.paused ||
      game.projectileActive
    ) {
      return;
    }

    stopMovement();

    const player = currentPlayer();
    player.power = game.power;

    game.projectileActive = true;

    $("fire-btn").disabled = true;
    clearTrajectoryPreview();

    const field = $("battlefield");
    const fieldRect = field.getBoundingClientRect();

    const tankRect =
      tankElement(game.current).getBoundingClientRect();

    const x0 =
      tankRect.left - fieldRect.left +
      tankRect.width * 0.55;

    const y0 =
      tankRect.top - fieldRect.top +
      tankRect.height * 0.15;

    const angleRad = player.angle * Math.PI / 180;
    const direction = player.facing;

    const speed = 150 + game.power * 2.4;

    const vx = Math.cos(angleRad) * speed * direction;
    const vy = -Math.sin(angleRad) * speed;

    const gravity = CONFIG.gravity;

    const projectile = createProjectile();

    let time = 0;
    let previousSmoke = 0;

    setMessage(player.name + ": FIRING!");

    playTone(170, 0.18, "sawtooth");

    function frame(timestamp) {
      if (!game.projectileActive) return;

      if (!game.lastFrame) game.lastFrame = timestamp;

      const delta = Math.min(
        (timestamp - game.lastFrame) / 1000,
        0.035
      );

      game.lastFrame = timestamp;
      time += delta;

      const x = x0 + vx * time;
      const y = y0 + vy * time +
        0.5 * gravity * time * time;

      const groundY = fieldRect.height * 0.84;

      projectile.style.left = x + "px";
      projectile.style.top = y + "px";

      if (timestamp - previousSmoke > 65) {
        createSmoke(x, y);
        previousSmoke = timestamp;
      }

      const outside =
        x < -20 ||
        x > fieldRect.width + 20 ||
        y > fieldRect.height + 20;

      const hitGround = y >= groundY;

      const hitTank = game.players.some(
        (target, index) => {
          if (index === game.current) return false;

          const rect =
            tankElement(index).getBoundingClientRect();

          const tankX =
            rect.left - fieldRect.left;

          const tankY =
            rect.top - fieldRect.top;

          return (
            x >= tankX &&
            x <= tankX + rect.width &&
            y >= tankY &&
            y <= tankY + rect.height
          );
        }
      );

      if (hitGround || hitTank || outside) {
        projectile.remove();

        const impactX = Math.max(
          0,
          Math.min(fieldRect.width, x)
        );

        const impactY = Math.max(
          0,
          Math.min(groundY, y)
        );

        animateExplosion(
          impactX,
          impactY,
          () => {
            applyExplosionDamage(
              impactX,
              impactY
            );

            finishProjectile();
          }
        );

        return;
      }

      game.animationFrame =
        requestAnimationFrame(frame);
    }

    game.lastFrame = 0;

    game.animationFrame =
      requestAnimationFrame(frame);
  }

  /* =========================================
     AIM RESET
     ========================================= */

  function resetAim() {
    if (
      !game.matchActive ||
      game.paused ||
      game.projectileActive
    ) {
      return;
    }

    currentPlayer().angle = 45;
    game.angle = 45;

    updateTankPositions();
    updateHUD();
    drawTrajectoryPreview();
    saveMatch();
  }

  /* =========================================
     PAUSE AND LEAVE MATCH
     ========================================= */

  function pauseGame() {
    if (!game.matchActive || game.projectileActive) {
      return;
    }

    game.paused = true;
    stopMovement();

    $("pause-overlay").hidden = false;
    updateHUD();
  }

  function resumeGame() {
    game.paused = false;
    $("pause-overlay").hidden = true;

    updateHUD();
    setMessage(currentPlayer().name + ": YOUR TURN");
  }

  function requestLeaveMatch() {
    if (!game.matchActive) {
      showScreen("main-menu");
      return;
    }

    game.paused = true;
    stopMovement();

    $("leave-overlay").hidden = false;
  }

  function confirmLeaveMatch() {
    stopMovement();
    stopProjectileAnimation();

    game.matchActive = false;
    game.paused = false;

    $("leave-overlay").hidden = true;
    $("pause-overlay").hidden = true;

    clearSavedMatch();

    showScreen("main-menu");
  }

  /* =========================================
     LOCAL SAVE AND RESTORE
     ========================================= */

  function saveMatch() {
    if (game.players.length !== 2) return;

    const data = {
      players: game.players,
      current: game.current,
      movementLeft: game.movementLeft,
      angle: game.angle,
      power: game.power,
      matchActive: game.matchActive
    };

    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify(data)
      );
    } catch (_) {
      // Storage may be unavailable in private browsing.
    }
  }

  function clearSavedMatch() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (_) {}
  }

  function restoreSavedMatch() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;

      const data = JSON.parse(raw);

      if (
        !data ||
        !Array.isArray(data.players) ||
        data.players.length !== 2 ||
        !data.players.every(
          player =>
            typeof player.name === "string" &&
            Number.isFinite(player.hp) &&
            Number.isFinite(player.x)
        )
      ) {
        clearSavedMatch();
        return false;
      }

      if (!data.matchActive) return false;

      game.players = data.players;
      game.current = data.current === 1 ? 1 : 0;

      game.movementLeft = Math.max(
        0,
        Math.min(
          CONFIG.movementSeconds,
          Number(data.movementLeft) || 0
        )
      );

      game.angle = Number(data.angle) || 45;
      game.power = Number(data.power) || 50;

      game.players.forEach((player, index) => {
        player.hp = Math.max(0, Math.min(100, player.hp));
        player.x = Math.max(0, Math.min(100, player.x));
        player.angle = Math.max(
          5,
          Math.min(85, Number(player.angle) || 45)
        );

        player.facing = index === 0 ? 1 : -1;
        player.tank = String(player.tank || (
          index === 0 ? "blue" : "red"
        ));
      });

      game.matchActive = true;
      game.paused = false;
      game.projectileActive = false;

      updateTankPositions();
      updateHUD();

      $("power-slider").value = game.power;

      setMessage(
        "MATCH RESTORED — " +
        currentPlayer().name + "'S TURN"
      );

      showScreen("battle-screen");

      return true;
    } catch (_) {
      clearSavedMatch();
      return false;
    }
  }

  /* =========================================
     SETTINGS
     ========================================= */

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);

      if (raw) {
        game.settings = {
          ...game.settings,
          ...JSON.parse(raw)
        };
      }
    } catch (_) {}

    $("music-volume").value =
      game.settings.musicVolume;

    $("effects-volume").value =
      game.settings.effectsVolume;

    updateSettingsButtons();
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(game.settings)
      );
    } catch (_) {}
  }

  function updateSettingsButtons() {
    $("music-toggle-btn").textContent =
      "MUSIC: " +
      (game.settings.musicEnabled ? "ON" : "OFF");

    $("effects-toggle-btn").textContent =
      "SOUND EFFECTS: " +
      (game.settings.effectsEnabled ? "ON" : "OFF");
  }

  /* =========================================
     EVENT HANDLERS
     ========================================= */

  $("play-btn").addEventListener("click", () => {
    showScreen("mode-screen");
  });

  $("settings-btn").addEventListener("click", () => {
    showScreen("settings-screen");
  });

  $("how-to-btn").addEventListener("click", () => {
    showScreen("how-to-screen");
  });

  $("local-match-btn").addEventListener("click", () => {
    showScreen("local-setup-screen");
  });

  $("online-match-btn").addEventListener("click", () => {
    showScreen("online-screen");
  });

  document.querySelectorAll("[data-screen]").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.screen;

      if (
        game.matchActive &&
        target === "main-menu"
      ) {
        requestLeaveMatch();
        return;
      }

      showScreen(target);
    });
  });

  $("start-battle-btn").addEventListener("click", () => {
    if (setupVersusScreen()) {
      showScreen("vs-screen");
    }
  });

  $("vs-continue-btn").addEventListener("click", () => {
    startNewBattle();
  });

  $("move-left-btn").addEventListener("pointerdown", event => {
    event.preventDefault();
    startMovement(-1);
  });

  $("move-right-btn").addEventListener("pointerdown", event => {
    event.preventDefault();
    startMovement(1);
  });

  [
    "move-left-btn",
    "move-right-btn"
  ].forEach(id => {
    const button = $(id);

    ["pointerup", "pointercancel", "pointerleave"].forEach(type => {
      button.addEventListener(type, stopMovement);
    });
  });

  $("battlefield").addEventListener(
    "pointerdown",
    onAimStart
  );

  $("battlefield").addEventListener(
    "pointermove",
    onAimMove
  );

  $("battlefield").addEventListener(
    "pointerup",
    onAimEnd
  );

  $("battlefield").addEventListener(
    "pointercancel",
    onAimEnd
  );

  $("power-slider").addEventListener("input", event => {
    game.power = Number(event.target.value);

    if (game.players.length === 2) {
      currentPlayer().power = game.power;
    }

    updateHUD();
    drawTrajectoryPreview();
    saveMatch();
  });

  $("fire-btn").addEventListener("click", fireShell);

  $("aim-reset-btn").addEventListener("click", resetAim);

  $("pause-btn").addEventListener("click", pauseGame);

  $("resume-btn").addEventListener("click", resumeGame);

  $("pause-menu-btn").addEventListener(
    "click",
    requestLeaveMatch
  );

  $("leave-confirm-btn").addEventListener(
    "click",
    confirmLeaveMatch
  );

  $("leave-cancel-btn").addEventListener("click", () => {
    $("leave-overlay").hidden = true;

    if (game.matchActive) {
      game.paused = true;
      $("pause-overlay").hidden = false;
    } else {
      game.paused = false;
    }
  });

  $("victory-menu-btn").addEventListener("click", () => {
    $("victory-overlay").hidden = true;

    game.matchActive = false;
    clearSavedMatch();

    showScreen("main-menu");
  });

  $("rematch-btn").addEventListener("click", () => {
    $("victory-overlay").hidden = true;
    game.matchActive = false;

    showScreen("local-setup-screen");
  });

  $("music-volume").addEventListener("input", event => {
    game.settings.musicVolume =
      Number(event.target.value);

    saveSettings();
  });

  $("effects-volume").addEventListener("input", event => {
    game.settings.effectsVolume =
      Number(event.target.value);

    saveSettings();
  });

  $("music-toggle-btn").addEventListener("click", () => {
    game.settings.musicEnabled =
      !game.settings.musicEnabled;

    updateSettingsButtons();
    saveSettings();
  });

  $("effects-toggle-btn").addEventListener("click", () => {
    game.settings.effectsEnabled =
      !game.settings.effectsEnabled;

    updateSettingsButtons();
    saveSettings();
  });

  window.addEventListener("resize", () => {
    if (game.matchActive) {
      updateTankPositions();
      drawTrajectoryPreview();
    }
  });

  /* =========================================
     INITIALIZATION
     ========================================= */

  loadSettings();

  if (!restoreSavedMatch()) {
    showScreen("main-menu");
  }
});
