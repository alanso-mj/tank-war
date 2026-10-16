/* =====================================================
   TANK WAR — PHASE 2 GAME ENGINE
   Local 2-player artillery battle
   ===================================================== */

"use strict";

/* =====================================================
   CONFIGURATION
   ===================================================== */

const CONFIG = {
    MAX_HEALTH: 100,
    MOVE_DISTANCE: 22,
    MOVE_LIMIT: 85,
    MIN_ANGLE: 5,
    MAX_ANGLE: 85,
    MIN_POWER: 20,
    MAX_POWER: 100,
    BASE_DAMAGE: 38,
    MAX_DAMAGE: 55,
    BLAST_RADIUS: 115,
    GRAVITY: 360,
    SAVE_KEY: "tankWarPhase2Save",
    SETTINGS_KEY: "tankWarSettings"
};

const TANKS = [
    { name: "STRIKER", description: "Balanced assault tank" },
    { name: "TITAN", description: "Heavy battlefield tank" },
    { name: "PHANTOM", description: "Light reconnaissance tank" }
];

const $ = id => document.getElementById(id);

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

/* =====================================================
   GAME STATE
   ===================================================== */

const game = {
    screen: "main-menu",
    mode: "local",
    running: false,
    paused: false,
    busy: false,
    gameOver: false,

    players: [
        {
            name: "PLAYER 1",
            color: "blue",
            health: CONFIG.MAX_HEALTH,
            tankIndex: 0,
            x: 0.12,
            angle: 45,
            power: 65,
            moved: 0
        },
        {
            name: "PLAYER 2",
            color: "red",
            health: CONFIG.MAX_HEALTH,
            tankIndex: 1,
            x: 0.78,
            angle: 135,
            power: 65,
            moved: 0
        }
    ],

    activePlayer: 0,
    round: 1,
    terrain: [],
    effects: [],
    lastSaved: 0,
    noticeTimer: null,
    messageTimer: null,
    animationFrame: null,
    lastFrame: 0,
    resizeTimer: null
};

const settings = {
    volume: 70,
    music: true,
    effects: true
};

/* =====================================================
   DOM HELPERS
   ===================================================== */

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
}

function setHTML(id, value) {
    const element = $(id);
    if (element) element.innerHTML = value;
}

function setDisplay(id, value) {
    const element = $(id);
    if (element) element.style.display = value;
}

function listen(id, event, callback, options) {
    const element = $(id);
    if (element) {
        element.addEventListener(event, callback, options);
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function activePlayer() {
    return game.players[game.activePlayer];
}

function otherPlayer() {
    return game.players[1 - game.activePlayer];
}

/* =====================================================
   SCREEN NAVIGATION
   ===================================================== */

function showScreen(screenId) {
    for (const id of screens) {
        const screen = $(id);
        if (screen) screen.classList.remove("active");
    }

    const target = $(screenId);

    if (target) {
        target.classList.add("active");
        game.screen = screenId;
    }

    window.scrollTo(0, 0);
}

function showNotice(message, duration = 2200) {
    const notice = $("global-notice");
    if (!notice) return;

    notice.textContent = message;
    notice.classList.add("visible");

    clearTimeout(game.noticeTimer);

    game.noticeTimer = setTimeout(() => {
        notice.classList.remove("visible");
    }, duration);
}

function showBattleMessage(message, duration = 1600) {
    const element = $("battle-message");
    if (!element) return;

    element.textContent = message;
    element.classList.add("visible");

    clearTimeout(game.messageTimer);

    game.messageTimer = setTimeout(() => {
        element.classList.remove("visible");
    }, duration);
}

/* =====================================================
   SETTINGS
   ===================================================== */

function loadSettings() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(CONFIG.SETTINGS_KEY) || "{}"
        );

        if (Number.isFinite(saved.volume)) {
            settings.volume = clamp(saved.volume, 0, 100);
        }

        if (typeof saved.music === "boolean") {
            settings.music = saved.music;
        }

        if (typeof saved.effects === "boolean") {
            settings.effects = saved.effects;
        }
    } catch (error) {
        console.warn("Could not load settings.", error);
    }

    applySettingsToUI();
}

