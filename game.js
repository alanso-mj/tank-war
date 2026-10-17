(() => {
    "use strict";

    /* =========================================
       TANK WAR — CORRECTED GAME ENGINE
       Designed for your existing HTML and CSS
       ========================================= */

    const $ = id => document.getElementById(id);

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

    const SAVE_KEY = "tankWarLocalSaveV3";
    const SETTINGS_KEY = "tankWarSettingsV3";

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

        tank: [$("tank1"), $("tank2")],
        image: [$("tank1-image"), $("tank2-image")],

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

        hudName: [$("hud-name1"), $("hud-name2")],
        hpText: [$("hud-health1-text"), $("hud-health2-text")],
        hpFill: [$("health1-fill"), $("health2-fill")],

        nameplate: [$("tank1-nameplate"), $("tank2-nameplate")],

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

    const terrainCtx = E.terrainCanvas.getContext("2d");
    const aimCtx = E.aimCanvas.getContext("2d");

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
            { name: "Player 1", tank: "blue" },
            { name: "Player 2", tank: "red" }
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
       BASIC HELPERS
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
    }

    function currentPlayerName(player) {
        return G.players[player].name ||
            `Player ${player + 1}`;
    }

    function isBattleActive() {
        return Boolean(
            E.battle &&
            E.battle.classList.contains("active")
        );
    }

    function canControl() {
        return (
            G.running &&
            !G.paused &&
            !G.busy &&
            G.health[G.active] > 0
        );
    }

    function fieldSize() {
        return {
            width: E.field.clientWidth,
            height: E.field.clientHeight
        };
    }

    function pointInField(event) {
        const rect = E.field.getBoundingClientRect();

        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    /* End of Part 1/6 */
     /* =========================================
       PART 2 — SCREENS, NAVIGATION & SETTINGS
       ========================================= */

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
            if (screen) {
                screen.classList.remove("active");
            }
        });

        const nextScreen =
            typeof target === "string"
                ? $(target)
                : target;

        if (nextScreen) {
            nextScreen.classList.add("active");
        }

        if (E.rotate) {
            E.rotate.classList.remove("active");
        }

        requestAnimationFrame(() => {
            if (isBattleActive()) {
                resizeCanvases();
                drawTerrain();
                positionTanks();
                drawAim();
            }
        });
    }

    function showMainMenu() {
        G.paused = false;
        G.dragging = false;

        if (E.pause) {
            E.pause.classList.add("hidden");
        }

        showScreen(E.menu);
    }

    function playButtonSound() {
        if (!G.settings.effects) return;

        try {
            if (!G.buttonAudio) {
                G.buttonAudio = new Audio(ASSETS.buttonSound);
            }

            G.buttonAudio.currentTime = 0;

            const result = G.buttonAudio.play();

            if (result && result.catch) {
                result.catch(() => {});
            }
        } catch (error) {
            // Missing sound files should not stop the game.
        }
    }

    function loadSettings() {
        try {
            const saved = localStorage.getItem(SETTINGS_KEY);

            if (saved) {
                const parsed = JSON.parse(saved);

                G.settings = {
                    ...G.settings,
                    ...parsed
                };
            }
        } catch (error) {
            console.warn("Could not load settings.");
        }

        applySettings();
    }

    function saveSettings() {
        try {
            localStorage.setItem(
                SETTINGS_KEY,
                JSON.stringify(G.settings)
            );
        } catch (error) {
            console.warn("Could not save settings.");
        }
    }

    function applySettings() {
        if (E.effects) {
            E.effects.checked = G.settings.effects;
        }

        if (E.music) {
            E.music.checked = G.settings.music;
        }

        if (E.volume) {
            E.volume.value = G.settings.volume;
        }

        if (E.volumeText) {
            E.volumeText.textContent =
                `${G.settings.volume}%`;
        }

        if (G.musicAudio) {
            G.musicAudio.volume =
                G.settings.volume / 100;

            if (G.settings.music) {
                G.musicAudio.play().catch(() => {});
            } else {
                G.musicAudio.pause();
            }
        }
    }

    function updateVolume() {
        if (!E.volume) return;

        G.settings.volume = clamp(
            Number(E.volume.value) || 0,
            0,
            100
        );

        applySettings();
        saveSettings();
    }

    function openSettings() {
        showScreen(E.settings);
    }

    function resetSettings() {
        G.settings = {
            effects: true,
            music: false,
            volume: 45
        };

        applySettings();
        saveSettings();
    }

    /* =========================================
       NAVIGATION BUTTONS
       ========================================= */

    function bindNavigation() {
        const bind = (id, callback) => {
            const element = $(id);

            if (!element) {
                console.warn(`Missing HTML element: ${id}`);
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

        bind("settings-btn", openSettings);

        bind("local-mode-btn", () => {
            G.gameMode = "local";
            showScreen(E.setup);
        });

        bind("computer-mode-btn", () => {
            G.gameMode = "computer";
            showScreen(E.setup);
        });

        bind("battle-menu-btn", () => {
            if (!G.running || G.busy) return;

            G.paused = true;
            G.dragging = false;

            if (E.pause) {
                E.pause.classList.remove("hidden");
            }
        });

        bind("continue-btn", () => {
            G.paused = false;

            if (E.pause) {
                E.pause.classList.add("hidden");
            }

            drawAim();
        });

        bind("save-match-btn", saveMatch);

        bind("restart-match-btn", () => {
            if (E.pause) {
                E.pause.classList.add("hidden");
            }

            G.paused = false;
            prepareMatch();
        });

        bind("return-menu-btn", showMainMenu);

        bind("result-menu-btn", showMainMenu);

        bind("rematch-btn", () => {
            prepareMatch();
        });

        bind("reset-settings-btn", resetSettings);

        document.querySelectorAll("[data-back]").forEach(button => {
            button.addEventListener("click", event => {
                event.preventDefault();

                playButtonSound();

                const target = button.dataset.back;

                if (target) {
                    showScreen(target);
                }
            });
        });

        if (E.effects) {
            E.effects.addEventListener("change", () => {
                G.settings.effects = E.effects.checked;
                saveSettings();
            });
        }

        if (E.music) {
            E.music.addEventListener("change", () => {
                G.settings.music = E.music.checked;
                applySettings();
                saveSettings();
            });
        }

        if (E.volume) {
            E.volume.addEventListener("input", updateVolume);
        }
    }

    /* End of Part 2/6 */
     /* =========================================
       PART 3 — PLAYER SETUP AND TERRAIN
       ========================================= */

    function getSelectedTank(player) {
        if (E.playerTank[player]) {
            const value = E.playerTank[player].value;

            if (value === "red" || value === "blue") {
                return value;
            }
        }

        const selected = document.querySelector(
            `[name="player${player + 1}-tank"]:checked`
        );

        if (selected) {
            const value = selected.value.toLowerCase();

            if (value.includes("red")) return "red";
            if (value.includes("blue")) return "blue";
        }

        return player === 0 ? "blue" : "red";
    }

    function getPlayerName(player) {
        if (E.playerName[player]) {
            const value = E.playerName[player].value.trim();

            if (value) return value;
        }

        return `Player ${player + 1}`;
    }

    function prepareMatch() {
        G.matchToken++;
        G.running = false;
        G.paused = false;
        G.busy = false;
        G.dragging = false;
        G.active = 0;
        G.round = 1;

        G.health = [
            RULES.startingHealth,
            RULES.startingHealth
        ];

        G.steps = [
            RULES.movementStepsPerTurn,
            RULES.movementStepsPerTurn
        ];

        G.angle = [45, 45];
        G.power = 65;

        G.players = [
            {
                name: getPlayerName(0),
                tank: getSelectedTank(0)
            },
            {
                name: getPlayerName(1),
                tank: getSelectedTank(1)
            }
        ];

        updatePlayerPreviews();
        updateVSIntro();
        updateHUD();

        if (E.pause) {
            E.pause.classList.add("hidden");
        }

        showScreen(E.vs);
    }

    function updatePlayerPreviews() {
        for (let player = 0; player < 2; player++) {
            const tank = tankImage(player);

            if (E.preview[player]) {
                E.preview[player].src = tank;
            }

            if (E.image[player]) {
                E.image[player].src = tank;
            }

            if (E.hudName[player]) {
                E.hudName[player].textContent =
                    currentPlayerName(player);
            }
        }
    }

    function updateVSIntro() {
        for (let player = 0; player < 2; player++) {
            if (E.vsName[player]) {
                E.vsName[player].textContent =
                    currentPlayerName(player);
            }

            if (E.vsImage[player]) {
                E.vsImage[player].src = tankImage(player);
            }
        }
    }

    /* =========================================
       CANVAS SETUP
       ========================================= */

    function resizeCanvases() {
        if (!E.field) return;

        const { width, height } = fieldSize();

        if (width <= 0 || height <= 0) return;

        const dpr = Math.min(
            window.devicePixelRatio || 1,
            2
        );

        [
            E.terrainCanvas,
            E.aimCanvas
        ].forEach(canvas => {
            if (!canvas) return;

            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);

            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
        });

        terrainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        aimCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* =========================================
       TERRAIN GENERATION
       ========================================= */

    function generateTerrain() {
        const { width, height } = fieldSize();

        if (width <= 0 || height <= 0) return;

        G.terrain = [];

        const step = 4;

        for (let x = 0; x <= width; x += step) {
            const normalizedX = x / width;

            let ground =
                height * 0.73 +
                Math.sin(normalizedX * Math.PI * 2) *
                    height * 0.055 +
                Math.sin(normalizedX * Math.PI * 5) *
                    height * 0.025 +
                (Math.random() - 0.5) *
                    height * 0.018;

            ground = clamp(
                ground,
                height * 0.48,
                height * 0.84
            );

            G.terrain.push({
                x,
                y: ground
            });
        }

        const leftIndex = Math.floor(
            G.terrain.length * 0.13
        );

        const rightIndex = Math.floor(
            G.terrain.length * 0.87
        );

        if (G.terrain[leftIndex]) {
            G.terrain[leftIndex].y =
                height * 0.68;
        }

        if (G.terrain[rightIndex]) {
            G.terrain[rightIndex].y =
                height * 0.68;
        }
    }

    function terrainHeightAt(x) {
        if (!G.terrain.length) return 0;

        x = clamp(x, 0, G.terrain[G.terrain.length - 1].x);

        for (let i = 0; i < G.terrain.length - 1; i++) {
            const a = G.terrain[i];
            const b = G.terrain[i + 1];

            if (x >= a.x && x <= b.x) {
                const amount =
                    (x - a.x) / Math.max(1, b.x - a.x);

                return a.y + (b.y - a.y) * amount;
            }
        }

        return G.terrain[G.terrain.length - 1].y;
    }

    function drawTerrain() {
        if (!terrainCtx || !G.terrain.length) return;

        const { width, height } = fieldSize();

        terrainCtx.clearRect(0, 0, width, height);

        terrainCtx.beginPath();
        terrainCtx.moveTo(
            G.terrain[0].x,
            G.terrain[0].y
        );

        for (const point of G.terrain) {
            terrainCtx.lineTo(point.x, point.y);
        }

        terrainCtx.lineTo(width, height);
        terrainCtx.lineTo(0, height);
        terrainCtx.closePath();

        const groundGradient =
            terrainCtx.createLinearGradient(
                0,
                height * 0.5,
                0,
                height
            );

        groundGradient.addColorStop(0, "#786044");
        groundGradient.addColorStop(1, "#45342b");

        terrainCtx.fillStyle = groundGradient;
        terrainCtx.fill();

        terrainCtx.beginPath();

        G.terrain.forEach((point, index) => {
            if (index === 0) {
                terrainCtx.moveTo(point.x, point.y);
            } else {
                terrainCtx.lineTo(point.x, point.y);
            }
        });

        terrainCtx.strokeStyle = "#9fce62";
        terrainCtx.lineWidth = 4;
        terrainCtx.lineJoin = "round";
        terrainCtx.stroke();
    }

    /* =========================================
       TANK POSITIONING
       ========================================= */

    function positionTanks() {
        if (!E.field) return;

        const { width } = fieldSize();

        if (width <= 0) return;

        G.x[0] = clamp(G.x[0], 35, width * 0.45);
        G.x[1] = clamp(G.x[1], width * 0.55, width - 35);

        for (let player = 0; player < 2; player++) {
            const tank = E.tank[player];

            if (!tank) continue;

            const groundY = terrainHeightAt(G.x[player]);

            tank.style.left = `${G.x[player]}px`;
            tank.style.top = `${groundY}px`;

            // Preserve the centered tank position and its rotation.
            tank.style.transform =
                "translate(-50%, -50%)";

            const image = E.image[player];

            if (image) {
                image.src = tankImage(player);
            }

            const nameplate = E.nameplate[player];

            if (nameplate) {
                nameplate.textContent =
                    currentPlayerName(player);
            }
        }
    }

    /* =========================================
       START THE BATTLE AFTER THE VS SCREEN
       ========================================= */

    function startMatch() {
        G.matchToken++;

        G.running = false;
        G.paused = false;
        G.busy = false;
        G.dragging = false;

        if (E.pause) {
            E.pause.classList.add("hidden");
        }

        showScreen(E.battle);

        requestAnimationFrame(() => {
            if (!isBattleActive()) return;

            resizeCanvases();

            const { width } = fieldSize();

            if (width <= 0) return;

            G.x = [
                width * 0.13,
                width * 0.87
            ];

            generateTerrain();
            drawTerrain();
            positionTanks();

            G.running = true;

            updateHUD();
            drawAim();
        });
    }

    /* End of Part 3/6 */
     /* =========================================
       PART 4 — MOVEMENT, AIMING & PROJECTILES
       ========================================= */

    function updateHUD() {
        if (E.turn) {
            E.turn.textContent =
                `${currentPlayerName(G.active)}'s Turn`;
        }

        if (E.round) {
            E.round.textContent = G.round;
        }

        if (E.angle) {
            E.angle.textContent =
                `${Math.round(G.angle[G.active])}°`;
        }

        if (E.power) {
            E.power.value = G.power;
        }

        if (E.powerText) {
            E.powerText.textContent = `${G.power}%`;
        }

        for (let player = 0; player < 2; player++) {
            if (E.hudName[player]) {
                E.hudName[player].textContent =
                    currentPlayerName(player);
            }

            if (E.hpText[player]) {
                E.hpText[player].textContent =
                    `${Math.max(0, G.health[player])} HP`;
            }

            if (E.hpFill[player]) {
                E.hpFill[player].style.width =
                    `${clamp(G.health[player], 0, 100)}%`;
            }
        }

        const isActive = canControl();

        if (E.left) E.left.disabled =
            !isActive || G.steps[G.active] <= 0;

        if (E.right) E.right.disabled =
            !isActive || G.steps[G.active] <= 0;

        if (E.fire) E.fire.disabled = !isActive;

        if (E.steps) {
            E.steps.textContent =
                G.steps[G.active];
        }
    }

    /* =========================================
       TANK MOVEMENT
       ========================================= */

    function moveTank(direction) {
        if (!canControl()) return;
        if (G.steps[G.active] <= 0) return;

        const player = G.active;
        const { width } = fieldSize();

        const proposedX =
            G.x[player] +
            direction * RULES.movementDistance;

        const minimumX = player === 0 ? 25 : width * 0.53;
        const maximumX = player === 0 ? width * 0.47 : width - 25;

        const nextX = clamp(
            proposedX,
            minimumX,
            maximumX
        );

        if (Math.abs(nextX - G.x[player]) < 1) return;

        G.x[player] = nextX;
        G.steps[player]--;

        positionTanks();
        drawAim();
        updateHUD();
    }

    /* =========================================
       AIM ANGLE AND POWER
       ========================================= */

    function updateAimAngle(value) {
        if (!canControl()) return;

        G.angle[G.active] = clamp(
            Number(value),
            RULES.minimumAngle,
            RULES.maximumAngle
        );

        if (E.angle) {
            E.angle.textContent =
                `${Math.round(G.angle[G.active])}°`;
        }

        drawAim();
    }

    function updateShotPower(value) {
        G.power = clamp(
            Number(value),
            RULES.minimumPower,
            RULES.maximumPower
        );

        if (E.powerText) {
            E.powerText.textContent =
                `${Math.round(G.power)}%`;
        }

        drawAim();
    }

    function getAimVector(player) {
        const direction = player === 0 ? 1 : -1;
        const radians =
            G.angle[player] * Math.PI / 180;

        return {
            x: Math.cos(radians) * direction,
            y: -Math.sin(radians)
        };
    }

    function muzzle(player) {
        const groundY = terrainHeightAt(G.x[player]);
        const vector = getAimVector(player);

        const barrelLength = 30;

        return {
            x: G.x[player] + vector.x * barrelLength,
            y: groundY - 15 + vector.y * barrelLength
        };
    }

    /* =========================================
       AIMING LINE
       ========================================= */

    function drawAim() {
        if (!aimCtx || !E.field) return;

        const { width, height } = fieldSize();

        aimCtx.clearRect(0, 0, width, height);

        if (!G.running || G.paused || G.busy) return;

        const player = G.active;
        const start = muzzle(player);
        const vector = getAimVector(player);

        const powerScale = G.power / 100;

        aimCtx.save();

        aimCtx.beginPath();
        aimCtx.setLineDash([6, 6]);

        aimCtx.moveTo(start.x, start.y);

        const length = 65 + powerScale * 90;

        aimCtx.lineTo(
            start.x + vector.x * length,
            start.y + vector.y * length
        );

        aimCtx.strokeStyle =
            player === 0 ? "#7dc7ff" : "#ff9b9b";

        aimCtx.lineWidth = 2;
        aimCtx.stroke();

        aimCtx.restore();
    }

    /* =========================================
       SHOOTING
       ========================================= */

    function fireShot() {
        if (!canControl()) return;

        const player = G.active;
        const start = muzzle(player);
        const vector = getAimVector(player);

        G.busy = true;
        G.dragging = false;

        updateHUD();
        drawAim();

        const speed = 230 + G.power * 4.2;

        const velocityX = vector.x * speed;
        const velocityY = vector.y * speed;

        const projectile = document.createElement("div");

        projectile.className = "projectile";
        projectile.style.position = "absolute";
        projectile.style.left = `${start.x}px`;
        projectile.style.top = `${start.y}px`;
        projectile.style.width = "12px";
        projectile.style.height = "12px";
        projectile.style.borderRadius = "50%";
        projectile.style.background =
            player === 0 ? "#8ed5ff" : "#ff8b72";
        projectile.style.boxShadow =
            "0 0 12px rgba(255,190,90,.9)";
        projectile.style.pointerEvents = "none";

        E.projectileLayer.appendChild(projectile);

        let x = start.x;
        let y = start.y;
        let vx = velocityX;
        let vy = velocityY;

        let previousTime = performance.now();

        const token = G.matchToken;

        function animateShot(time) {
            if (token !== G.matchToken) {
                projectile.remove();
                return;
            }

            if (!G.running) {
                projectile.remove();
                return;
            }

            if (G.paused) {
                previousTime = time;
                requestAnimationFrame(animateShot);
                return;
            }

            const dt = Math.min(
                (time - previousTime) / 1000,
                0.035
            );

            previousTime = time;

            vy += RULES.gravity * dt;

            x += vx * dt;
            y += vy * dt;

            projectile.style.left = `${x}px`;
            projectile.style.top = `${y}px`;

            const { width, height } = fieldSize();

            const groundY = terrainHeightAt(x);

            const hitGround =
                x <= 0 ||
                x >= width ||
                y >= groundY ||
                y >= height;

            const target = other(player);

            const targetGround =
                terrainHeightAt(G.x[target]);

            const targetX = G.x[target];
            const targetY = targetGround - 15;

            const distance = Math.hypot(
                x - targetX,
                y - targetY
            );

            if (distance < 24) {
                projectile.remove();
                explode(x, y, target, player);
                return;
            }

            if (hitGround) {
                projectile.remove();
                explode(x, Math.min(y, groundY), target, player);
                return;
            }

            requestAnimationFrame(animateShot);
        }

        requestAnimationFrame(animateShot);
    }

    /* =========================================
       EXPLOSION AND DAMAGE
       ========================================= */

    function explode(x, y, target, shooter) {
        const explosion = document.createElement("div");

        explosion.className = "explosion";
        explosion.style.position = "absolute";
        explosion.style.left = `${x}px`;
        explosion.style.top = `${y}px`;
        explosion.style.width =
            `${RULES.blastRadius * 2}px`;
        explosion.style.height =
            `${RULES.blastRadius * 2}px`;
        explosion.style.borderRadius = "50%";
        explosion.style.transform = "translate(-50%, -50%)";
        explosion.style.pointerEvents = "none";
        explosion.style.background =
            "radial-gradient(circle, rgba(255,245,170,.95) 0%, rgba(255,145,48,.8) 30%, rgba(255,65,25,.2) 65%, transparent 72%)";

        E.effectLayer.appendChild(explosion);

        const distance = Math.hypot(
            x - G.x[target],
            y - (terrainHeightAt(G.x[target]) - 15)
        );

        const damage = Math.round(
            RULES.maximumDamage *
            clamp(
                1 - distance / RULES.blastRadius,
                0,
                1
            )
        );

        if (damage > 0) {
            G.health[target] = Math.max(
                0,
                G.health[target] - damage
            );
        }

        updateHUD();

        explosion.animate(
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

        setTimeout(() => explosion.remove(), 450);

        setTimeout(() => {
            if (G.health[target] <= 0) {
                finishMatch(shooter);
            } else {
                finishImpactTurn();
            }
        }, 450);
    }

    /* =========================================
       END TURN
       ========================================= */

    function finishImpactTurn() {
        if (!G.running) return;

        G.active = other(G.active);
        G.round++;

        G.steps = [
            RULES.movementStepsPerTurn,
            RULES.movementStepsPerTurn
        ];

        G.busy = false;

        updateHUD();
        drawAim();
    }

    /* End of Part 4/6 */
     /* =========================================
       PART 5 — RESULTS AND SAVE / LOAD
       ========================================= */

    function updateHealth() {
        updateHUD();

        for (let player = 0; player < 2; player++) {
            if (E.resultHp[player]) {
                E.resultHp[player].textContent =
                    `${Math.max(0, G.health[player])} HP`;
            }

            if (E.resultHpName[player]) {
                E.resultHpName[player].textContent =
                    currentPlayerName(player);
            }
        }
    }

    /* =========================================
       MATCH RESULTS
       ========================================= */

    function finishMatch(winner) {
        if (!G.running) return;

        G.running = false;
        G.paused = false;
        G.busy = false;
        G.dragging = false;

        if (E.pause) {
            E.pause.classList.add("hidden");
        }

        const winnerName = currentPlayerName(winner);
        const loser = other(winner);

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
                `${winnerName} defeated ${currentPlayerName(loser)}!`;
        }

        if (E.resultImage) {
            E.resultImage.src = tankImage(winner);
        }

        updateHealth();
        showScreen(E.result);
    }

    /* =========================================
       SAVE MATCH
       ========================================= */

    function saveMatch() {
        try {
            const data = {
                version: 3,
                gameMode: G.gameMode,
                players: G.players,
                health: G.health,
                active: G.active,
                round: G.round,
                angle: G.angle,
                power: G.power,
                steps: G.steps,
                x: G.x,
                terrain: G.terrain,
                settings: G.settings
            };

            localStorage.setItem(
                SAVE_KEY,
                JSON.stringify(data)
            );

            showNotice("Match saved successfully!");
        } catch (error) {
            console.error("Save failed:", error);
            showNotice("Unable to save this match.");
        }
    }

    /* =========================================
       LOAD MATCH
       ========================================= */

    function loadMatch() {
        try {
            const saved = localStorage.getItem(SAVE_KEY);

            if (!saved) return false;

            const data = JSON.parse(saved);

            if (
                !data ||
                !Array.isArray(data.players) ||
                !Array.isArray(data.health) ||
                !Array.isArray(data.x) ||
                !Array.isArray(data.terrain)
            ) {
                return false;
            }

            G.matchToken++;

            G.gameMode = data.gameMode || "local";

            G.players = data.players;
            G.health = data.health;
            G.active = data.active === 1 ? 1 : 0;
            G.round = Math.max(1, Number(data.round) || 1);
            G.angle = data.angle || [45, 45];
            G.power = clamp(
                Number(data.power) || 65,
                RULES.minimumPower,
                RULES.maximumPower
            );
            G.steps = data.steps || [3, 3];
            G.x = data.x;
            G.terrain = data.terrain;

            G.running = true;
            G.paused = false;
            G.busy = false;

            if (E.pause) {
                E.pause.classList.add("hidden");
            }

            updatePlayerPreviews();
            updateVSIntro();

            showScreen(E.battle);

            requestAnimationFrame(() => {
                resizeCanvases();
                drawTerrain();
                positionTanks();
                updateHUD();
                drawAim();
            });

            showNotice("Saved match loaded!");
            return true;
        } catch (error) {
            console.error("Load failed:", error);
            showNotice("Could not load the saved match.");
            return false;
        }
    }

    /* =========================================
       SMALL NOTIFICATION
       ========================================= */

    function showNotice(message) {
        let notice = $("game-notice");

        if (!notice) {
            notice = document.createElement("div");
            notice.id = "game-notice";

            Object.assign(notice.style, {
                position: "fixed",
                left: "50%",
                bottom: "24px",
                transform: "translateX(-50%)",
                zIndex: "99999",
                padding: "12px 20px",
                borderRadius: "12px",
                background: "#202b39",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "600",
                textAlign: "center",
                pointerEvents: "none",
                opacity: "0",
                transition: "opacity .2s ease"
            });

            document.body.appendChild(notice);
        }

        notice.textContent = message;
        notice.style.opacity = "1";

        clearTimeout(notice._hideTimer);

        notice._hideTimer = setTimeout(() => {
            notice.style.opacity = "0";
        }, 2200);
    }

    /* End of Part 5/6 */
     /* =========================================
       PART 6 — CONTROLS AND INITIALIZATION
       ========================================= */

    function bindGameplayControls() {
        if (E.left) {
            E.left.addEventListener("click", () => {
                playButtonSound();
                moveTank(-1);
            });
        }

        if (E.right) {
            E.right.addEventListener("click", () => {
                playButtonSound();
                moveTank(1);
            });
        }

        if (E.power) {
            E.power.addEventListener("input", () => {
                updateShotPower(E.power.value);
            });
        }

        if (E.fire) {
            E.fire.addEventListener("click", () => {
                playButtonSound();
                fireShot();
            });
        }

        const beginButton = $("begin-battle-btn");

        if (beginButton) {
            beginButton.addEventListener("click", () => {
                playButtonSound();
                startMatch();
            });
        }

        const restartButton = $("restart-match-btn");

        if (restartButton) {
            restartButton.addEventListener("click", () => {
                playButtonSound();
                prepareMatch();
            });
        }

        /* Keyboard controls */
        document.addEventListener("keydown", event => {
            if (!isBattleActive()) return;
            if (G.paused || G.busy) return;

            const key = event.key.toLowerCase();

            if (key === "arrowleft") {
                event.preventDefault();
                moveTank(-1);
            } else if (key === "arrowright") {
                event.preventDefault();
                moveTank(1);
            } else if (key === " " || key === "enter") {
                event.preventDefault();
                fireShot();
            } else if (key === "escape") {
                if (G.running && E.pause) {
                    G.paused = true;
                    E.pause.classList.remove("hidden");
                }
            }
        });

        /* Dragging on the battlefield adjusts aim. */
        if (E.field) {
            E.field.addEventListener("pointerdown", event => {
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

                updateAimFromPointer(event);

                try {
                    E.field.setPointerCapture(event.pointerId);
                } catch (_) {}
            });

            E.field.addEventListener("pointermove", event => {
                if (!G.dragging) return;
                if (event.pointerId !== G.pointerId) return;

                updateAimFromPointer(event);
            });

            const stopDragging = event => {
                if (event.pointerId !== G.pointerId) return;

                G.dragging = false;
                G.pointerId = null;
            };

            E.field.addEventListener("pointerup", stopDragging);
            E.field.addEventListener("pointercancel", stopDragging);
        }
    }

    function updateAimFromPointer(event) {
        if (!canControl()) return;

        const point = pointInField(event);
        const start = muzzle(G.active);

        const dx = point.x - start.x;
        const dy = start.y - point.y;

        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            return;
        }

        const direction = G.active === 0 ? 1 : -1;

        const directedX = dx * direction;

        if (directedX <= 0) return;

        const radians = Math.atan2(dy, directedX);

        G.angle[G.active] = clamp(
            radians * 180 / Math.PI,
            RULES.minimumAngle,
            RULES.maximumAngle
        );

        if (E.angle) {
            E.angle.textContent =
                `${Math.round(G.angle[G.active])}°`;
        }

        drawAim();
    }

    /* =========================================
       SCREEN ORIENTATION
       ========================================= */

    function updateOrientation() {
        if (!E.rotate) return;

        const portrait =
            window.innerHeight > window.innerWidth;

        const mobile =
            window.matchMedia("(max-width: 800px)").matches;

        if (portrait && mobile) {
            E.rotate.classList.add("active");
        } else {
            E.rotate.classList.remove("active");
        }
    }

    /* =========================================
       INITIALIZE GAME
       ========================================= */

    function initializeGame() {
        loadSettings();

        bindNavigation();
        bindGameplayControls();

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

        window.addEventListener("orientationchange", () => {
            setTimeout(updateOrientation, 150);
        });

        showScreen(E.menu);

        console.log("Tank War initialized.");
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeGame,
            { once: true }
        );
    } else {
        initializeGame();
    }

})();
