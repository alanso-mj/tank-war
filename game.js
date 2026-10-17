(() => {
"use strict";

/* =========================================
   TANK WAR — GAME CONFIGURATION
   ========================================= */

const ASSETS = {
    blueTank: "tank-blue.png",
    redTank: "tank-red.png",
    buttonSound: "button-sound.mp3",
    backgroundMusic: "background-music.mp3"
};

const RULES = {
    startingHealth: 100,

    movementStepsPerTurn: 3,
    movementDistance: 22,

    minimumAngle: 5,
    maximumAngle: 85,

    minimumPower: 20,
    maximumPower: 100,

    gravity: 430,

    blastRadius: 105,
    maximumDamage: 45,
    minimumDamage: 5
};

const SAVE_KEY = "tankWarSaveV2";
const SETTINGS_KEY = "tankWarSettingsV2";

const $ = id => document.getElementById(id);

const TANKS = {
    blue: {
        name: "Blue Tank",
        image: ASSETS.blueTank
    },

    red: {
        name: "Red Tank",
        image: ASSETS.redTank
    }
};

/* =========================================
   DOM ELEMENTS
   ========================================= */

const E = {
    rotate: $("rotate-screen"),
    app: $("game-app"),

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

    tank: [
        $("tank1"),
        $("tank2")
    ],

    image: [
        $("tank1-image"),
        $("tank2-image")
    ],

    projectileLayer: $("projectile-layer"),
    effectLayer: $("effect-layer"),

    left: $("move-left-btn"),
    right: $("move-right-btn"),
    steps: $("movement-time"),

    angle: $("angle-value"),
    power: $("shot-power"),
    powerText: $("power-value"),
    fire: $("fire-btn"),

    turn: $("turn-indicator"),
    round: $("round-number"),

    hudName: [
        $("hud-name1"),
        $("hud-name2")
    ],

    hpText: [
        $("hud-health1-text"),
        $("hud-health2-text")
    ],

    hpFill: [
        $("health1-fill"),
        $("health2-fill")
    ],

    nameplate: [
        $("tank1-nameplate"),
        $("tank2-nameplate")
    ],

    pause: $("battle-menu-overlay"),

    resultTitle: $("result-title"),
    resultEyebrow: $("result-eyebrow"),
    resultImage: $("result-tank-image"),
    winner: $("winner-name"),
    resultDescription: $("result-description"),

    resultHpName: [
        $("result-health1-name"),
        $("result-health2-name")
    ],

    resultHp: [
        $("result-health1"),
        $("result-health2")
    ],

    playerName: [
        $("player1-name"),
        $("player2-name")
    ],

    playerTank: [
        $("player1-tank"),
        $("player2-tank")
    ],

    preview: [
        $("player1-preview"),
        $("player2-preview")
    ],

    vsName: [
        $("vs-player1-name"),
        $("vs-player2-name")
    ],

    vsImage: [
        $("vs-tank1-image"),
        $("vs-tank2-image")
    ],

    effects: $("effects-toggle"),
    music: $("music-toggle"),
    volume: $("volume-slider"),
    volumeText: $("volume-value")
};

const terrainCtx =
    E.terrainCanvas.getContext("2d");

const aimCtx =
    E.aimCanvas.getContext("2d");

/* =========================================
   GAME STATE
   ========================================= */

const G = {
    running: false,
    paused: false,
    busy: false,

    gameMode: "local",

    active: 0,
    round: 1,

    health: [100, 100],
    angle: [45, 45],
    power: 65,

    steps: [3, 3],

    x: [0, 0],
    terrain: [],

    players: [
        {
            name: "Player 1",
            tank: "blue"
        },
        {
            name: "Player 2",
            tank: "red"
        }
    ],

    dragging: false,
    pointerId: null,

    frame: null,
    matchToken: 0,

    settings: {
        effects: true,
        music: false,
        volume: 45
    },

    musicAudio: null,
    buttonAudio: null
};

/* =========================================
   GENERAL HELPERS
   ========================================= */

function clamp(value, minimum, maximum) {
    return Math.max(
        minimum,
        Math.min(maximum, value)
    );
}

function other(player) {
    return player === 0 ? 1 : 0;
}

function tankType(player) {
    return G.players[player].tank === "red"
        ? "red"
        : "blue";
}

function tankImage(player) {
    return TANKS[tankType(player)].image;
            }/* =========================================================
   PART 2 — STYLES, AUDIO, SETTINGS AND SCREEN NAVIGATION
   ========================================================= */

function injectStyles() {
    if ($("tank-war-runtime-styles")) return;

    const style = document.createElement("style");
    style.id = "tank-war-runtime-styles";

    style.textContent = `
        #battlefield {
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
        }

        #tank1, #tank2 {
            transform-origin: center bottom;
            will-change: left, top, transform;
        }

        .tank-cannon {
            position: absolute;
            width: 27px;
            height: 7px;
            left: 50%;
            top: 32%;
            transform-origin: 5px 50%;
            border-radius: 2px 5px 5px 2px;
            background: linear-gradient(
                to bottom,
                #c9c9c9 0%,
                #777 35%,
                #454545 70%,
                #222 100%
            );
            border: 1px solid rgba(0, 0, 0, .65);
            pointer-events: none;
            z-index: 5;
        }

        .projectile {
            position: absolute;
            width: 17px;
            height: 6px;
            border-radius: 2px 7px 7px 2px;
            background: linear-gradient(
                to bottom,
                #fff0b0 0%,
                #e8c47a 20%,
                #858585 45%,
                #353535 80%,
                #171717 100%
            );
            border: 1px solid rgba(20, 20, 20, .9);
            box-shadow:
                0 0 5px rgba(255, 170, 50, .8),
                0 0 11px rgba(255, 100, 20, .35);
            transform-origin: center;
            pointer-events: none;
            z-index: 20;
        }

        .projectile::after {
            content: "";
            position: absolute;
            right: -2px;
            top: 1px;
            width: 3px;
            height: 2px;
            border-radius: 50%;
            background: #fff4cf;
        }

        .tank-war-smoke {
            position: absolute;
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: rgba(120, 120, 120, .65);
            pointer-events: none;
            z-index: 18;
            animation: tankWarSmoke .45s ease-out forwards;
        }

        .tank-war-flash {
            position: absolute;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: radial-gradient(
                circle,
                #fffbd0 0%,
                #ffce56 25%,
                #ff762b 55%,
                rgba(255, 75, 20, 0) 75%
            );
            pointer-events: none;
            z-index: 22;
            animation: tankWarFlash .25s ease-out forwards;
        }

        .tank-war-debris {
            position: absolute;
            width: 5px;
            height: 5px;
            border-radius: 1px;
            pointer-events: none;
            z-index: 19;
            animation: tankWarDebris .55s ease-out forwards;
        }

        .tank-war-damage {
            position: absolute;
            color: #fff;
            font-size: 17px;
            font-weight: 900;
            text-shadow:
                1px 1px 2px #000,
                -1px -1px 2px #000;
            pointer-events: none;
            z-index: 30;
            animation: tankWarDamage .85s ease-out forwards;
        }

        @keyframes tankWarSmoke {
            from {
                opacity: .8;
                transform: translate(0, 0) scale(.7);
            }
            to {
                opacity: 0;
                transform: translate(-8px, -17px) scale(1.8);
            }
        }

        @keyframes tankWarFlash {
            from {
                opacity: 1;
                transform: scale(.4);
            }
            to {
                opacity: 0;
                transform: scale(1.7);
            }
        }

        @keyframes tankWarDebris {
            from {
                opacity: 1;
                transform: translate(0, 0) rotate(0deg);
            }
            to {
                opacity: 0;
                transform: translate(var(--debris-x), var(--debris-y))
                    rotate(180deg);
            }
        }

        @keyframes tankWarDamage {
            from {
                opacity: 1;
                transform: translate(-50%, 0);
            }
            to {
                opacity: 0;
                transform: translate(-50%, -36px);
            }
        }
    `;

    document.head.appendChild(style);
}

/* ---------------- AUDIO AND SETTINGS ---------------- */

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(G.settings));
    } catch (error) {
        console.warn("Could not save settings:", error);
    }
}

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");

        G.settings.effects =
            typeof saved.effects === "boolean" ? saved.effects : true;

        G.settings.music =
            typeof saved.music === "boolean" ? saved.music : false;

        G.settings.volume = clamp(
            Number(saved.volume ?? 45),
            0,
            100
        );
    } catch (error) {
        G.settings = {
            effects: true,
            music: false,
            volume: 45
        };
    }

    if (E.effects) E.effects.checked = G.settings.effects;
    if (E.music) E.music.checked = G.settings.music;

    if (E.volume) {
        E.volume.value = String(G.settings.volume);
    }

    updateVolume();
}