function saveSettings() {
    try {
        localStorage.setItem(
            CONFIG.SETTINGS_KEY,
            JSON.stringify(settings)
        );
    } catch (error) {
        console.warn("Could not save settings.", error);
    }
}

function applySettingsToUI() {
    if ($("master-volume")) {
        $("master-volume").value = settings.volume;
    }

    if ($("volume-value")) {
        $("volume-value").textContent = `${settings.volume}%`;
    }

    if ($("music-toggle")) {
        $("music-toggle").checked = settings.music;
    }

    if ($("effects-toggle")) {
        $("effects-toggle").checked = settings.effects;
    }
}

function openSettings() {
    game.settingsReturnScreen = game.screen;
    showScreen("settings-screen");
}

function closeSettings() {
    const returnScreen = game.settingsReturnScreen || "main-menu";

    showScreen(returnScreen);

    if (returnScreen === "battle-screen") {
        updateHUD();
        drawAimGuide();
    }
}

/* =====================================================
   PLAYER SETUP
   ===================================================== */

function readPlayerNames() {
    const name1 = $("player1-name")?.value.trim();
    const name2 = $("player2-name")?.value.trim();

    game.players[0].name = name1 || "PLAYER 1";
    game.players[1].name = name2 || "PLAYER 2";
}

function updateTankPreviews() {
    const p1 = game.players[0];
    const p2 = game.players[1];

    setText("tank1-name", TANKS[p1.tankIndex]?.name || "STRIKER");
    setText("tank2-name", TANKS[p2.tankIndex]?.name || "TITAN");

    setText("tank1-preview-name", TANKS[p1.tankIndex]?.name || "STRIKER");
    setText("tank2-preview-name", TANKS[p2.tankIndex]?.name || "TITAN");

    setText("player1-setup-name", p1.name);
    setText("player2-setup-name", p2.name);

    setText("tank1-description", TANKS[p1.tankIndex]?.description || "");
    setText("tank2-description", TANKS[p2.tankIndex]?.description || "");

    const preview1 = $("tank1-preview");
    const preview2 = $("tank2-preview");

    if (preview1) preview1.dataset.tank = String(p1.tankIndex);
    if (preview2) preview2.dataset.tank = String(p2.tankIndex);
}

function changeTank(playerIndex, direction) {
    const player = game.players[playerIndex];

    player.tankIndex =
        (player.tankIndex + direction + TANKS.length) % TANKS.length;

    updateTankPreviews();
}

/* =====================================================
   STARTING A MATCH
   ===================================================== */

function startMatch() {
    readPlayerNames();

    game.running = false;
    game.paused = false;
    game.busy = false;
    game.gameOver = false;

    game.activePlayer = 0;
    game.round = 1;
    game.effects = [];

    game.players.forEach((player, index) => {
        player.health = CONFIG.MAX_HEALTH;
        player.moved = 0;
        player.power = 65;
        player.angle = index === 0 ? 45 : 135;
        player.x = index === 0 ? 0.12 : 0.78;
    });

    clearSavedMatch();

    showScreen("vs-screen");

    setText("vs-name1", game.players[0].name);
    setText("vs-name2", game.players[1].name);
    setText("vs-countdown", "3");

    let countdown = 3;

    const timer = setInterval(() => {
        countdown--;

        if (countdown > 0) {
            setText("vs-countdown", String(countdown));
        } else if (countdown === 0) {
            setText("vs-countdown", "FIGHT!");
        } else {
            clearInterval(timer);
            prepareBattlefield();
        }
    }, 800);
}

function prepareBattlefield() {
    showScreen("battle-screen");

    game.running = true;
    game.paused = false;
    game.busy = false;
    game.lastFrame = 0;

    /*
     * Wait for the battle screen to become visible before
     * measuring it. This prevents zero-size canvas errors.
     */
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            initializeTerrain();
            positionTanks();
            updateHUD();
            updateControls();
            drawAimGuide();
            saveMatch();
            startEffectLoop();

            showBattleMessage(
                `${activePlayer().name}'S TURN`,
                1600
            );
        });
    });
}

