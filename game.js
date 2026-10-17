(() => {
    "use strict";

    /* =========================================
       TANK WAR — GAME CONFIGURATION
       ========================================= */

    const ASSETS = {
        menuBackground: "menu-bg.png",
        battleBackground: "battle-bg.jpg",

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

        movementSpeed: 115,
        projectileGravity: 430,

        blastRadius: 105,
        maximumDamage: 45,
        minimumDamage: 5
    };

    const SAVE_KEY = "tankWarSaveV2";
    const SETTINGS_KEY = "tankWarSettingsV2";

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
       DOM HELPERS
       ========================================= */

    const $ = id => document.getElementById(id);

    const elements = {
        rotateScreen: $("rotate-screen"),
        gameApp: $("game-app"),

        mainMenu: $("main-menu"),
        modeScreen: $("mode-screen"),
        setupScreen: $("setup-screen"),
        onlineScreen: $("online-screen"),
        vsScreen: $("vs-screen"),
        battleScreen: $("battle-screen"),
        resultScreen: $("result-screen"),
        settingsScreen: $("settings-screen"),

        battlefield: $("battlefield"),

        terrainCanvas: $("terrain-canvas"),
        aimCanvas: $("aim-canvas"),

        tank1: $("tank1"),
        tank2: $("tank2"),

        tank1Image: $("tank1-image"),
        tank2Image: $("tank2-image"),

        projectileLayer: $("projectile-layer"),
        effectLayer: $("effect-layer"),

        moveLeft: $("move-left-btn"),
        moveRight: $("move-right-btn"),

        movementTime: $("movement-time"),

        angleValue: $("angle-value"),
        shotPower: $("shot-power"),
        powerValue: $("power-value"),

        fireButton: $("fire-btn"),

        turnIndicator: $("turn-indicator"),
        roundNumber: $("round-number"),

        hudName1: $("hud-name1"),
        hudName2: $("hud-name2"),

        health1Text: $("hud-health1-text"),
        health2Text: $("hud-health2-text"),

        health1Fill: $("health1-fill"),
        health2Fill: $("health2-fill"),

        tank1Nameplate: $("tank1-nameplate"),
        tank2Nameplate: $("tank2-nameplate"),

        battleMenuOverlay: $("battle-menu-overlay"),

        resultTitle: $("result-title"),
        resultEyebrow: $("result-eyebrow"),
        resultTankImage: $("result-tank-image"),
        winnerName: $("winner-name"),
        resultDescription: $("result-description"),

        resultHealth1Name: $("result-health1-name"),
        resultHealth2Name: $("result-health2-name"),
        resultHealth1: $("result-health1"),
        resultHealth2: $("result-health2"),

        player1Name: $("player1-name"),
        player2Name: $("player2-name"),

        player1Tank: $("player1-tank"),
        player2Tank: $("player2-tank"),

        player1Preview: $("player1-preview"),
        player2Preview: $("player2-preview"),

        vsPlayer1Name: $("vs-player1-name"),
        vsPlayer2Name: $("vs-player2-name"),

        vsTank1Image: $("vs-tank1-image"),
        vsTank2Image: $("vs-tank2-image"),

        effectsToggle: $("effects-toggle"),
        musicToggle: $("music-toggle"),
        volumeSlider: $("volume-slider"),
        volumeValue: $("volume-value")
    };

    const terrainContext =
        elements.terrainCanvas.getContext("2d");

    const aimContext =
        elements.aimCanvas.getContext("2d");

    /* =========================================
       GAME STATE
       ========================================= */

    const game = {
        running: false,
        paused: false,
        busy: false,

        gameMode: "local",

        activePlayer: 0,
        round: 1,

        health: [100, 100],

        angle: [45, 45],
        power: 65,

        movementLeft: [3, 3],

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

        aimDragging: false,

        projectileFrame: null,
        movementTimer: null,

        matchToken: 0,

        settings: {
            effects: true,
            music: false,
            volume: 45
        },

        musicAudio: null,
        buttonAudio: null,

        audioUnlocked: false,

        terrainSeed: 0
    };

    /* =========================================
       AUDIO
       ========================================= */

    function loadSettings() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(SETTINGS_KEY) || "{}"
            );

            if (typeof saved.effects === "boolean") {
                game.settings.effects = saved.effects;
            }

            if (typeof saved.music === "boolean") {
                game.settings.music = saved.music;
            }

            if (Number.isFinite(saved.volume)) {
                game.settings.volume = Math.max(
                    0,
                    Math.min(100, saved.volume)
                );
            }
        } catch (error) {
            console.warn("Could not load settings.", error);
        }

        elements.effectsToggle.checked =
            game.settings.effects;

        elements.musicToggle.checked =
            game.settings.music;

        elements.volumeSlider.value =
            game.settings.volume;

        elements.volumeValue.textContent =
            `${game.settings.volume}%`;

        updateAudioVolume();
    }

    function saveSettings() {
        try {
            localStorage.setItem(
                SETTINGS_KEY,
                JSON.stringify(game.settings)
            );
        } catch (error) {
            console.warn("Could not save settings.", error);
        }
    }

    function unlockAudio() {
        game.audioUnlocked = true;

        if (game.settings.music) {
            startMusic();
        }
    }

    function playButtonSound() {
        if (!game.settings.effects) return;
        if (game.settings.volume <= 0) return;

        unlockAudio();

        try {
            if (!game.buttonAudio) {
                game.buttonAudio = new Audio(
                    ASSETS.buttonSound
                );

                game.buttonAudio.preload = "auto";
            }

            const sound = game.buttonAudio.cloneNode();

            sound.volume = game.settings.volume / 100;

            sound.play().catch(() => {
                // The browser may block playback.
            });
        } catch (error) {
            console.warn("Button sound unavailable.", error);
        }
    }

    function startMusic() {
        if (!game.settings.music) return;

        try {
            if (!game.musicAudio) {
                game.musicAudio = new Audio(
                    ASSETS.backgroundMusic
                );

                game.musicAudio.loop = true;
                game.musicAudio.preload = "auto";
            }

            game.musicAudio.volume =
                game.settings.volume / 100;

            if (game.musicAudio.paused) {
                game.musicAudio.play().catch(() => {
                    // Playback can start after another user gesture.
                });
            }
        } catch (error) {
            console.warn("Background music unavailable.", error);
        }
    }

    function stopMusic() {
        if (!game.musicAudio) return;

        game.musicAudio.pause();
        game.musicAudio.currentTime = 0;
    }

    function updateAudioVolume() {
        const volume = game.settings.volume / 100;

        if (game.musicAudio) {
            game.musicAudio.volume = volume;
        }
    }

    function toggleMusic(enabled) {
        game.settings.music = enabled;

        if (elements.musicToggle) {
            elements.musicToggle.checked = enabled;
        }

        if (enabled) {
            startMusic();
        } else {
            stopMusic();
        }

        saveSettings();
    }

    /* =========================================
       SCREEN NAVIGATION
       ========================================= */

    function showScreen(screenId) {
        document.querySelectorAll(".screen").forEach(screen => {
            screen.classList.remove("active");
        });

        const screen = $(screenId);

        if (screen) {
            screen.classList.add("active");
        }

        updateOrientation();

        if (screenId === "battle-screen") {
            requestAnimationFrame(() => {
                resizeCanvases();
                drawTerrain();
                drawAimGuide();
                positionTanks();
            });
        }
    }

    function updateOrientation() {
        const landscape =
            window.innerWidth > window.innerHeight;

        const battleActive =
            elements.battleScreen.classList.contains("active");

        const shouldShowRotate =
            !landscape && battleActive;

        elements.rotateScreen.classList.toggle(
            "active",
            shouldShowRotate
        );

        elements.rotateScreen.style.display =
            shouldShowRotate ? "flex" : "none";

        if (shouldShowRotate) {
            elements.gameApp.style.visibility = "hidden";
        } else {
            elements.gameApp.style.visibility = "visible";
        }
    }

    /* =========================================
       TANK AND PLAYER HELPERS
       ========================================= */

    function getTankElement(player) {
        return player === 0
            ? elements.tank1
            : elements.tank2;
    }

    function getTankImage(player) {
        return player === 0
            ? elements.tank1Image
            : elements.tank2Image;
    }

    function getCannonElement(player) {
        return player === 0
            ? elements.tank1Cannon
            : elements.tank2Cannon;
    }

    function getTankType(player) {
        return game.players[player].tank;
    }

    function getTankImageSource(player) {
        return TANKS[getTankType(player)].image;
    }

    function getOtherPlayer(player) {
        return player === 0 ? 1 : 0;
    }

    function clamp(value, minimum, maximum) {
        return Math.max(
            minimum,
            Math.min(maximum, value)
        );
    }

    function setPlayerDetails() {
        elements.hudName1.textContent =
            game.players[0].name;

        elements.hudName2.textContent =
            game.players[1].name;

        elements.tank1Nameplate.textContent =
            game.players[0].name;

        elements.tank2Nameplate.textContent =
            game.players[1].name;

        elements.vsPlayer1Name.textContent =
            game.players[0].name;

        elements.vsPlayer2Name.textContent =
            game.players[1].name;

        elements.vsTank1Image.src =
            getTankImageSource(0);

        elements.vsTank2Image.src =
            getTankImageSource(1);

        elements.tank1Image.src =
            getTankImageSource(0);

        elements.tank2Image.src =
            getTankImageSource(1);

        elements.tank1Image.style.transform =
            game.players[0].tank === "red"
                ? "scaleX(-1)"
                : "scaleX(1)";

        elements.tank2Image.style.transform =
            game.players[1].tank === "blue"
                ? "scaleX(-1)"
                : "scaleX(1)";
    }

    /* =========================================
       TERRAIN GENERATION
       ========================================= */

    function terrainYAt(x) {
        if (game.terrain.length < 2) {
            return elements.battlefield.clientHeight * 0.72;
        }

        const width = elements.battlefield.clientWidth;

        const normalizedX = clamp(
            x / Math.max(width, 1),
            0,
            1
        );

        const position =
            normalizedX * (game.terrain.length - 1);

        const index = Math.floor(position);

        const nextIndex = Math.min(
            index + 1,
            game.terrain.length - 1
        );

        const fraction = position - index;

        return game.terrain[index] * (1 - fraction) +
            game.terrain[nextIndex] * fraction;
    }

    function generateTerrain() {
        const width = elements.battlefield.clientWidth;
        const height = elements.battlefield.clientHeight;

        const count = Math.max(
            50,
            Math.floor(width / 8)
        );

        game.terrain = [];

        let currentY = height * 0.69;

        for (let i = 0; i < count; i++) {
            const progress = i / (count - 1);

            const wave =
                Math.sin(progress * Math.PI * 2.4) *
                height * 0.055;

            const wave2 =
                Math.sin(progress * Math.PI * 5.2 + 1.4) *
                height * 0.025;

            const variation =
                (Math.random() - 0.5) *
                height * 0.018;

            currentY =
                height * 0.68 +
                wave +
                wave2 +
                variation;

            currentY = clamp(
                currentY,
                height * 0.48,
                height * 0.84
            );

            game.terrain.push(currentY);
        }

        game.terrainSeed++;
    }

    function drawTerrain() {
        const canvas = elements.terrainCanvas;
        const width = canvas.width;
        const height = canvas.height;

        terrainContext.clearRect(
            0,
            0,
            width,
            height
        );

        if (game.terrain.length < 2) return;

        terrainContext.beginPath();
        terrainContext.moveTo(0, height);

        terrainContext.lineTo(0, game.terrain[0]);

        for (let i = 0; i < game.terrain.length; i++) {
            const x =
                (i / (game.terrain.length - 1)) * width;

            terrainContext.lineTo(
                x,
                game.terrain[i]
            );
        }

        terrainContext.lineTo(width, height);
        terrainContext.closePath();

        const groundGradient =
            terrainContext.createLinearGradient(
                0,
                height * 0.5,
                0,
                height
            );

        groundGradient.addColorStop(0, "#a97843");
        groundGradient.addColorStop(1, "#513b2d");

        terrainContext.fillStyle = groundGradient;
        terrainContext.fill();

        terrainContext.beginPath();

        for (let i = 0; i < game.terrain.length; i++) {
            const x =
                (i / (game.terrain.length - 1)) * width;

            const y = game.terrain[i];

            if (i === 0) {
                terrainContext.moveTo(x, y);
            } else {
                terrainContext.lineTo(x, y);
            }
        }

        terrainContext.strokeStyle = "#e3b96f";
        terrainContext.lineWidth = 3;
        terrainContext.stroke();
    }

    function resizeCanvases() {
        const rect =
            elements.battlefield.getBoundingClientRect();

        if (!rect.width || !rect.height) return;

        const dpr = Math.min(
            window.devicePixelRatio || 1,
            2
        );

        [
            elements.terrainCanvas,
            elements.aimCanvas
        ].forEach(canvas => {
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);

            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;

            const context = canvas.getContext("2d");

            context.setTransform(
                dpr,
                0,
                0,
                dpr,
                0,
                0
            );
        });

        if (game.running && game.terrain.length === 0) {
            generateTerrain();
        }

        drawTerrain();
        positionTanks();
        drawAimGuide();
    }

    /* =========================================
       TANK POSITIONING
       ========================================= */