function updateVolume() {
    const volume = G.settings.volume / 100;

    if (E.volumeText) {
        E.volumeText.textContent = `${G.settings.volume}%`;
    }

    if (G.musicAudio) {
        G.musicAudio.volume = volume;
    }

    if (G.buttonAudio) {
        G.buttonAudio.volume = volume;
    }
}

function startMusic() {
    if (!G.settings.music) return;

    if (!G.musicAudio) {
        G.musicAudio = new Audio(ASSETS.backgroundMusic);
        G.musicAudio.loop = true;
    }

    G.musicAudio.volume = G.settings.volume / 100;

    const playPromise = G.musicAudio.play();

    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
            // Browsers may block autoplay until the user interacts.
        });
    }
}

function stopMusic() {
    if (G.musicAudio) {
        G.musicAudio.pause();
        G.musicAudio.currentTime = 0;
    }
}

function buttonSound() {
    if (!G.settings.effects) return;

    try {
        if (!G.buttonAudio) {
            G.buttonAudio = new Audio(ASSETS.buttonSound);
        }

        G.buttonAudio.currentTime = 0;
        G.buttonAudio.volume = G.settings.volume / 100;

        const playPromise = G.buttonAudio.play();

        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
        }
    } catch (error) {
        // Sound is optional; the game should continue without it.
    }
}

/* ---------------- SCREEN NAVIGATION ---------------- */

function showScreen(screen) {
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

    screens.forEach(element => {
        if (!element) return;

        element.classList.remove("active");
        element.setAttribute("aria-hidden", "true");
    });

    if (screen) {
        screen.classList.add("active");
        screen.setAttribute("aria-hidden", "false");
    }

    updateOrientation();

    if (screen === E.battle) {
        requestAnimationFrame(() => {
            resizeCanvases();
            positionTanks();
            drawAimGuide();
        });
    }
}

function updateOrientation() {
    if (!E.rotate || !E.app) return;

    const isBattle = Boolean(
        E.battle && E.battle.classList.contains("active")
    );

    const portrait = window.innerHeight > window.innerWidth;
    const shouldRotate = isBattle && portrait;

    E.rotate.style.display = shouldRotate ? "flex" : "none";

    /*
     * Keep the app visible behind the rotation notice.
     * This prevents the game from disappearing when the
     * device changes between portrait and landscape.
     */
    E.app.style.visibility = "visible";
}

/* ---------------- BASIC INPUT HELPERS ---------------- */