/* =====================================================
   TERRAIN
   ===================================================== */

function initializeTerrain() {
    const battlefield = $("battlefield");
    if (!battlefield) return;

    const width = battlefield.clientWidth;
    const height = battlefield.clientHeight;

    if (width < 1 || height < 1) return;

    const points = [];
    const groundY = height * 0.72;

    for (let x = 0; x <= width; x += 4) {
        const wave =
            Math.sin(x * 0.012) * height * 0.025 +
            Math.sin(x * 0.027) * height * 0.012;

        points.push({
            x,
            y: groundY + wave
        });
    }

    points.push({
        x: width,
        y: height
    });

    points.push({
        x: 0,
        y: height
    });

    game.terrain = points;

    drawTerrain();
}

function drawTerrain() {
    const canvas = $("terrain-canvas");
    const battlefield = $("battlefield");

    if (!canvas || !battlefield) return;

    const width = battlefield.clientWidth;
    const height = battlefield.clientHeight;

    if (!width || !height) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (game.terrain.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(game.terrain[0].x, game.terrain[0].y);

    for (let i = 1; i < game.terrain.length; i++) {
        ctx.lineTo(game.terrain[i].x, game.terrain[i].y);
    }

    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, height * 0.65, 0, height);

    gradient.addColorStop(0, "#a9764e");
    gradient.addColorStop(0.3, "#79513a");
    gradient.addColorStop(1, "#392b25");

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(game.terrain[0].x, game.terrain[0].y);

    for (let i = 1; i < game.terrain.length; i++) {
        ctx.lineTo(game.terrain[i].x, game.terrain[i].y);
    }

    ctx.strokeStyle = "#e4b17b";
    ctx.lineWidth = 3;
    ctx.stroke();
}

function terrainHeightAt(x) {
    if (game.terrain.length < 2) return 0;

    for (let i = 0; i < game.terrain.length - 1; i++) {
        const a = game.terrain[i];
        const b = game.terrain[i + 1];

        if (x >= a.x && x <= b.x) {
            const span = b.x - a.x;
            const ratio = span ? (x - a.x) / span : 0;

            return a.y + (b.y - a.y) * ratio;
        }
    }

    return game.terrain[game.terrain.length - 1].y;
}

function deformTerrain(centerX, radius) {
    if (game.terrain.length < 3) return;

    const battlefield = $("battlefield");
    if (!battlefield) return;

    const width = battlefield.clientWidth;
    const height = battlefield.clientHeight;

    for (const point of game.terrain) {
        const distance = Math.abs(point.x - centerX);

        if (distance < radius) {
            const ratio = 1 - distance / radius;

            point.y = Math.min(
                height - 10,
                point.y + ratio * radius * 0.7
            );
        }
    }

    drawTerrain();
    positionTanks();
}

/* =====================================================
   TANK POSITIONS
   ===================================================== */

function positionTanks() {
    const battlefield = $("battlefield");

    if (!battlefield) return;

    const width = battlefield.clientWidth;
    const height = battlefield.clientHeight;

    if (width < 1 || height < 1) return;

    game.players.forEach((player, index) => {
        const tank = $(`tank${index + 1}`);

        if (!tank) return;

        const tankWidth = tank.offsetWidth || 90;

        const left = clamp(
            player.x * width,
            0,
            width - tankWidth
        );

        const groundY = terrainHeightAt(left + tankWidth / 2);

        tank.style.left = `${left}px`;
        tank.style.bottom = `${Math.max(0, height - groundY)}px`;

        tank.style.transform =
            index === 0 ? "scaleX(1)" : "scaleX(-1)";
    });

    drawAimGuide();
}