function positionTanks() {
    if (!elements.battlefield.clientWidth) return;

    for (let player = 0; player < 2; player++) {
        const tank = getTankElement(player);

        const y = terrainYAt(game.x[player]);

        tank.style.left = `${game.x[player]}px`;
        tank.style.top = `${y - 25}px`;
    }
}
    
    

    /* =========================================
       HEALTH AND TURN DISPLAY
       ========================================= */

    function updateHealthDisplay() {
        const health1 = clamp(game.health[0], 0, 100);
        const health2 = clamp(game.health[1], 0, 100);

        elements.health1Text.textContent =
            `${health1} HP`;

        elements.health2Text.textContent =
            `${health2} HP`;

        elements.health1Fill.style.width =
            `${health1}%`;

        elements.health2Fill.style.width =
            `${health2}%`;
    }

    function updateMovementDisplay() {
        const remaining =
            game.movementLeft[game.activePlayer];

        elements.movementTime.textContent =
            `${remaining}/3`;

        const canMove =
            game.running &&
            !game.paused &&
            !game.busy &&
            remaining > 0;

        elements.moveLeft.disabled = !canMove;
        elements.moveRight.disabled = !canMove;
    }

    function updateControls() {
        elements.angleValue.textContent =
            `${Math.round(game.angle[game.activePlayer])}°`;

        elements.shotPower.value = game.power;

        elements.powerValue.textContent =
            `${Math.round(game.power)}%`;

        elements.fireButton.disabled =
            !game.running ||
            game.paused ||
            game.busy;

        updateMovementDisplay();
    }

    function updateTurnDisplay() {
        elements.turnIndicator.textContent =
            `${game.players[game.activePlayer].name.toUpperCase()}'S TURN`;

        elements.roundNumber.textContent =
            game.round;

        updateControls();
        drawAimGuide();
        positionTanks();
    }

    /* =========================================
       AIMING
       ========================================= */

    function updateAimFromPointer(event) {
        if (!game.aimDragging) return;
        if (!game.running || game.paused || game.busy) return;

        const player = game.activePlayer;

        const rect =
            elements.battlefield.getBoundingClientRect();

        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;

        const tankX = game.x[player];
        const tankY = terrainYAt(tankX) - 25;

        const dx = player === 0
            ? pointerX - tankX
            : tankX - pointerX;

        const dy = tankY - pointerY;

        if (dx <= 0) return;

        let angle =
            Math.atan2(dy, dx) * 180 / Math.PI;

        angle = clamp(
            angle,
            RULES.minimumAngle,
            RULES.maximumAngle
        );

        game.angle[player] = angle;

        elements.angleValue.textContent =
            `${Math.round(angle)}°`;

        positionTanks();
        drawAimGuide();
    }

    function drawAimGuide() {
        if (!aimContext) return;

        const canvas = elements.aimCanvas;

        const width = elements.battlefield.clientWidth;
        const height = elements.battlefield.clientHeight;

        aimContext.clearRect(0, 0, width, height);

        if (!game.running || game.paused || game.busy) {
            return;
        }

        const player = game.activePlayer;

        const x = game.x[player];
        const y = terrainYAt(x) - 25;

        const direction = player === 0 ? 1 : -1;
        const angle = game.angle[player] * Math.PI / 180;

        const power = game.power;

        const startX =
            x + direction * 17 * Math.cos(angle);

        const startY =
            y - 17 * Math.sin(angle);

        const velocity = power * 3.1;

        aimContext.beginPath();

        for (let t = 0; t <= 0.65; t += 0.035) {
            const px =
                startX +
                direction * velocity * Math.cos(angle) * t;

            const py =
                startY -
                velocity * Math.sin(angle) * t +
                0.5 * RULES.projectileGravity * t * t;

            if (t === 0) {
                aimContext.moveTo(px, py);
            } else {
                aimContext.lineTo(px, py);
            }
        }

        aimContext.setLineDash([4, 6]);
        aimContext.strokeStyle = "rgba(255, 239, 173, 0.75)";
        aimContext.lineWidth = 2;
        aimContext.stroke();
        aimContext.setLineDash([]);
    }

    function beginAimDrag(event, player) {
        if (!game.running || game.paused || game.busy) return;
        if (player !== game.activePlayer) return;

        game.aimDragging = true;

        event.preventDefault();

        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch (error) {
            // Pointer capture is not available in every browser.
        }

        updateAimFromPointer(event);
    }

    function endAimDrag() {
        game.aimDragging = false;
    }

    /* =========================================
       MOVEMENT — THREE STEPS PER TURN
       ========================================= */

    function moveTank(direction) {
        if (!game.running || game.paused || game.busy) return;

        const player = game.activePlayer;

        if (game.movementLeft[player] <= 0) return;

        const width = elements.battlefield.clientWidth;

        const oldX = game.x[player];

        const newX = clamp(
            oldX + direction * RULES.movementDistance,
            35,
            width - 35
        );

        if (player === 0 && newX >= game.x[1] - 35) {
            return;
        }

        if (player === 1 && newX <= game.x[0] + 35) {
            return;
        }

        if (Math.abs(newX - oldX) < 1) return;

        game.x[player] = newX;

        game.movementLeft[player]--;

        positionTanks();
        updateMovementDisplay();
        drawAimGuide();
    }

    /* =========================================
       PROJECTILE AND COLLISION
       ========================================= */

    function createProjectile(x, y) {
        const projectile = document.createElement("div");

        projectile.className = "projectile";

        projectile.style.left = `${x}px`;
        projectile.style.top = `${y}px`;

        elements.projectileLayer.appendChild(projectile);

        return projectile;
    }

    function createExplosion(x, y) {
        const explosion = document.createElement("div");

        explosion.className = "explosion-effect";

        explosion.style.left = `${x}px`;
        explosion.style.top = `${y}px`;

        elements.effectLayer.appendChild(explosion);

        setTimeout(() => explosion.remove(), 500);
    }

    function showDamageNumber(x, y, damage) {
        const number = document.createElement("div");

        number.className = "damage-number";
        number.textContent = `-${damage}`;

        number.style.left = `${x}px`;
        number.style.top = `${y}px`;

        elements.effectLayer.appendChild(number);

        setTimeout(() => number.remove(), 950);
    }

    function calculateDamage(distance) {
        const ratio = clamp(
            1 - distance / RULES.blastRadius,
            0,
            1
        );

        return Math.round(
            RULES.minimumDamage +
            ratio *
            (RULES.maximumDamage - RULES.minimumDamage)
        );
    }

    function fireShot() {
        if (!game.running || game.paused || game.busy) return;

        game.busy = true;
        game.aimDragging = false;

        updateControls();
        drawAimGuide();

        const player = game.activePlayer;

        const direction = player === 0 ? 1 : -1;

        const angle =
            game.angle[player] * Math.PI / 180;

        const power = game.power;

        const tankX = game.x[player];
        const tankY = terrainYAt(tankX) - 25;

        const startX =
            tankX + direction * 18 * Math.cos(angle);

        const startY =
            tankY - 18 * Math.sin(angle);

        const velocity = power * 3.1;

        const vx =
            direction * velocity * Math.cos(angle);

        let vy =
            -velocity * Math.sin(angle);

        const projectile = createProjectile(startX, startY);

        let x = startX;
        let y = startY;

        let previousTime = performance.now();

        const token = game.matchToken;

        function animateProjectile(now) {
            if (token !== game.matchToken) {
                projectile.remove();
                return;
            }

            if (!game.running) {
                projectile.remove();
                return;
            }

            const elapsed = Math.min(
                (now - previousTime) / 1000,
                0.035
            );

            previousTime = now;

            const steps = Math.max(
                1,
                Math.ceil(elapsed / 0.008)
            );

            const stepTime = elapsed / steps;

            let impact = false;

            for (let i = 0; i < steps; i++) {
                x += vx * stepTime;

                y += vy * stepTime;

                vy += RULES.projectileGravity * stepTime;

                if (
                    x < 0 ||
                    x > elements.battlefield.clientWidth ||
                    y > elements.battlefield.clientHeight + 20 ||
                    y < -100
                ) {
                    impact = true;
                    break;
                }

                const groundY = terrainYAt(x);

                if (y >= groundY) {
                    y = groundY;
                    impact = true;
                    break;
                }

                const target = getOtherPlayer(player);

                const targetX = game.x[target];
                const targetY = terrainYAt(targetX) - 25;

                const distance = Math.hypot(
                    x - targetX,
                    y - targetY
                );

                if (distance < 30) {
                    impact = true;
                    break;
                }
            }

            projectile.style.left = `${x}px`;
            projectile.style.top = `${y}px`;

            if (impact) {
                projectile.remove();

                resolveImpact(x, y, player, token);
                return;
            }

            game.projectileFrame =
                requestAnimationFrame(animateProjectile);
        }

        game.projectileFrame =
            requestAnimationFrame(animateProjectile);
    }

    function resolveImpact(x, y, shooter, token) {
        if (token !== game.matchToken) return;

        createExplosion(x, y);

        const target = getOtherPlayer(shooter);

        const targetX = game.x[target];
        const targetY = terrainYAt(targetX) - 25;

        const distance = Math.hypot(
            x - targetX,
            y - targetY
        );

        if (distance <= RULES.blastRadius) {
            const damage = calculateDamage(distance);

            game.health[target] = Math.max(
                0,
                game.health[target] - damage
            );

            showDamageNumber(
                targetX,
                targetY - 20,
                damage
            );

            updateHealthDisplay();
        }

        setTimeout(() => {
            if (token !== game.matchToken) return;

            if (game.health[target] <= 0) {
                finishMatch(shooter);
                return;
            }

            endTurn();
        }, 500);
    }

    /* =========================================
       TURN MANAGEMENT
       ========================================= */

    function endTurn() {
        if (!game.running) return;

        game.activePlayer = getOtherPlayer(
            game.activePlayer
        );

        if (game.activePlayer === 0) {
            game.round++;
        }

        game.movementLeft[game.activePlayer] =
            RULES.movementStepsPerTurn;

        game.busy = false;

        updateTurnDisplay();
        updateHealthDisplay();
        positionTanks();
    }

    /* =========================================
       MATCH SETUP
       ========================================= */

    function startMatch() {
        game.matchToken++;

        game.running = true;
        game.paused = false;
        game.busy = false;

        game.activePlayer = 0;
        game.round = 1;

        game.health = [100, 100];

        game.angle = [45, 45];
        game.power = 65;

        game.movementLeft = [3, 3];

        game.x = [
            0,
            elements.battlefield.clientWidth
        ];

        elements.battleMenuOverlay.classList.add("hidden");

        elements.projectileLayer.replaceChildren();
        elements.effectLayer.replaceChildren();

        elements.tank1.classList.remove(
            "tank-destroyed-animation"
        );

        elements.tank2.classList.remove(
            "tank-destroyed-animation"
        );

        elements.resultScreen.classList.remove(
            "winner-blue",
            "winner-red"
        );

        elements.shotPower.value = 65;

        showScreen("battle-screen");

        requestAnimationFrame(() => {
            resizeCanvases();

            generateTerrain();

            const width =
                elements.battlefield.clientWidth;

            game.x = [
                Math.max(45, width * 0.12),
                Math.min(width - 45, width * 0.88)
            ];

            setPlayerDetails();

            positionTanks();
            drawTerrain();

            updateHealthDisplay();
            updateTurnDisplay();
        });
    }

    function prepareMatch() {
        const name1 =
            elements.player1Name.value.trim() || "Player 1";

        const name2 =
            elements.player2Name.value.trim() || "Player 2";

        game.players[0] = {
            name: name1,
            tank: elements.player1Tank.value
        };

        game.players[1] = {
            name: name2,
            tank: elements.player2Tank.value
        };

        setPlayerDetails();

        elements.vsPlayer1Name.textContent = name1;
        elements.vsPlayer2Name.textContent = name2;

        elements.vsTank1Image.src =
            getTankImageSource(0);

        elements.vsTank2Image.src =
            getTankImageSource(1);

        showScreen("vs-screen");
    }

    /* =========================================
       VICTORY AND DEFEAT
       ========================================= */

    function finishMatch(winner) {
        if (!game.running) return;

        game.running = false;
        game.busy = true;
        game.aimDragging = false;

        const loser = getOtherPlayer(winner);

        const token = game.matchToken;

        const losingTank = getTankElement(loser);

        losingTank.classList.add(
            "tank-destroyed-animation"
        );

        elements.resultEyebrow.textContent =
            "BATTLE COMPLETE";

        elements.resultTitle.textContent =
            "VICTORY";

        elements.winnerName.textContent =
            `${game.players[winner].name} WINS!`;

        elements.resultDescription.textContent =
            `${game.players[loser].name}'s tank has been defeated.`;

        elements.resultTankImage.src =
            getTankImageSource(winner);

        elements.resultHealth1Name.textContent =
            game.players[0].name;

        elements.resultHealth2Name.textContent =
            game.players[1].name;

        elements.resultHealth1.textContent =
            `${game.health[0]} HP`;

        elements.resultHealth2.textContent =
            `${game.health[1]} HP`;

        elements.resultScreen.classList.toggle(
            "winner-blue",
            winner === 0
        );

        elements.resultScreen.classList.toggle(
            "winner-red",
            winner === 1
        );

        clearSavedMatch();

        setTimeout(() => {
            if (token !== game.matchToken) return;

            showScreen("result-screen");
        }, 850);
    }

    /* =========================================
       PAUSE AND RESUME
       ========================================= */

    function openPauseMenu() {
        if (!game.running || game.busy) return;

        game.paused = true;
        game.aimDragging = false;

        elements.battleMenuOverlay.classList.remove("hidden");

        updateControls();
        drawAimGuide();
    }

    function closePauseMenu() {
        game.paused = false;

        elements.battleMenuOverlay.classList.add("hidden");

        updateControls();
        drawAimGuide();
    }

    /* =========================================
       SAVE AND RESUME
       ========================================= */

    function saveMatch() {
        if (!game.running) return;

        const width = Math.max(
            elements.battlefield.clientWidth,
            1
        );

        const saveData = {
            version: 2,

            gameMode: game.gameMode,

            activePlayer: game.activePlayer,
            round: game.round,

            health: game.health,

            angle: game.angle,
            power: game.power,

            movementLeft: game.movementLeft,

            xNormalized: [
                game.x[0] / width,
                game.x[1] / width
            ],

            players: game.players,

            terrain: game.terrain
        };

        try {
            localStorage.setItem(
                SAVE_KEY,
                JSON.stringify(saveData)
            );

            alert("Match saved on this device.");
        } catch (error) {
            alert("Unable to save this match.");
            console.warn(error);
        }
    }

    function clearSavedMatch() {
        try {
            localStorage.removeItem(SAVE_KEY);
        } catch (error) {
            console.warn(error);
        }
    }

    function resumeMatch() {
        let saved;

        try {
            saved = JSON.parse(
                localStorage.getItem(SAVE_KEY)
            );
        } catch (error) {
            saved = null;
        }

        if (!saved || !Array.isArray(saved.players)) {
            alert("No saved match was found.");
            return;
        }

        game.matchToken++;

        game.running = true;
        game.paused = false;
        game.busy = false;

        game.gameMode = saved.gameMode || "local";

        game.activePlayer =
            saved.activePlayer === 1 ? 1 : 0;

        game.round = Math.max(1, saved.round || 1);

        game.health = Array.isArray(saved.health)
            ? saved.health.map(value => clamp(value, 0, 100))
            : [100, 100];

        game.angle = Array.isArray(saved.angle)
            ? saved.angle.map(value => clamp(
                value,
                RULES.minimumAngle,
                RULES.maximumAngle
            ))
            : [45, 45];

        game.power = clamp(
            saved.power || 65,
            RULES.minimumPower,
            RULES.maximumPower
        );

        game.players = saved.players;

        /*
         * Old saves used seconds rather than steps.
         * Give both players three steps when loading
         * a save without the new movement system.
         */

        if (
            saved.version === 2 &&
            Array.isArray(saved.movementLeft)
        ) {
            game.movementLeft =
                saved.movementLeft.map(value =>
                    clamp(Math.floor(value), 0, 3)
                );
        } else {
            game.movementLeft = [3, 3];
        }

        showScreen("battle-screen");

        requestAnimationFrame(() => {
            resizeCanvases();

            if (
                Array.isArray(saved.terrain) &&
                saved.terrain.length > 1
            ) {
                game.terrain = saved.terrain;
            } else {
                generateTerrain();
            }

            const width =
                elements.battlefield.clientWidth;

            if (Array.isArray(saved.xNormalized)) {
                game.x = [
                    clamp(saved.xNormalized[0] * width, 35, width - 35),
                    clamp(saved.xNormalized[1] * width, 35, width - 35)
                ];
            } else {
                game.x = [width * 0.12, width * 0.88];
            }

            elements.battleMenuOverlay.classList.add("hidden");

            elements.projectileLayer.replaceChildren();
            elements.effectLayer.replaceChildren();

            setPlayerDetails();
            drawTerrain();
            positionTanks();
            updateHealthDisplay();
            updateTurnDisplay();
        });
    }

    /* =========================================
       TANK PREVIEW
       ========================================= */

    function updateTankPreviews() {
        elements.player1Preview.src =
            elements.player1Tank.value === "red"
                ? ASSETS.redTank
                : ASSETS.blueTank;

        elements.player2Preview.src =
            elements.player2Tank.value === "blue"
                ? ASSETS.blueTank
                : ASSETS.redTank;
    }

    /* =========================================
       EVENT LISTENERS
       ========================================= */

    function bindEvents() {
        /*
         * Play a button click sound for normal button clicks.
         */

        document.addEventListener("click", event => {
            if (event.target.closest("button")) {
                playButtonSound();
            }
        });

        /*
         * First user interaction can unlock background music.
         */

        document.addEventListener(
            "pointerdown",
            () => {
                unlockAudio();
            },
            { once: true }
        );

        $("play-btn").addEventListener("click", () => {
            showScreen("mode-screen");
        });

        $("local-mode-btn").addEventListener("click", () => {
            game.gameMode = "local";
            showScreen("setup-screen");
        });

        $("computer-mode-btn").addEventListener("click", () => {
            alert("Computer opponent AI is not implemented yet.");
        });

        $("online-btn").addEventListener("click", () => {
            showScreen("online-screen");
        });

        $("settings-btn").addEventListener("click", () => {
            showScreen("settings-screen");
        });

        document.querySelectorAll("[data-back]").forEach(button => {
            button.addEventListener("click", () => {
                showScreen(button.dataset.back);
            });
        });

        elements.player1Tank.addEventListener(
            "change",
            updateTankPreviews
        );

        elements.player2Tank.addEventListener(
            "change",
            updateTankPreviews
        );

        $("start-match-btn").addEventListener(
            "click",
            prepareMatch
        );

        $("begin-battle-btn").addEventListener(
            "click",
            startMatch
        );

        elements.moveLeft.addEventListener(
            "pointerdown",
            event => {
                event.preventDefault();
                moveTank(-1);
            }
        );

        elements.moveRight.addEventListener(
            "pointerdown",
            event => {
                event.preventDefault();
                moveTank(1);
            }
        );

    elements.tank1Image.addEventListener(
    "pointerdown",
    event => beginAimDrag(event, 0)
);

elements.tank2Image.addEventListener(
    "pointerdown",
    event => beginAimDrag(event, 1)
);

        window.addEventListener(
            "pointermove",
            updateAimFromPointer
        );

        window.addEventListener(
            "pointerup",
            endAimDrag
        );

        window.addEventListener(
            "pointercancel",
            endAimDrag
        );

        elements.shotPower.addEventListener("input", () => {
            game.power = clamp(
                Number(elements.shotPower.value),
                RULES.minimumPower,
                RULES.maximumPower
            );

            elements.powerValue.textContent =
                `${game.power}%`;

            drawAimGuide();
        });

        elements.fireButton.addEventListener(
            "click",
            fireShot
        );

        $("battle-menu-btn").addEventListener(
            "click",
            openPauseMenu
        );

        $("continue-btn").addEventListener(
            "click",
            closePauseMenu
        );

        $("save-match-btn").addEventListener(
            "click",
            saveMatch
        );

        $("restart-match-btn").addEventListener(
            "click",
            startMatch
        );

        $("return-menu-btn").addEventListener("click", () => {
            game.matchToken++;
            game.running = false;
            game.paused = false;
            game.busy = false;

            elements.battleMenuOverlay.classList.add("hidden");

            showScreen("main-menu");
        });

        $("rematch-btn").addEventListener(
            "click",
            startMatch
        );

        $("result-menu-btn").addEventListener("click", () => {
            game.matchToken++;
            game.running = false;
            game.busy = false;

            showScreen("main-menu");
        });

        elements.effectsToggle.addEventListener("change", () => {
            game.settings.effects =
                elements.effectsToggle.checked;

            saveSettings();
        });

        elements.musicToggle.addEventListener("change", () => {
            toggleMusic(elements.musicToggle.checked);
        });

        elements.volumeSlider.addEventListener("input", () => {
            game.settings.volume = Number(
                elements.volumeSlider.value
            );

            elements.volumeValue.textContent =
                `${game.settings.volume}%`;

            updateAudioVolume();
            saveSettings();
        });

        $("reset-settings-btn").addEventListener("click", () => {
            game.settings = {
                effects: true,
                music: false,
                volume: 45
            };

            elements.effectsToggle.checked = true;
            elements.musicToggle.checked = false;

            elements.volumeSlider.value = 45;
            elements.volumeValue.textContent = "45%";

            stopMusic();
            updateAudioVolume();
            saveSettings();
        });

        window.addEventListener("resize", () => {
            updateOrientation();

            if (elements.battleScreen.classList.contains("active")) {
                resizeCanvases();
                positionTanks();
                drawTerrain();
                drawAimGuide();
            }
        });

        window.addEventListener("orientationchange", () => {
            setTimeout(() => {
                updateOrientation();

                if (elements.battleScreen.classList.contains("active")) {
                    resizeCanvases();
                    drawTerrain();
                    positionTanks();
                }
            }, 150);
        });

        /*
         * Optional: resume a locally saved match.
         * This does not automatically start a match.
         */

        window.addEventListener("keydown", event => {
            if (event.key === "Escape" && game.running && !game.busy) {
                if (game.paused) {
                    closePauseMenu();
                } else {
                    openPauseMenu();
                }
            }
        });
    }

    /* =========================================
       INITIALIZATION
       ========================================= */

    function init() {
        loadSettings();
        bindEvents();
        updateTankPreviews();
        updateOrientation();

        /*
         * Ensure the music toggle reflects the saved setting.
         * Playback waits for a user interaction when necessary.
         */

        if (game.settings.music) {
            startMusic();
        }

        showScreen("main-menu");

        console.log("Tank War initialized.");
    }

    init();

})();