function pointInField(event) {
    const rect = E.field.getBoundingClientRect();

    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function fieldSize() {
    const rect = E.field.getBoundingClientRect();

    return {
        width: rect.width,
        height: rect.height
    };
}

/* ---------------- CANVAS AND TERRAIN SETUP ---------------- */

function terrainYAt(x) {
    const width = E.field.clientWidth;
    const height = E.field.clientHeight;

    if (!G.terrain.length || width <= 0) {
        return height * 0.75;
    }

    const scaledX = clamp(x, 0, width - 1);
    const index = Math.round(
        scaledX / Math.max(1, width - 1) *
        (G.terrain.length - 1)
    );

    return G.terrain[
        clamp(index, 0, G.terrain.length - 1)
    ];
}

function generateTerrain() {
    const { width, height } = fieldSize();

    if (width <= 0 || height <= 0) return;

    const count = Math.max(2, Math.ceil(width));

    G.terrain = new Array(count);

    let current = height * 0.72;

    for (let i = 0; i < count; i++) {
        current += (Math.random() - 0.5) * 2.5;

        const waveA = Math.sin(i * 0.009) * height * 0.035;
        const waveB = Math.sin(i * 0.021) * height * 0.018;

        current = clamp(
            current,
            height * 0.48,
            height * 0.84
        );

        G.terrain[i] = clamp(
            current + waveA + waveB,
            height * 0.45,
            height * 0.86
        );
    }

    drawTerrain();
}

function drawTerrain() {
    const width = E.field.clientWidth;
    const height = E.field.clientHeight;

    if (!width || !height || !G.terrain.length) return;

    terrainCtx.clearRect(0, 0, width, height);

    terrainCtx.beginPath();
    terrainCtx.moveTo(0, height);

    for (let x = 0; x < G.terrain.length; x++) {
        terrainCtx.lineTo(x, G.terrain[x]);
    }

    terrainCtx.lineTo(width, height);
    terrainCtx.closePath();

    const groundGradient = terrainCtx.createLinearGradient(
        0,
        height * 0.45,
        0,
        height
    );

    groundGradient.addColorStop(0, "#687b39");
    groundGradient.addColorStop(1, "#354321");

    terrainCtx.fillStyle = groundGradient;
    terrainCtx.fill();

    terrainCtx.beginPath();

    for (let x = 0; x < G.terrain.length; x++) {
        if (x === 0) {
            terrainCtx.moveTo(x, G.terrain[x]);
        } else {
            terrainCtx.lineTo(x, G.terrain[x]);
        }
    }

    terrainCtx.strokeStyle = "#a3b65e";
    terrainCtx.lineWidth = 2;
    terrainCtx.stroke();
}

function resizeCanvases() {
    if (!E.field || !E.terrainCanvas || !E.aimCanvas) return;

    const width = E.field.clientWidth;
    const height = E.field.clientHeight;

    if (width <= 0 || height <= 0) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);

    [E.terrainCanvas, E.aimCanvas].forEach(canvas => {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);

        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const context = canvas.getContext("2d");

        context.setTransform(dpr, 0, 0, dpr, 0, 0);
    });

    if (!G.terrain.length) {
        generateTerrain();
    } else {
        drawTerrain();
    }

    drawAimGuide();
}

/* End of Part 2 *//* =========================================================
   PART 3 — TANK POSITIONING, PLAYER DETAILS AND HUD
   ========================================================= */

/* ---------------- TANK BARREL ---------------- */

function ensureCannon(player) {
    const tank = E.tank[player];

    if (!tank) return null;

    let cannon = tank.querySelector(".tank-cannon");

    if (!cannon) {
        cannon = document.createElement("div");
        cannon.className = "tank-cannon";
        cannon.setAttribute("aria-hidden", "true");
        tank.appendChild(cannon);
    }

    return cannon;
}

/* ---------------- TERRAIN SLOPE ---------------- */

function slopeAt(x) {
    const width = E.field.clientWidth;

    const leftX = clamp(x - 5, 0, width - 1);
    const rightX = clamp(x + 5, 0, width - 1);

    const leftY = terrainYAt(leftX);
    const rightY = terrainYAt(rightX);

    return Math.atan2(
        rightY - leftY,
        Math.max(1, rightX - leftX)
    ) * 180 / Math.PI;
}

/* ---------------- TANK POSITIONS ---------------- */

function positionTanks() {
    if (!E.field || !G.terrain.length) return;

    const width = E.field.clientWidth;
    const height = E.field.clientHeight;

    if (width <= 0 || height <= 0) return;

    /*
     * Keep both tanks inside the battlefield and prevent
     * them from overlapping.
     */
    const margin = Math.min(50, width * 0.12);
    const separation = Math.min(130, width * 0.3);

    G.x[0] = clamp(
        Number(G.x[0] || width * 0.16),
        margin,
        width - margin
    );

    G.x[1] = clamp(
        Number(G.x[1] || width * 0.84),
        margin,
        width - margin
    );

    if (G.x[1] - G.x[0] < separation) {
        const midpoint = (G.x[0] + G.x[1]) / 2;

        G.x[0] = clamp(
            midpoint - separation / 2,
            margin,
            width - margin
        );

        G.x[1] = clamp(
            midpoint + separation / 2,
            margin,
            width - margin
        );
    }

    for (let player = 0; player < 2; player++) {
        const tank = E.tank[player];

        if (!tank) continue;

        const tankWidth = tank.offsetWidth || 58;
        const tankHeight = tank.offsetHeight || 42;

        const x = G.x[player];
        const groundY = terrainYAt(x);

        tank.style.left = `${x - tankWidth / 2}px`;
        tank.style.top = `${groundY - tankHeight + 5}px`;

        /*
         * Use a small rotation to follow the ground.
         * Player 2 faces the opposite direction.
         */
        const terrainAngle = slopeAt(x);
        const facingAngle = player === 0 ? 0 : 180;

        tank.style.transform =
            `rotate(${terrainAngle}deg) scaleX(${player === 0 ? 1 : -1})`;

        tank.style.transformOrigin = "center bottom";

        const cannon = ensureCannon(player);

        if (cannon) {
            const aimAngle = clamp(
                Number(G.angle[player] || 45),
                RULES.minimumAngle,
                RULES.maximumAngle
            );

            const direction = player === 0 ? -1 : 1;

            cannon.style.transform =
                `rotate(${-direction * aimAngle}deg)`;

            cannon.style.left = "50%";
        }

        if (E.image[player]) {
            E.image[player].draggable = false;
        }
    }

    drawAimGuide();
}

/* ---------------- PROJECTILE START POSITION ---------------- */