function moveTank(direction) {
    if (!canAct()) return;

    const player = activePlayer();
    const battlefield = $("battlefield");

    if (!battlefield) return;

    const width = battlefield.clientWidth;
    const tank = $(`tank${game.activePlayer + 1}`);

    if (!tank) return;

    const tankWidth = tank.offsetWidth || 90;
    const currentX = player.x * width;

    const nextX = clamp(
        currentX + direction * CONFIG.MOVE_DISTANCE,
        0,
        width - tankWidth
    );

    const distanceMoved = Math.abs(nextX - currentX);

    if (distanceMoved < 1) {
        showNotice("You cannot move further!");
        return;
    }

    if (player.moved + distanceMoved > CONFIG.MOVE_LIMIT) {
        showNotice("Movement limit reached!");
        return;
    }

    player.x = nextX / width;
    player.moved += distanceMoved;

    positionTanks();
    updateControls();
    saveMatch();
}

/* =====================================================
   AIMING
   ===================================================== */

function setAngle(value) {
    if (game.busy || game.paused || game.gameOver) return;

    const player = activePlayer();

    player.angle = clamp(
        Number(value),
        CONFIG.MIN_ANGLE,
        CONFIG.MAX_ANGLE
    );

    drawAimGuide();
    updateControls();
    saveMatch();
}

function setPower(value) {
    if (game.busy || game.paused || game.gameOver) return;

    activePlayer().power = clamp(
        Number(value),
        CONFIG.MIN_POWER,
        CONFIG.MAX_POWER
    );

    updateControls();
    drawAimGuide();
    saveMatch();
}

function getBarrelDirection(player, playerIndex) {
    /*
     * Player 1 fires right; player 2 fires left.
     * Their displayed angle is measured above the horizontal.
     */
    const radians = player.angle * Math.PI / 180;
    const facing = playerIndex === 0 ? 1 : -1;

    return {
        x: Math.cos(radians) * facing,
        y: -Math.sin(radians)
    };
}

function getTankMuzzle(playerIndex) {
    const tank = $(`tank${playerIndex + 1}`);
    const battlefield = $("battlefield");

    if (!tank || !battlefield) {
        return { x: 0, y: 0 };
    }

    const rect = tank.getBoundingClientRect();
    const fieldRect = battlefield.getBoundingClientRect();

    const player = game.players[playerIndex];
    const direction = getBarrelDirection(player, playerIndex);

    const centerX = rect.left - fieldRect.left + rect.width / 2;
    const centerY = rect.top - fieldRect.top + rect.height * 0.4;

    return {
        x: centerX + direction.x * 32,
        y: centerY + direction.y * 25,
        direction
    };
}

function drawAimGuide() {
    const canvas = $("aim-canvas");
    const battlefield = $("battlefield");

    if (!canvas || !battlefield || game.screen !== "battle-screen") {
        return;
    }

    const width = battlefield.clientWidth;
    const height = battlefield.clientHeight;

    if (!width || !height) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!game.running || game.paused || game.gameOver) return;

    const player = activePlayer();
    const muzzle = getTankMuzzle(game.activePlayer);

    const direction = muzzle.direction;
    const power = player.power;

    const speed = power * 3.0;
    const gravity = CONFIG.GRAVITY;

    ctx.beginPath();

    for (let i = 0; i <= 30; i++) {
        const time = i * 0.07;

        const x = muzzle.x + direction.x * speed * time;
        const y =
            muzzle.y +
            direction.y * speed * time +
            0.5 * gravity * time * time;

        if (x < 0 || x > width || y > height || y < -height) break;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.setLineDash([4, 7]);
    ctx.lineWidth = 2;
    ctx.strokeStyle =
        game.activePlayer === 0
            ? "rgba(100, 205, 255, 0.75)"
            : "rgba(255, 115, 115, 0.75)";

    ctx.stroke();
    ctx.setLineDash([]);
}

/* =====================================================
   SHOOTING
   ===================================================== */

function canAct() {
    return (
        game.running &&
        !game.paused &&
        !game.busy &&
        !game.gameOver &&
        game.screen === "battle-screen"
    );
}