function muzzle(player) {
    const tank = E.tank[player];

    if (!tank) {
        return {
            x: G.x[player],
            y: terrainYAt(G.x[player]) - 25
        };
    }

    const rect = tank.getBoundingClientRect();
    const fieldRect = E.field.getBoundingClientRect();

    const direction = player === 0 ? 1 : -1;
    const angle = G.angle[player] * Math.PI / 180;

    /*
     * Position the shell near the front/top of the tank.
     * This avoids launching it from the center of the image.
     */
    const baseX =
        rect.left - fieldRect.left +
        rect.width / 2;

    const baseY =
        rect.top - fieldRect.top +
        rect.height * 0.34;

    const barrelLength = 24;

    return {
        x: baseX + Math.cos(angle) * barrelLength * direction,
        y: baseY - Math.sin(angle) * barrelLength
    };
}

/* ---------------- PLAYER DETAILS ---------------- */

function setPlayerDetails() {
    for (let player = 0; player < 2; player++) {
        const playerName = G.players[player].name || `Player ${player + 1}`;
        const image = tankImage(player);

        if (E.hudName[player]) {
            E.hudName[player].textContent = playerName;
        }

        if (E.nameplate[player]) {
            E.nameplate[player].textContent = playerName;
        }

        if (E.playerName[player]) {
            E.playerName[player].value = playerName;
        }

        if (E.playerTank[player]) {
            E.playerTank[player].value = tankType(player);
        }

        if (E.preview[player]) {
            E.preview[player].src = image;
        }

        if (E.vsName[player]) {
            E.vsName[player].textContent = playerName;
        }

        if (E.vsImage[player]) {
            E.vsImage[player].src = image;
        }

        if (E.image[player]) {
            E.image[player].src = image;
            E.image[player].alt = `${playerName}'s tank`;
        }

        if (E.resultHpName[player]) {
            E.resultHpName[player].textContent = playerName;
        }
    }
}

/* ---------------- HEALTH HUD ---------------- */

function updateHealth() {
    for (let player = 0; player < 2; player++) {
        const health = clamp(G.health[player], 0, 100);

        if (E.hpText[player]) {
            E.hpText[player].textContent = `${Math.round(health)}%`;
        }

        if (E.hpFill[player]) {
            E.hpFill[player].style.width = `${health}%`;
        }

        if (E.resultHp[player]) {
            E.resultHp[player].style.width = `${health}%`;
        }
    }
}

/* ---------------- CONTROL STATE ---------------- */

function updateControls() {
    const active = G.active;
    const canControl =
        G.running &&
        !G.paused &&
        !G.busy &&
        G.health[active] > 0;

    if (E.left) {
        E.left.disabled = !canControl || G.steps[active] <= 0;
    }

    if (E.right) {
        E.right.disabled = !canControl || G.steps[active] <= 0;
    }

    if (E.steps) {
        E.steps.textContent = String(G.steps[active]);
    }

    if (E.angle) {
        E.angle.textContent = `${Math.round(G.angle[active])}°`;
    }

    if (E.power) {
        E.power.value = String(G.power);
        E.power.disabled = !canControl;
    }

    if (E.powerText) {
        E.powerText.textContent = `${Math.round(G.power)}%`;
    }

    if (E.fire) {
        E.fire.disabled = !canControl;
    }
}

/* ---------------- TURN INDICATOR ---------------- */

function updateTurn() {
    const active = G.active;

    if (E.turn) {
        E.turn.textContent =
            `${G.players[active].name || `Player ${active + 1}`}'s Turn`;
    }

    if (E.round) {
        E.round.textContent = String(G.round);
    }

    for (let player = 0; player < 2; player++) {
        if (E.tank[player]) {
            E.tank[player].classList.toggle(
                "active-tank",
                player === active
            );
        }
    }

    updateControls();
    updateHealth();
}

/* End of Part 3 *//* =========================================================
   PART 4 — AIMING, TRAJECTORY, MOVEMENT AND PROJECTILES
   ========================================================= */

/* ---------------- AIMING HELPERS ---------------- */

function nearActiveTank(point) {
    const player = G.active;
    const tank = E.tank[player];

    if (!tank) return false;

    const rect = tank.getBoundingClientRect();
    const fieldRect = E.field.getBoundingClientRect();

    const tankLeft = rect.left - fieldRect.left;
    const tankTop = rect.top - fieldRect.top;

    const localX = point.x - tankLeft;
    const localY = point.y - tankTop;

    return (
        localX >= -35 &&
        localX <= rect.width + 35 &&
        localY >= -45 &&
        localY <= rect.height + 20
    );
}

function beginAim(event) {
    if (
        !G.running ||
        G.paused ||
        G.busy ||
        G.health[G.active] <= 0
    ) {
        return;
    }

    const point = pointInField(event);

    G.dragging = true;
    G.pointerId = event.pointerId;

    if (E.field.setPointerCapture) {
        try {
            E.field.setPointerCapture(event.pointerId);
        } catch (error) {
            // Pointer capture is optional.
        }
    }

    updateAim(point);
}

function fieldPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;

    const target = event.target;

    if (
        target.closest(
            "button, input, select, textarea, label, " +
            ".battle-controls, .battle-topbar, .overlay"
        )
    ) {
        return;
    }

    const point = pointInField(event);

    /*
     * Start aiming when the player presses near their tank
     * or on the battlefield.
     */
    if (nearActiveTank(point) || target === E.field ||
        target === E.aimCanvas || target === E.terrainCanvas ||
        target === E.projectileLayer) {
        beginAim(event);
    }
}

function updateAim(point) {
    if (!G.running || G.paused || G.busy) return;

    const player = G.active;
    const tankPoint = muzzle(player);

    const dx = point.x - tankPoint.x;
    const dy = tankPoint.y - point.y;

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    const direction = player === 0 ? 1 : -1;

    let angle = Math.atan2(
        Math.abs(dy),
        Math.abs(dx)
    ) * 180 / Math.PI;

    angle = clamp(
        angle,
        RULES.minimumAngle,
        RULES.maximumAngle
    );

    G.angle[player] = angle;

    drawAimGuide();
    positionTanks();
    updateControls();
}

function endAim(event) {
    if (!G.dragging) return;

    if (
        event &&
        G.pointerId !== null &&
        event.pointerId !== undefined &&
        event.pointerId !== G.pointerId
    ) {
        return;
    }

    G.dragging = false;
    G.pointerId = null;

    drawAimGuide();
}

/* ---------------- AIM TRAJECTORY ---------------- */

function drawAimGuide() {
    if (!aimCtx || !E.field) return;

    const width = E.field.clientWidth;
    const height = E.field.clientHeight;

    aimCtx.clearRect(0, 0, width, height);

    if (
        !G.running ||
        G.paused ||
        G.busy ||
        !G.terrain.length
    ) {
        return;
    }

    const player = G.active;
    const start = muzzle(player);
    const angle = G.angle[player] * Math.PI / 180;
    const direction = player === 0 ? 1 : -1;

    const speed = 140 + G.power * 3.2;

    const vx = Math.cos(angle) * speed * direction;
    const vy = -Math.sin(angle) * speed;

    const gravity = RULES.gravity;

    aimCtx.beginPath();
    aimCtx.setLineDash([4, 5]);
    aimCtx.lineWidth = 2;
    aimCtx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    aimCtx.moveTo(start.x, start.y);

    let reachedGround = false;

    for (let time = 0; time <= 1.8; time += 0.035) {
        const x = start.x + vx * time;
        const y = start.y + vy * time +
            0.5 * gravity * time * time;

        if (
            x < 0 ||
            x > width ||
            y > height
        ) {
            break;
        }

        aimCtx.lineTo(x, y);

        if (y >= terrainYAt(x)) {
            reachedGround = true;
            break;
        }
    }

    aimCtx.stroke();
    aimCtx.setLineDash([]);

    if (!reachedGround) return;

    /*
     * Add a small endpoint marker at the predicted impact.
     */
    const last = getPredictedImpact(start, vx, vy, gravity);

    if (last) {
        aimCtx.beginPath();
        aimCtx.arc(last.x, last.y, 4, 0, Math.PI * 2);
        aimCtx.fillStyle = "#ffe28a";
        aimCtx.fill();
    }
}

function getPredictedImpact(start, vx, vy, gravity) {
    const width = E.field.clientWidth;
    const height = E.field.clientHeight;

    for (let time = 0; time <= 1.8; time += 0.015) {
        const x = start.x + vx * time;
        const y = start.y + vy * time +
            0.5 * gravity * time * time;

        if (
            x < 0 ||
            x >= width ||
            y >= height
        ) {
            return null;
        }

        if (y >= terrainYAt(x)) {
            return {
                x,
                y: terrainYAt(x)
            };
        }
    }

    return null;
}

/* ---------------- TANK MOVEMENT ---------------- */

function moveTank(direction) {
    if (
        !G.running ||
        G.paused ||
        G.busy ||
        G.steps[G.active] <= 0
    ) {
        return;
    }

    const player = G.active;
    const width = E.field.clientWidth;
    const margin = 35;

    const proposedX = clamp(
        G.x[player] + direction * RULES.movementDistance,
        margin,
        width - margin
    );

    const opponent = other(player);
    const minimumGap = 65;

    if (
        player === 0 &&
        proposedX >= G.x[opponent] - minimumGap
    ) {
        return;
    }

    if (
        player === 1 &&
        proposedX <= G.x[opponent] + minimumGap
    ) {
        return;
    }

    G.x[player] = proposedX;
    G.steps[player]--;

    buttonSound();
    positionTanks();
    updateControls();
    drawAimGuide();
}

/* ---------------- VISUAL EFFECTS ---------------- */

function smoke(x, y) {
    if (!G.settings.effects || !E.effectLayer) return;

    const puff = document.createElement("div");

    puff.className = "tank-war-smoke";
    puff.style.left = `${x}px`;
    puff.style.top = `${y}px`;

    E.effectLayer.appendChild(puff);

    setTimeout(() => puff.remove(), 500);
}

function flash(x, y) {
    if (!G.settings.effects || !E.effectLayer) return;

    const element = document.createElement("div");

    element.className = "tank-war-flash";
    element.style.left = `${x - 12}px`;
    element.style.top = `${y - 12}px`;

    E.effectLayer.appendChild(element);

    setTimeout(() => element.remove(), 300);
}

function explosion(x, y) {
    if (!E.effectLayer) return;

    if (G.settings.effects) {
        flash(x, y);

        for (let i = 0; i < 12; i++) {
            const debris = document.createElement("div");

            debris.className = "tank-war-debris";
            debris.style.left = `${x}px`;
            debris.style.top = `${y}px`;
            debris.style.background =
                i % 2 ? "#f5a33b" : "#d8d8d8";

            const angle = Math.random() * Math.PI * 2;
            const distance = 18 + Math.random() * 42;

            debris.style.setProperty(
                "--debris-x",
                `${Math.cos(angle) * distance}px`
            );

            debris.style.setProperty(
                "--debris-y",
                `${Math.sin(angle) * distance}px`
            );

            E.effectLayer.appendChild(debris);

            setTimeout(() => debris.remove(), 650);
        }
    }
}

function damageLabel(x, y, damage) {
    if (!E.effectLayer) return;

    const label = document.createElement("div");

    label.className = "tank-war-damage";
    label.textContent = `-${Math.round(damage)}`;
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;

    E.effectLayer.appendChild(label);

    setTimeout(() => label.remove(), 900);
}

/* End of Part 4 *//* =========================================================
   PART 5 — TERRAIN DAMAGE, FIRING, TURNS AND MATCH LIFECYCLE
   ========================================================= */

/* ---------------- DESTRUCTIBLE TERRAIN ---------------- */

function deformTerrain(impactX, impactY, radius) {
    if (!G.terrain.length) return;

    const width = E.field.clientWidth;
    const height = E.field.clientHeight;

    const centerX = clamp(impactX, 0, width - 1);
    const centerIndex = Math.round(
        centerX / Math.max(1, width - 1) *
        (G.terrain.length - 1)
    );

    const radiusInPoints = Math.max(1, Math.round(radius));

    for (
        let index = Math.max(0, centerIndex - radiusInPoints);
        index <= Math.min(
            G.terrain.length - 1,
            centerIndex + radiusInPoints
        );
        index++
    ) {
        const distance = Math.abs(index - centerIndex);

        if (distance > radiusInPoints) continue;

        const normalized = distance / radiusInPoints;
        const craterDepth =
            Math.sqrt(Math.max(0, 1 - normalized * normalized)) *
            radius * 0.48;

        G.terrain[index] = clamp(
            Math.max(G.terrain[index], impactY + craterDepth),
            height * 0.35,
            height
        );
    }

    drawTerrain();
    positionTanks();
}