function fireShell() {
    if (!canAct()) return;

    game.busy = true;
    updateControls();

    const shooterIndex = game.activePlayer;
    const player = game.players[shooterIndex];
    const muzzle = getTankMuzzle(shooterIndex);

    const direction = muzzle.direction;
    const speed = player.power * 3.0;

    const projectile = document.createElement("div");
    projectile.className = "projectile";

    $("projectile-layer")?.appendChild(projectile);

    const shell = {
        x: muzzle.x,
        y: muzzle.y,
        vx: direction.x * speed,
        vy: direction.y * speed,
        element: projectile,
        shooterIndex,
        elapsed: 0
    };

    showBattleMessage(`${player.name} FIRED!`, 900);

    launchProjectile(shell);
}

function launchProjectile(shell) {
    let previousTime = performance.now();

    function frame(now) {
        if (game.paused || game.gameOver) {
            previousTime = now;
            requestAnimationFrame(frame);
            return;
        }

        const delta = Math.min((now - previousTime) / 1000, 0.035);
        previousTime = now;

        shell.elapsed += delta;

        shell.x += shell.vx * delta;
        shell.y += shell.vy * delta;

        shell.vy += CONFIG.GRAVITY * delta;

        shell.element.style.left = `${shell.x}px`;
        shell.element.style.top = `${shell.y}px`;

        if (shell.elapsed > 0.08) {
            const trail = document.createElement("div");
            trail.className = "smoke-particle";
            trail.style.left = `${shell.x}px`;
            trail.style.top = `${shell.y}px`;
            trail.style.width = "7px";
            trail.style.height = "7px";

            $("effect-layer")?.appendChild(trail);

            setTimeout(() => trail.remove(), 800);
        }

        const battlefield = $("battlefield");

        if (!battlefield) {
            shell.element.remove();
            finishShot();
            return;
        }

        const width = battlefield.clientWidth;
        const height = battlefield.clientHeight;

        const targetIndex = 1 - shell.shooterIndex;
        const target = getTankMuzzle(targetIndex);

        const dx = shell.x - target.x;
        const dy = shell.y - target.y;

        const hitTarget = Math.hypot(dx, dy) < 35;

        const groundY = terrainHeightAt(
            clamp(shell.x, 0, width)
        );

        const hitGround = shell.y >= groundY;

        const outside =
            shell.x < -20 ||
            shell.x > width + 20 ||
            shell.y > height + 20 ||
            shell.elapsed > 5;

        if (hitTarget || hitGround || outside) {
            const impactX = clamp(shell.x, 0, width);
            const impactY = clamp(shell.y, 0, height);

            shell.element.remove();

            if (hitTarget) {
                createExplosion(impactX, impactY);
                applyExplosionDamage(
                    impactX,
                    impactY,
                    shell.shooterIndex
                );
            } else if (hitGround) {
                createExplosion(impactX, groundY);
                deformTerrain(impactX, 42);
                applyExplosionDamage(
                    impactX,
                    groundY,
                    shell.shooterIndex
                );
            }

            finishShot();
            return;
        }

        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

function finishShot() {
    if (game.gameOver) return;

    game.busy = false;

    if (game.players.some(player => player.health <= 0)) {
        finishMatch();
        return;
    }

    game.activePlayer = 1 - game.activePlayer;

    if (game.activePlayer === 0) {
        game.round++;
    }

    activePlayer().moved = 0;

    updateHUD();
    updateControls();
    positionTanks();
    drawAimGuide();
    saveMatch();

    showBattleMessage(`${activePlayer().name}'S TURN`);
}

/* =====================================================
   EXPLOSIONS AND DAMAGE
   ===================================================== */

function createExplosion(x, y) {
    const explosion = document.createElement("div");

    explosion.className = "explosion";
    explosion.style.left = `${x}px`;
    explosion.style.top = `${y}px`;

    $("explosion-layer")?.appendChild(explosion);

    setTimeout(() => explosion.remove(), 650);

    const battlefield = $("battlefield");

    if (battlefield) {
        battlefield.classList.remove("screen-shake");

        /*
         * Force the animation to restart.
         */
        void battlefield.offsetWidth;

        battlefield.classList.add("screen-shake");

        setTimeout(() => {
            battlefield.classList.remove("screen-shake");
        }, 280);
    }
}

function applyExplosionDamage(x, y, shooterIndex) {
    const battlefield = $("battlefield");
    if (!battlefield) return;

    const fieldRect = battlefield.getBoundingClientRect();

    game.players.forEach((player, index) => {
        const tank = $(`tank${index + 1}`);
        if (!tank) return;

        const rect = tank.getBoundingClientRect();

        const centerX = rect.left - fieldRect.left + rect.width / 2;
        const centerY = rect.top - fieldRect.top + rect.height / 2;

        const distance = Math.hypot(centerX - x, centerY - y);

        if (distance > CONFIG.BLAST_RADIUS) return;

        const damageFactor = 1 - distance / CONFIG.BLAST_RADIUS;

        let damage = Math.round(
            CONFIG.BASE_DAMAGE +
            (CONFIG.MAX_DAMAGE - CONFIG.BASE_DAMAGE) * damageFactor
        );

        if (index === shooterIndex) {
            damage = Math.round(damage * 0.65);
        }

        player.health = Math.max(0, player.health - damage);

        createDamageNumber(
            centerX,
            centerY - 25,
            `-${damage}`
        );

        showNotice(
            `${player.name}: -${damage} HP`,
            1400
        );
    });

    updateHUD();
    saveMatch();
}

function createDamageNumber(x, y, text) {
    const element = document.createElement("div");

    element.className = "damage-number";
    element.textContent = text;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;

    $("damage-layer")?.appendChild(element);

    setTimeout(() => element.remove(), 1050);
}

/* =====================================================
   HUD AND CONTROLS
   ===================================================== */

function updateHUD() {
    const p1 = game.players[0];
    const p2 = game.players[1];

    setText("hud-name1", p1.name);
    setText("hud-name2", p2.name);

    setText("hp1-text", `${p1.health} / ${CONFIG.MAX_HEALTH}`);
    setText("hp2-text", `${p2.health} / ${CONFIG.MAX_HEALTH}`);

    const health1 = $("health1");
    const health2 = $("health2");

    if (health1) {
        health1.style.width = `${p1.health}%`;
        health1.classList.toggle("medium", p1.health <= 60 && p1.health > 30);
        health1.classList.toggle("low", p1.health <= 30);
    }

    if (health2) {
        health2.style.width = `${p2.health}%`;
        health2.classList.toggle("medium", p2.health <= 60 && p2.health > 30);
        health2.classList.toggle("low", p2.health <= 30);
    }

    setText("round-label", `ROUND ${game.round}`);
    setText("turn-indicator", `${activePlayer().name}'S TURN`);
    setText("movement-indicator", `Move: ${Math.round(activePlayer().moved)} / ${CONFIG.MOVE_LIMIT}`);

    const angleInput = $("angle-slider");

    if (angleInput) {
        angleInput.value = activePlayer().angle;
    }

    setText("angle-value", `${activePlayer().angle}°`);

    const powerSlider = $("power-slider");

    if (powerSlider) {
        powerSlider.value = activePlayer().power;
    }

    setText("power-value", `${activePlayer().power}%`);
}

function updateControls() {
    const enabled = canAct();

    [
        "move-left-btn",
        "move-right-btn",
        "fire-btn",
        "power-slider",
        "angle-slider"
    ].forEach(id => {
        const element = $(id);
        if (element) element.disabled = !enabled;
    });

    const player = activePlayer();

    if ($("movement-time")) {
        $("movement-time").textContent =
            `${Math.max(0, CONFIG.MOVE_LIMIT - Math.round(player.moved))} px`;
    }

    updateHUD();
}

/* =====================================================
   PAUSE MENU
   ===================================================== */

function pauseMatch() {
    if (!game.running || game.gameOver || game.paused) return;

    game.paused = true;

    $("pause-overlay")?.classList.add("active");

    updateControls();
    drawAimGuide();
    saveMatch();
}

function resumeMatch() {
    if (game.gameOver) return;

    game.paused = false;

    $("pause-overlay")?.classList.remove("active");

    updateControls();
    drawAimGuide();
}

function openConfirmation(title, message, action) {
    setText("confirm-title", title);
    setText("confirm-message", message);

    game.confirmAction = action;

    $("confirm-overlay")?.classList.add("active");
}

function closeConfirmation() {
    $("confirm-overlay")?.classList.remove("active");
    game.confirmAction = null;
}

function restartMatch() {
    closeConfirmation();

    $("pause-overlay")?.classList.remove("active");

    game.paused = false;
    game.running = false;

    clearSavedMatch();

    startMatch();
}

function leaveMatch() {
    closeConfirmation();

    $("pause-overlay")?.classList.remove("active");

    game.running = false;
    game.paused = false;
    game.busy = false;

    clearSavedMatch();

    showScreen("main-menu");
    updateResumeButton();
}

/* =====================================================
   VICTORY
   ===================================================== */

function finishMatch() {
    game.gameOver = true;
    game.running = false;
    game.busy = false;
    game.paused = false;

    $("pause-overlay")?.classList.remove("active");
    $("confirm-overlay")?.classList.remove("active");

    const winnerIndex = game.players[0].health > 0 ? 0 : 1;
    const winner = game.players[winnerIndex];

    setText("winner-name", winner.name);
    setText("victory-title", "VICTORY!");
    setText("victory-subtitle", "The battlefield belongs to you.");

    clearSavedMatch();

    showScreen("victory-screen");
}

/* =====================================================
   SAVE AND RESUME
   ===================================================== */

function saveMatch() {
    if (
        !game.running ||
        game.gameOver ||
        game.screen !== "battle-screen"
    ) {
        return;
    }

    const snapshot = {
        version: 1,
        players: game.players.map(player => ({ ...player })),
        activePlayer: game.activePlayer,
        round: game.round,
        terrain: game.terrain,
        savedAt: Date.now()
    };

    try {
        localStorage.setItem(
            CONFIG.SAVE_KEY,
            JSON.stringify(snapshot)
        );

        updateResumeButton();
    } catch (error) {
        console.warn("Could not save match.", error);
    }
}

function clearSavedMatch() {
    try {
        localStorage.removeItem(CONFIG.SAVE_KEY);
    } catch (error) {
        console.warn("Could not clear saved match.", error);
    }

    updateResumeButton();
}

function getSavedMatch() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(CONFIG.SAVE_KEY) || "null"
        );

        if (
            !saved ||
            saved.version !== 1 ||
            !Array.isArray(saved.players) ||
            saved.players.length !== 2
        ) {
            return null;
        }

        return saved;
    } catch (error) {
        return null;
    }
}