/* ---------------- DAMAGE CALCULATION ---------------- */

function calculateDamage(distance, power) {
    const radius = RULES.blastRadius;

    if (distance >= radius) return 0;

    const falloff = 1 - distance / radius;

    return clamp(
        RULES.minimumDamage +
        falloff * (power / 100) * RULES.maximumDamage,
        0,
        RULES.maximumDamage
    );
}

/* ---------------- FIRE PROJECTILE ---------------- */

function fireShot() {
    if (
        !G.running ||
        G.paused ||
        G.busy ||
        G.health[G.active] <= 0
    ) {
        return;
    }

    G.busy = true;
    G.dragging = false;
    G.pointerId = null;

    updateControls();

    const player = G.active;
    const start = muzzle(player);
    const direction = player === 0 ? 1 : -1;
    const angle = G.angle[player] * Math.PI / 180;
    const speed = 140 + G.power * 3.2;

    const vx = Math.cos(angle) * speed * direction;
    const vy = -Math.sin(angle) * speed;
    const gravity = RULES.gravity;

    const shell = document.createElement("div");

    shell.className = "projectile";
    shell.setAttribute("aria-hidden", "true");

    shell.style.left = `${start.x}px`;
    shell.style.top = `${start.y}px`;

    E.projectileLayer.appendChild(shell);

    flash(start.x, start.y);
    buttonSound();

    const startTime = performance.now();
    const matchToken = G.matchToken;

    let lastSmoke = 0;
    let finished = false;

    function finish(x, y, hitTank) {
        if (finished) return;

        finished = true;
        shell.remove();

        if (matchToken !== G.matchToken) return;

        resolveImpact(x, y, hitTank, player);

        G.busy = false;
        updateControls();
    }

    function animate(now) {
        if (finished) return;

        if (matchToken !== G.matchToken) {
            shell.remove();
            return;
        }

        if (!G.running) {
            shell.remove();
            finished = true;
            return;
        }

        if (G.paused) {
            requestAnimationFrame(animate);
            return;
        }

        const elapsed = (now - startTime) / 1000;

        const x = start.x + vx * elapsed;
        const y = start.y + vy * elapsed +
            0.5 * gravity * elapsed * elapsed;

        const width = E.field.clientWidth;
        const height = E.field.clientHeight;

        const shellAngle = Math.atan2(
            vy + gravity * elapsed,
            vx
        ) * 180 / Math.PI;

        shell.style.left = `${x}px`;
        shell.style.top = `${y}px`;
        shell.style.transform = `translate(-50%, -50%) rotate(${shellAngle}deg)`;

        if (G.settings.effects && now - lastSmoke > 70) {
            smoke(x, y);
            lastSmoke = now;
        }

        /*
         * Check whether the shell reaches the opposing tank.
         */
        const opponent = other(player);
        const target = E.tank[opponent];

        if (target) {
            const rect = target.getBoundingClientRect();
            const fieldRect = E.field.getBoundingClientRect();

            const targetX =
                rect.left - fieldRect.left + rect.width / 2;

            const targetY =
                rect.top - fieldRect.top + rect.height / 2;

            if (Math.hypot(x - targetX, y - targetY) < 25) {
                finish(x, y, opponent);
                return;
            }
        }

        if (
            x < 0 ||
            x > width ||
            y < 0 ||
            y >= height ||
            y >= terrainYAt(x)
        ) {
            finish(
                clamp(x, 0, width),
                clamp(y, 0, height),
                null
            );
            return;
        }

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}

/* ---------------- IMPACT RESOLUTION ---------------- */

function resolveImpact(x, y, hitTank, shooter) {
    explosion(x, y);

    const radius = RULES.blastRadius;

    deformTerrain(x, y, radius * 0.55);

    const opponent = other(shooter);
    const tank = E.tank[opponent];

    if (!tank) {
        finishImpactTurn();
        return;
    }

    const rect = tank.getBoundingClientRect();
    const fieldRect = E.field.getBoundingClientRect();

    const targetX =
        rect.left - fieldRect.left + rect.width / 2;

    const targetY =
        rect.top - fieldRect.top + rect.height / 2;

    const distance = Math.hypot(
        x - targetX,
        y - targetY
    );

    /*
     * A direct hit gets full damage; nearby impacts use
     * distance-based blast damage.
     */
    const distanceForDamage =
        hitTank === opponent ? 0 : distance;

    const damage = calculateDamage(
        distanceForDamage,
        G.power
    );

    if (damage > 0) {
        G.health[opponent] = clamp(
            G.health[opponent] - damage,
            0,
            100
        );

        damageLabel(targetX, targetY - 15, damage);
        updateHealth();
    }

    if (G.health[opponent] <= 0) {
        finishMatch(shooter);
        return;
    }

    finishImpactTurn();
}

/* ---------------- TURN MANAGEMENT ---------------- */

function finishImpactTurn() {
    if (!G.running) return;

    G.active = other(G.active);

    if (G.active === 0) {
        G.round++;
    }

    G.steps[G.active] = RULES.movementStepsPerTurn;

    updateTurn();
    positionTanks();
    drawAimGuide();
}

function nextTurn() {
    if (!G.running || G.paused || G.busy) return;

    G.active = other(G.active);

    if (G.active === 0) {
        G.round++;
    }

    G.steps[G.active] = RULES.movementStepsPerTurn;

    updateTurn();
    positionTanks();
    drawAimGuide();
}

/* ---------------- EFFECT CLEANUP ---------------- */

function clearEffects() {
    if (E.projectileLayer) {
        E.projectileLayer.replaceChildren();
    }

    if (E.effectLayer) {
        E.effectLayer.replaceChildren();
    }

    if (aimCtx && E.aimCanvas) {
        aimCtx.clearRect(
            0,
            0,
            E.field.clientWidth,
            E.field.clientHeight
        );
    }
}

/* ---------------- MATCH START ---------------- */

function startMatch() {
    G.matchToken++;
    G.running = true;
    G.paused = false;
    G.busy = false;

    G.active = 0;
    G.round = 1;

    G.health = [100, 100];
    G.steps = [
        RULES.movementStepsPerTurn,
        RULES.movementStepsPerTurn
    ];

    G.angle = [45, 45];
    G.power = 65;

    G.dragging = false;
    G.pointerId = null;

    clearEffects();

    const width = E.field.clientWidth;

    G.x = [
        width * 0.16,
        width * 0.84
    ];

    generateTerrain();
    setPlayerDetails();
    updateHealth();
    updateTurn();
    positionTanks();

    showScreen(E.battle);
    saveGame();
}

function prepareMatch() {
    G.players = [
        {
            name: E.playerName[0]?.value.trim() || "Player 1",
            tank: E.playerTank[0]?.value || "blue"
        },
        {
            name: E.playerName[1]?.value.trim() || "Player 2",
            tank: E.playerTank[1]?.value || "red"
        }
    ];

    setPlayerDetails();
    startMatch();
}

/* ---------------- MATCH END ---------------- */

function finishMatch(winner) {
    G.running = false;
    G.paused = false;
    G.busy = false;
    G.dragging = false;

    clearEffects();
    stopMusic();

    const winnerName =
        G.players[winner]?.name || `Player ${winner + 1}`;

    if (E.resultTitle) {
        E.resultTitle.textContent = "VICTORY!";
    }

    if (E.resultEyebrow) {
        E.resultEyebrow.textContent = "BATTLE COMPLETE";
    }

    if (E.winner) {
        E.winner.textContent = winnerName;
    }

    if (E.resultDescription) {
        E.resultDescription.textContent =
            `${winnerName} won the battle!`;
    }

    if (E.resultImage) {
        E.resultImage.src = tankImage(winner);
    }

    updateHealth();
    showScreen(E.result);
}

/* End of Part 5 */
 /* =========================================================
   PART 6 — SAVE/RESUME, PREVIEWS, EVENTS AND INITIALIZATION
   ========================================================= */

/* ---------------- SAVE GAME ---------------- */

function saveGame() {
    try {
        const data = {
            version: 3,
            running: G.running,
            paused: G.paused,
            gameMode: G.gameMode,
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

        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (error) {
        console.warn("Could not save the game:", error);
    }
}

/* ---------------- RESUME GAME ---------------- */

function resumeGame() {
    let data;

    try {
        data = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    } catch (error) {
        data = null;
    }

    if (!data || !Array.isArray(data.health) ||
        !Array.isArray(data.players)) {
        showScreen(E.menu);
        return;
    }

    G.matchToken++;

    G.running = Boolean(data.running);
    G.paused = false;
    G.busy = false;
    G.dragging = false;
    G.pointerId = null;

    G.gameMode = data.gameMode || "local";
    G.active = clamp(Number(data.active) || 0, 0, 1);
    G.round = Math.max(1, Number(data.round) || 1);

    G.health = [
        clamp(Number(data.health[0]) || 0, 0, 100),
        clamp(Number(data.health[1]) || 0, 0, 100)
    ];

    G.angle = [
        clamp(Number(data.angle?.[0]) || 45,
            RULES.minimumAngle, RULES.maximumAngle),
        clamp(Number(data.angle?.[1]) || 45,
            RULES.minimumAngle, RULES.maximumAngle)
    ];

    G.power = clamp(
        Number(data.power) || 65,
        RULES.minimumPower,
        RULES.maximumPower
    );

    G.steps = [
        clamp(Number(data.steps?.[0]) || 0, 0,
            RULES.movementStepsPerTurn),
        clamp(Number(data.steps?.[1]) || 0, 0,
            RULES.movementStepsPerTurn)
    ];

    G.players = [0, 1].map(index => ({
        name: data.players[index]?.name || `Player ${index + 1}`,
        tank: data.players[index]?.tank === "red" ? "red" : "blue"
    }));

    showScreen(E.battle);

    requestAnimationFrame(() => {
        resizeCanvases();

        const width = E.field.clientWidth;
        const height = E.field.clientHeight;

        if (
            Array.isArray(data.terrain) &&
            data.terrain.length > 1
        ) {
            /*
             * Convert saved terrain heights to the current
             * battlefield height if the screen size changed.
             */
            const oldTerrain = data.terrain;
            const oldMaximum = Math.max(...oldTerrain, 1);

            G.terrain = Array.from(
                { length: Math.max(2, Math.ceil(width)) },
                (_, index, array) => {
                    const oldIndex = Math.round(
                        index / Math.max(1, array.length - 1) *
                        (oldTerrain.length - 1)
                    );

                    return clamp(
                        oldTerrain[oldIndex] / oldMaximum * height,
                        height * 0.35,
                        height
                    );
                }
            );
        } else {
            generateTerrain();
        }

        G.x = [
            clamp(Number(data.x?.[0]) || width * 0.16, 35, width - 35),
            clamp(Number(data.x?.[1]) || width * 0.84, 35, width - 35)
        ];

        clearEffects();
        setPlayerDetails();
        drawTerrain();
        positionTanks();
        updateTurn();
        updateHealth();
        drawAimGuide();
    });
}

/* ---------------- PREVIEW UPDATES ---------------- */

function updatePreviews() {
    for (let player = 0; player < 2; player++) {
        const name = E.playerName[player]?.value.trim() ||
            `Player ${player + 1}`;

        const selectedTank = E.playerTank[player]?.value === "red"
            ? "red"
            : "blue";

        if (E.preview[player]) {
            E.preview[player].src = TANKS[selectedTank].image;
        }

        if (E.vsName[player]) {
            E.vsName[player].textContent = name;
        }

        if (E.vsImage[player]) {
            E.vsImage[player].src = TANKS[selectedTank].image;
        }
    }
}

/* ---------------- EVENT BINDING ---------------- */

function bindEvents() {
    /*
     * Main menu navigation.
     */
    document.querySelectorAll("[data-screen]").forEach(button => {
        button.addEventListener("click", () => {
            const screenName = button.dataset.screen;
            const screen = $(screenName);

            if (screen) {
                buttonSound();
                showScreen(screen);
            }
        });
    });

    /*
     * Buttons with common game actions.
     */
    document.querySelectorAll("[data-action]").forEach(button => {
        button.addEventListener("click", () => {
            const action = button.dataset.action;

            switch (action) {
                case "local":
                case "play-local":
                    G.gameMode = "local";
                    showScreen(E.setup);
                    break;

                case "start":
                case "start-game":
                    prepareMatch();
                    break;

                case "resume":
                    resumeGame();
                    break;

                case "restart":
                case "rematch":
                    prepareMatch();
                    break;

                case "main-menu":
                    G.running = false;
                    G.paused = false;
                    G.busy = false;
                    G.matchToken++;
                    stopMusic();
                    clearEffects();
                    showScreen(E.menu);
                    break;

                case "settings":
                    showScreen(E.settings);
                    break;

                case "back":
                    showScreen(E.menu);
                    break;

                case "pause":
                    G.paused = true;
                    if (E.pause) {
                        E.pause.classList.add("active");
                    }
                    updateControls();
                    break;

                case "continue":
                case "unpause":
                    G.paused = false;
                    if (E.pause) {
                        E.pause.classList.remove("active");
                    }
                    updateControls();
                    drawAimGuide();
                    break;

                case "fire":
                    fireShot();
                    break;

                case "next-turn":
                    nextTurn();
                    break;

                default:
                    break;
            }

            buttonSound();
        });
    });

    /*
     * Movement buttons.
     */
    if (E.left) {
        E.left.addEventListener("click", () => {
            moveTank(-1);
        });
    }

    if (E.right) {
        E.right.addEventListener("click", () => {
            moveTank(1);
        });
    }

    /*
     * Power slider.
     */
    if (E.power) {
        E.power.addEventListener("input", () => {
            G.power = clamp(
                Number(E.power.value),
                RULES.minimumPower,
                RULES.maximumPower
            );

            updateControls();
            drawAimGuide();
        });
    }

    /*
     * Tank selection and player-name changes.
     */
    E.playerName.forEach(input => {
        if (!input) return;

        input.addEventListener("input", updatePreviews);
    });

    E.playerTank.forEach(select => {
        if (!select) return;

        select.addEventListener("change", updatePreviews);
    });

    /*
     * Settings controls.
     */
    if (E.effects) {
        E.effects.addEventListener("change", () => {
            G.settings.effects = E.effects.checked;
            saveSettings();
        });
    }

    if (E.music) {
        E.music.addEventListener("change", () => {
            G.settings.music = E.music.checked;

            saveSettings();

            if (G.settings.music) {
                startMusic();
            } else {
                stopMusic();
            }
        });
    }

    if (E.volume) {
        E.volume.addEventListener("input", () => {
            G.settings.volume = clamp(
                Number(E.volume.value),
                0,
                100
            );

            updateVolume();
            saveSettings();
        });
    }

    /*
     * Battlefield aiming.
     */
    if (E.field) {
        E.field.addEventListener("pointerdown", fieldPointerDown);

        E.field.addEventListener("pointermove", event => {
            if (!G.dragging) return;

            if (
                G.pointerId !== null &&
                event.pointerId !== G.pointerId
            ) {
                return;
            }

            updateAim(pointInField(event));
        });

        E.field.addEventListener("pointerup", endAim);
        E.field.addEventListener("pointercancel", endAim);

        E.field.addEventListener("contextmenu", event => {
            event.preventDefault();
        });
    }

    /*
     * Keyboard controls.
     */
    document.addEventListener("keydown", event => {
        if (!G.running || G.paused || G.busy) return;

        const tag = document.activeElement?.tagName;

        if (tag === "INPUT" || tag === "SELECT" ||
            tag === "TEXTAREA") {
            return;
        }

        switch (event.key) {
            case "ArrowLeft":
                event.preventDefault();
                moveTank(-1);
                break;

            case "ArrowRight":
                event.preventDefault();
                moveTank(1);
                break;

            case " ":
            case "Enter":
                if (event.repeat) return;
                event.preventDefault();
                fireShot();
                break;

            case "ArrowUp":
                event.preventDefault();
                G.angle[G.active] = clamp(
                    G.angle[G.active] + 2,
                    RULES.minimumAngle,
                    RULES.maximumAngle
                );
                positionTanks();
                updateControls();
                drawAimGuide();
                break;

            case "ArrowDown":
                event.preventDefault();
                G.angle[G.active] = clamp(
                    G.angle[G.active] - 2,
                    RULES.minimumAngle,
                    RULES.maximumAngle
                );
                positionTanks();
                updateControls();
                drawAimGuide();
                break;
        }
    });

    /*
     * Handle screen rotation and browser resizing.
     */
    window.addEventListener("resize", () => {
        updateOrientation();

        if (E.battle?.classList.contains("active")) {
            resizeCanvases();
            positionTanks();
        }
    });

    window.addEventListener("orientationchange", () => {
        setTimeout(() => {
            updateOrientation();

            if (E.battle?.classList.contains("active")) {
                resizeCanvases();
                positionTanks();
            }
        }, 200);
    });

    /*
     * Save the current match when the page is hidden.
     */
    document.addEventListener("visibilitychange", () => {
        if (document.hidden && G.running) {
            saveGame();
        }
    });
}

/* ---------------- INITIALIZATION ---------------- */

function initializeGame() {
    injectStyles();
    loadSettings();
    bindEvents();
    updatePreviews();
    updateOrientation();

    /*
     * Set initial canvas dimensions after layout is ready.
     */
    requestAnimationFrame(() => {
        resizeCanvases();
        positionTanks();
    });

    if (G.settings.music) {
        startMusic();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeGame, {
        once: true
    });
} else {
    initializeGame();
}

/* End of Part 6 — GAME.JS */