function updateResumeButton() {
    const button = $("resume-match-btn");
    if (!button) return;

    const saved = getSavedMatch();

    button.disabled = !saved;
    button.style.display = saved ? "" : "none";
}

function resumeSavedMatch() {
    const saved = getSavedMatch();

    if (!saved) {
        showNotice("No saved match found.");
        updateResumeButton();
        return;
    }

    game.players = saved.players.map((player, index) => ({
        ...player,
        color: index === 0 ? "blue" : "red"
    }));

    game.activePlayer = clamp(saved.activePlayer || 0, 0, 1);
    game.round = Math.max(1, saved.round || 1);
    game.terrain = Array.isArray(saved.terrain) ? saved.terrain : [];

    game.gameOver = false;
    game.running = true;
    game.paused = false;
    game.busy = false;
    game.effects = [];

    showScreen("battle-screen");

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            drawTerrain();
            positionTanks();
            updateHUD();
            updateControls();
            drawAimGuide();
            startEffectLoop();

            showBattleMessage("MATCH RESUMED");
        });
    });
}

/* =====================================================
   VISUAL EFFECT LOOP
   ===================================================== */

function startEffectLoop() {
    if (game.animationFrame) {
        cancelAnimationFrame(game.animationFrame);
    }

    game.lastFrame = 0;

    function loop(now) {
        if (game.screen !== "battle-screen") {
            game.animationFrame = null;
            return;
        }

        if (!game.paused && !game.gameOver) {
            if (now - game.lastSaved > 1500) {
                game.lastSaved = now;
                saveMatch();
            }
        }

        game.animationFrame = requestAnimationFrame(loop);
    }

    game.animationFrame = requestAnimationFrame(loop);
}

/* =====================================================
   EVENT LISTENERS
   ===================================================== */

function bindEvents() {
    listen("play-btn", "click", () => {
        readPlayerNames();
        showScreen("mode-screen");
    });

    listen("resume-match-btn", "click", resumeSavedMatch);

    listen("settings-btn", "click", openSettings);

    listen("how-to-btn", "click", () => {
        showScreen("how-to-screen");
    });

    listen("local-match-btn", "click", () => {
        readPlayerNames();
        updateTankPreviews();
        showScreen("setup-screen");
    });

    listen("online-match-btn", "click", () => {
        showScreen("online-screen");
    });

    listen("online-back-btn", "click", () => {
        showScreen("mode-screen");
    });

    listen("how-to-back-btn", "click", () => {
        showScreen("main-menu");
    });

    listen("tank1-prev-btn", "click", () => changeTank(0, -1));
    listen("tank1-next-btn", "click", () => changeTank(0, 1));
    listen("tank2-prev-btn", "click", () => changeTank(1, -1));
    listen("tank2-next-btn", "click", () => changeTank(1, 1));

    listen("start-battle-btn", "click", startMatch);

    listen("move-left-btn", "click", () => moveTank(-1));
    listen("move-right-btn", "click", () => moveTank(1));

    listen("fire-btn", "click", fireShell);

    listen("pause-btn", "click", pauseMatch);
    listen("resume-btn", "click", resumeMatch);

    listen("pause-settings-btn", "click", openSettings);

    listen("restart-btn", "click", () => {
        openConfirmation(
            "RESTART MATCH?",
            "The current match progress will be lost.",
            restartMatch
        );
    });

    listen("leave-match-btn", "click", () => {
        openConfirmation(
            "LEAVE MATCH?",
            "Your current match will be abandoned.",
            leaveMatch
        );
    });

    listen("confirm-cancel-btn", "click", closeConfirmation);

    listen("confirm-yes-btn", "click", () => {
        const action = game.confirmAction;

        closeConfirmation();

        if (typeof action === "function") {
            action();
        }
    });

    listen("rematch-btn", "click", startMatch);

    listen("main-menu-btn", "click", () => {
        game.running = false;
        game.gameOver = false;
        clearSavedMatch();
        showScreen("main-menu");
        updateResumeButton();
    });

    listen("settings-back-btn", "click", closeSettings);

    listen("master-volume", "input", event => {
        settings.volume = clamp(Number(event.target.value), 0, 100);
        setText("volume-value", `${settings.volume}%`);
        saveSettings();
    });

    listen("music-toggle", "change", event => {
        settings.music = event.target.checked;
        saveSettings();
    });

    listen("effects-toggle", "change", event => {
        settings.effects = event.target.checked;
        saveSettings();
    });

    listen("power-slider", "input", event => {
        setPower(event.target.value);
    });

    listen("angle-slider", "input", event => {
        setAngle(event.target.value);
    });

    window.addEventListener("resize", () => {
        clearTimeout(game.resizeTimer);

        game.resizeTimer = setTimeout(() => {
            if (game.screen === "battle-screen") {
                drawTerrain();
                positionTanks();
                drawAimGuide();
            }
        }, 120);
    });

    document.addEventListener("visibilitychange", () => {
        if (
            document.hidden &&
            game.running &&
            !game.paused &&
            !game.gameOver
        ) {
            pauseMatch();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if ($("confirm-overlay")?.classList.contains("active")) {
                closeConfirmation();
                return;
            }

            if ($("pause-overlay")?.classList.contains("active")) {
                resumeMatch();
                return;
            }

            if (game.screen === "battle-screen") {
                pauseMatch();
            }
        }
    });
}

/* =====================================================
   INITIALIZATION
   ===================================================== */

function initializeGame() {
    loadSettings();
    bindEvents();
    updateResumeButton();
    updateTankPreviews();

    showScreen("main-menu");

    console.log("Tank War initialized.");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeGame);
} else {
    initializeGame();
}
