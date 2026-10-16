"use strict";

/* =========================================================
   TANK WAR — GAME ENGINE
   Equal tank abilities
   100 HP per tank
   2 seconds of movement per turn
   No battle countdown timer
   ========================================================= */

(() => {
    const $ = id => document.getElementById(id);

    const clamp = (value, min, max) =>
        Math.max(min, Math.min(max, value));

    const random = (min, max) =>
        min + Math.random() * (max - min);

    const ASSETS = {
        menuBackground: "menu-bg.png",
        battleBackground: "battle-bg.jpg",

        blueTank: "tank-blue.png",
        redTank: "tank-red.png",
        explosion: "explosion.png",

        sounds: {
            button: "button-sound.mp3",
            movement: "tank-move.mp3",
            fire: "cannon-fire.mp3",
            explosion: "explosion.mp3",
            hit: "tank-hit.mp3",
            destroyed: "tank-destroyed.mp3",
            victory: "victory.mp3",
            music: "background-music.mp3"
        }
    };

    const RULES = {
        startingHealth: 100,
        movementSeconds: 2,
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

    /*
       All tanks have the same gameplay statistics.
       Their appearances can differ without affecting combat.
    */

    const TANKS = [
        {
            name: "STRIKER",
            image: ASSETS.blueTank
        },
        {
            name: "TITAN",
            image: ASSETS.redTank
        },
        {
            name: "SCOUT",
            image: ASSETS.blueTank
        }
    ];

    const game = {
        screen: "main-menu",
        mode: "local",

        players: [],
        selectedTanks: [0, 1],

        activePlayer: 0,
        round: 1,

        health: [100, 100],
        x: [0, 0],
        angle: [45, 45],
        power: 65,

        terrain: [],
        terrainWidth: 0,
        terrainHeight: 0,

        movementLeft: [2, 2],
        movementTimer: null,
        movementDirection: 0,

        running: false,
        busy: false,
        paused: false,

        lastFrame: 0,
        matchToken: 0,

        settings: {
            effects: true,
            music: false,
            volume: 45
        },

        savedReturnScreen: "main-menu",
        confirmAction: null,

        audioContext: null,
        musicAudio: null
    };


    /* =====================================================
       AUDIO
    ====================================================== */

    function getAudioContext() {
        if (game.audioContext) {
            return game.audioContext;
        }

        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContextClass) {
            return null;
        }

        try {
            game.audioContext = new AudioContextClass();
            return game.audioContext;
        } catch {
            return null;
        }
    }

    function playTone(
        frequency,
        duration,
        type = "sine",
        volume = 0.12,
        slide = 0
    ) {
        if (!game.settings.effects || game.settings.volume === 0) {
            return;
        }

        const context = getAudioContext();

        if (!context) {
            return;
        }

        if (context.state === "suspended") {
            context.resume().catch(() => {});
        }

        const oscillator = context.createOscillator();
        const gain = context.createGain();

        const start = context.currentTime;

        oscillator.type = type;

        oscillator.frequency.setValueAtTime(
            Math.max(30, frequency),
            start
        );

        if (slide !== 0) {
            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(30, frequency + slide),
                start + duration
            );
        }

        gain.gain.setValueAtTime(0.0001, start);

        gain.gain.exponentialRampToValueAtTime(
            Math.max(
                0.0001,
                volume * game.settings.volume / 100
            ),
            start + 0.015
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            start + duration
        );

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    }

    function playSound(name) {
        if (!game.settings.effects) {
            return;
        }

        const soundFrequencies = {
            button: [520, 0.07, "sine", 100],
            movement: [110, 0.09, "square", 20],
            fire: [110, 0.28, "sawtooth", -65],
            explosion: [75, 0.45, "triangle", -30],
            hit: [180, 0.16, "square", -100],
            destroyed: [95, 0.65, "sawtooth", -65],
            victory: [660, 0.45, "triangle", 200]
        };

        const sound = soundFrequencies[name];

        if (!sound) {
            return;
        }

        playTone(
            sound[0],
            sound[1],
            sound[2],
            0.18,
            sound[3]
        );
    }

    function toggleMusic(enabled) {
        game.settings.music = enabled;

        const toggle = $("music-toggle");

        if (toggle) {
            toggle.checked = enabled;
        }

        if (!enabled) {
            if (game.musicAudio) {
                game.musicAudio.pause();
            }

            return;
        }

        if (!game.musicAudio) {
            game.musicAudio = new Audio(ASSETS.sounds.music);
            game.musicAudio.loop = true;
            game.musicAudio.volume =
                game.settings.volume / 100;
        }

        game.musicAudio.volume =
            game.settings.volume / 100;

        game.musicAudio.play().catch(() => {
            notice("Tap the screen to enable music.");
        });
    }


    /* =====================================================
       SCREEN MANAGEMENT
    ====================================================== */

    function showScreen(id) {
        document.querySelectorAll(".screen").forEach(screen => {
            screen.classList.toggle(
                "active",
                screen.id === id
            );
        });

        game.screen = id;

        if (id === "battle-screen") {
            resizeBattlefield();
            drawTerrain();
            positionTanks();
            drawAimGuide();
            updateHUD();
            updateControls();
        }

        updateResumeButton();
    }

    function notice(message, duration = 2400) {
        const element = $("global-notice");

        if (!element) {
            return;
        }

        element.textContent = message;
        element.classList.add("show");

        clearTimeout(notice.timer);

        notice.timer = setTimeout(() => {
            element.classList.remove("show");
        }, duration);
    }

    function setText(id, value) {
        const element = $(id);

        if (element) {
            element.textContent = value;
        }
    }


    /* =====================================================
       TANK SELECTION
    ====================================================== */

    function getTankSelection(index) {
        const select = $(
            index === 0 ? "player1-tank" : "player2-tank"
        );

        return clamp(
            Number(select?.value ?? index),
            0,
            TANKS.length - 1
        );
    }

    function getTankImage(playerIndex) {
        return playerIndex === 0
            ? ASSETS.blueTank
            : ASSETS.redTank;
    }

    function updateTankPreviews() {
        const preview1 = $("player1-tank-preview");
        const preview2 = $("player2-tank-preview");

        if (preview1) {
            preview1.src = ASSETS.blueTank;
        }

        if (preview2) {
            preview2.src = ASSETS.redTank;
        }
    }

    function updateResumeButton() {
        const button = $("resume-match-btn");

        if (!button) {
            return;
        }

        let hasSave = false;

        try {
            hasSave = Boolean(
                localStorage.getItem("tankWarSave")
            );
        } catch {
            hasSave = false;
        }

        button.classList.toggle("hidden", !hasSave);
    }


    /* =====================================================
       START AND RESET MATCH
    ====================================================== */

    function startMatch() {
        stopMovement();

        game.matchToken++;

        game.running = false;
        game.busy = false;
        game.paused = false;

        game.health = [
            RULES.startingHealth,
            RULES.startingHealth
        ];

        game.activePlayer = 0;
        game.round = 1;

        game.angle = [45, 45];
        game.power = 65;

        game.movementLeft = [
            RULES.movementSeconds,
            RULES.movementSeconds
        ];

        game.selectedTanks = [
            getTankSelection(0),
            getTankSelection(1)
        ];

        const name1 =
            ($("player1-name")?.value || "BLUE")
                .trim()
                .slice(0, 18) || "BLUE";

        const name2 =
            ($("player2-name")?.value || "RED")
                .trim()
                .slice(0, 18) || "RED";

        game.players = [
            {
                name: name1,
                image: ASSETS.blueTank,
                tank: game.selectedTanks[0]
            },
            {
                name: name2,
                image: ASSETS.redTank,
                tank: game.selectedTanks[1]
            }
        ];

        setText("vs-name1", name1);
        setText("vs-name2", name2);
        setText("vs-status", "PREPARING BATTLEFIELD");

        showScreen("vs-screen");

        const token = game.matchToken;

        setTimeout(() => {
            if (token !== game.matchToken) {
                return;
            }

            game.running = true;

            showScreen("battle-screen");

            generateTerrain();

            const battlefield = $("battlefield");

            const width =
                battlefield?.clientWidth || window.innerWidth;

            game.x = [
                width * 0.18,
                width * 0.82
            ];

            game.movementLeft = [
                RULES.movementSeconds,
                RULES.movementSeconds
            ];

            positionTanks();
            drawTerrain();
            drawAimGuide();
            updateHUD();
            updateControls();

            saveMatch();

            notice(`${name1}'s turn! Aim and fire.`);
        }, 1000);
    }


    /* =====================================================
       BATTLEFIELD AND TERRAIN
    ====================================================== */

    function getBattlefieldSize() {
        const battlefield = $("battlefield");

        return {
            width: battlefield?.clientWidth || window.innerWidth,
            height: battlefield?.clientHeight || window.innerHeight * 0.65
        };
    }

    function generateTerrain() {
        const { width, height } = getBattlefieldSize();

        game.terrain = [];

        const step = 5;
        let y = height * 0.69;

        game.terrain.push({
            x: 0,
            y
        });

        for (let x = step; x < width; x += step) {
            y += random(-3.2, 3.2);

            y = clamp(
                y,
                height * 0.53,
                height * 0.83
            );

            game.terrain.push({
                x,
                y
            });
        }

        game.terrain.push({
            x: width,
            y
        });

        game.terrainWidth = width;
        game.terrainHeight = height;

        game.x = [
            width * 0.18,
            width * 0.82
        ];

        drawTerrain();
    }

    function resizeBattlefield() {
        const canvas = $("terrain-canvas");
        const aimCanvas = $("aim-canvas");

        if (!canvas || !aimCanvas) {
            return;
        }

        const { width, height } = getBattlefieldSize();

        const oldWidth = game.terrainWidth;
        const oldHeight = game.terrainHeight;

        if (
            game.terrain.length &&
            oldWidth > 0 &&
            oldHeight > 0 &&
            (oldWidth !== width || oldHeight !== height)
        ) {
            game.terrain = game.terrain.map(point => ({
                x: point.x / oldWidth * width,
                y: point.y / oldHeight * height
            }));

            game.x = game.x.map(
                x => x / oldWidth * width
            );
        }

        game.terrainWidth = width;
        game.terrainHeight = height;

        const ratio = Math.min(
            window.devicePixelRatio || 1,
            2
        );

        [canvas, aimCanvas].forEach(item => {
            item.width = Math.round(width * ratio);
            item.height = Math.round(height * ratio);

            item.style.width = `${width}px`;
            item.style.height = `${height}px`;

            const ctx = item.getContext("2d");

            if (ctx) {
                ctx.setTransform(
                    ratio, 0, 0, ratio, 0, 0
                );
            }
        });

        drawTerrain();
        positionTanks();
        drawAimGuide();
    }

    function terrainYAt(x) {
        if (!game.terrain.length) {
            return game.terrainHeight * 0.7;
        }

        x = clamp(x, 0, game.terrainWidth);

        for (let i = 1; i < game.terrain.length; i++) {
            const a = game.terrain[i - 1];
            const b = game.terrain[i];

            if (x <= b.x) {
                const fraction =
                    (x - a.x) / Math.max(1, b.x - a.x);

                return a.y + (b.y - a.y) * fraction;
            }
        }

        return game.terrain[game.terrain.length - 1].y;
    }

    function drawTerrain() {
        const canvas = $("terrain-canvas");

        if (!canvas || !game.terrain.length) {
            return;
        }

        const ctx = canvas.getContext("2d");

        if (!ctx) {
            return;
        }

        const width = game.terrainWidth;
        const height = game.terrainHeight;

        ctx.clearRect(0, 0, width, height);

        ctx.beginPath();
        ctx.moveTo(0, height);

        game.terrain.forEach(point => {
            ctx.lineTo(point.x, point.y);
        });

        ctx.lineTo(width, height);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(
            0,
            height * 0.5,
            0,
            height
        );

        gradient.addColorStop(0, "#d7a15c");
        gradient.addColorStop(0.45, "#95643d");
        gradient.addColorStop(1, "#493126");

        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();

        game.terrain.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });

        ctx.strokeStyle = "#f1c784";
        ctx.lineWidth = 3;
        ctx.stroke();
    }


    /* =====================================================
       TANK POSITIONS
    ====================================================== */

    function positionTanks() {
        if (!game.terrain.length) {
            return;
        }

        const tank1 = $("tank1");
        const tank2 = $("tank2");

        if (!tank1 || !tank2) {
            return;
        }

        [tank1, tank2].forEach((tank, index) => {
            const tankWidth = tank.offsetWidth || 70;

            const x = clamp(
                game.x[index],
                tankWidth / 2,
                game.terrainWidth - tankWidth / 2
            );

            game.x[index] = x;

            const groundY = terrainYAt(x);

            tank.style.left =
                `${x - tankWidth / 2}px`;

            tank.style.top =
                `${groundY - (tank.offsetHeight || 50) + 8}px`;

            const image = tank.querySelector("img");

            if (image) {
                image.style.transform =
                    index === 0 ? "scaleX(1)" : "scaleX(-1)";
            }
        });
    }


    /* =====================================================
       MOVEMENT — TWO SECONDS PER TURN
    ====================================================== */

    function startMovement(direction) {
        if (
            !game.running ||
            game.paused ||
            game.busy ||
            game.movementLeft[game.activePlayer] <= 0
        ) {
            return;
        }

        stopMovement();

        game.movementDirection = direction;
        game.lastFrame = performance.now();

        game.movementTimer = setInterval(() => {
            if (
                !game.running ||
                game.paused ||
                game.busy
            ) {
                stopMovement();
                return;
            }

            const player = game.activePlayer;

            if (game.movementLeft[player] <= 0) {
                stopMovement();
                return;
            }

            const elapsed = 0.05;

            game.movementLeft[player] = Math.max(
                0,
                game.movementLeft[player] - elapsed
            );

            const tankWidth = $("tank1")?.offsetWidth || 65;

            const minX = tankWidth / 2;
            const maxX = game.terrainWidth - tankWidth / 2;

            const proposedX =
                game.x[player] +
                game.movementDirection *
                RULES.movementSpeed *
                elapsed;

            const otherPlayer = 1 - player;

            const minimumGap = tankWidth * 0.9;

            const safeX = clamp(
                proposedX,
                minX,
                maxX
            );

            if (
                Math.abs(safeX - game.x[otherPlayer]) >
                minimumGap
            ) {
                game.x[player] = safeX;
            }

            positionTanks();
            updateMovementDisplay();
            saveMatch();
        }, 50);
    }

    function stopMovement() {
        if (game.movementTimer !== null) {
            clearInterval(game.movementTimer);
            game.movementTimer = null;
        }

        game.movementDirection = 0;
    }

    function updateMovementDisplay() {
        const remaining =
            game.movementLeft[game.activePlayer];

        setText(
            "movement-time",
            `${Math.max(0, remaining).toFixed(1)} s`
        );

        const exhausted = remaining <= 0;

        ["move-left-btn", "move-right-btn"].forEach(id => {
            const button = $(id);

            if (button) {
                button.disabled =
                    exhausted ||
                    !game.running ||
                    game.busy ||
                    game.paused;
            }
        });
    }


    /* =====================================================
       AIMING
    ====================================================== */

    function updateAimFromInput() {
        const angle = $("aim-angle");
        const power = $("shot-power");

        if (angle) {
            game.angle[game.activePlayer] = clamp(
                Number(angle.value),
                RULES.minimumAngle,
                RULES.maximumAngle
            );
        }

        if (power) {
            game.power = clamp(
                Number(power.value),
                RULES.minimumPower,
                RULES.maximumPower
            );
        }

        setText(
            "angle-value",
            `${game.angle[game.activePlayer]}°`
        );

        setText(
            "power-value",
            `${game.power}%`
        );

        drawAimGuide();
    }

    function drawAimGuide() {
        const canvas = $("aim-canvas");

        if (!canvas || !game.terrain.length) {
            return;
        }

        const ctx = canvas.getContext("2d");

        if (!ctx) {
            return;
        }

        const width = game.terrainWidth;
        const height = game.terrainHeight;

        ctx.clearRect(0, 0, width, height);

        if (!game.running || game.busy || game.paused) {
            return;
        }

        const player = game.activePlayer;
        const direction = player === 0 ? 1 : -1;

        const angle =
            game.angle[player] * Math.PI / 180;

        const tankX = game.x[player];
        const tankY = terrainYAt(tankX) - 30;

        const barrelLength = 28;

        const startX =
            tankX + Math.cos(angle) * barrelLength * direction;

        const startY =
            tankY - Math.sin(angle) * barrelLength;

        ctx.beginPath();

        ctx.moveTo(startX, startY);

        const velocity = game.power * 1.8;

        for (let t = 0; t < 1.2; t += 0.05) {
            const x =
                startX +
                direction * velocity * Math.cos(angle) * t;

            const y =
                startY -
                velocity * Math.sin(angle) * t +
                0.5 * RULES.projectileGravity * t * t;

            if (
                x < 0 ||
                x > width ||
                y > height
            ) {
                break;
            }

            ctx.lineTo(x, y);
        }

        ctx.strokeStyle =
            player === 0
                ? "rgba(90,200,255,.7)"
                : "rgba(255,125,110,.7)";

        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
    }


    /* =====================================================
       FIRING AND PROJECTILE PHYSICS
    ====================================================== */

    function fireShot() {
        if (
            !game.running ||
            game.busy ||
            game.paused
        ) {
            return;
        }

        stopMovement();

        game.busy = true;

        updateControls();
        drawAimGuide();

        const player = game.activePlayer;
        const direction = player === 0 ? 1 : -1;

        const angle =
            game.angle[player] * Math.PI / 180;

        const power = game.power;

        const tankX = game.x[player];
        const tankY = terrainYAt(tankX) - 30;

        const startX =
            tankX + Math.cos(angle) * 27 * direction;

        const startY =
            tankY - Math.sin(angle) * 27;

        const velocity = power * 2.7;

        const projectile = document.createElement("div");

        projectile.className = "projectile";

        $("projectile-layer")?.appendChild(projectile);

        if (!projectile.isConnected) {
            game.busy = false;
            updateControls();
            notice("Projectile layer is unavailable.");
            return;
        }

        playSound("fire");

        let elapsed = 0;

        const token = game.matchToken;

        function frame(timestamp) {
            if (
                token !== game.matchToken ||
                !game.running ||
                game.paused
            ) {
                projectile.remove();
                return;
            }

            if (!frame.lastTimestamp) {
                frame.lastTimestamp = timestamp;
            }

            const delta = Math.min(
                (timestamp - frame.lastTimestamp) / 1000,
                0.04
            );

            frame.lastTimestamp = timestamp;
            elapsed += delta;

            const x =
                startX +
                direction *
                velocity *
                Math.cos(angle) *
                elapsed;

            const y =
                startY -
                velocity *
                Math.sin(angle) *
                elapsed +
                0.5 *
                RULES.projectileGravity *
                elapsed *
                elapsed;

            projectile.style.left = `${x}px`;
            projectile.style.top = `${y}px`;

            const outside =
                x < 0 ||
                x > game.terrainWidth ||
                y > game.terrainHeight;

            const terrainHit =
                !outside &&
                y >= terrainYAt(x);

            const tankHit = !outside &&
                checkTankCollision(x, y);

            if (outside || terrainHit || tankHit) {
                projectile.remove();

                resolveImpact(
                    x,
                    Math.min(y, game.terrainHeight),
                    tankHit
                );

                return;
            }

            requestAnimationFrame(frame);
        }

        requestAnimationFrame(frame);
    }

    function checkTankCollision(x, y) {
        for (let i = 0; i < 2; i++) {
            const tank = $(`tank${i + 1}`);

            if (!tank) {
                continue;
            }

            const rect = tank.getBoundingClientRect();
            const battlefieldRect =
                $("battlefield").getBoundingClientRect();

            const left = rect.left - battlefieldRect.left;
            const top = rect.top - battlefieldRect.top;

            if (
                x >= left &&
                x <= left + rect.width &&
                y >= top &&
                y <= top + rect.height
            ) {
                return i;
            }
        }

        return null;
    }


    /* =====================================================
       EXPLOSIONS AND DAMAGE
    ====================================================== */

    function resolveImpact(x, y, directHit) {
        playSound("explosion");

        const effectLayer = $("effect-layer");

        if (effectLayer) {
            const explosion = document.createElement("div");

            explosion.className = "explosion-effect";

            explosion.style.left = `${x}px`;
            explosion.style.top = `${y}px`;

            effectLayer.appendChild(explosion);

            setTimeout(() => {
                explosion.remove();
            }, 500);
        }

        const hitPlayer = directHit;

        for (let i = 0; i < 2; i++) {
            const tankX = game.x[i];
            const tankY = terrainYAt(tankX) - 20;

            const distance = Math.hypot(
                tankX - x,
                tankY - y
            );

            if (
                distance > RULES.blastRadius &&
                hitPlayer !== i
            ) {
                continue;
            }

            let damage = Math.round(
                RULES.maximumDamage *
                (1 - distance / RULES.blastRadius)
            );

            if (hitPlayer === i) {
                damage = RULES.maximumDamage;
            }

            damage = clamp(
                damage,
                RULES.minimumDamage,
                RULES.maximumDamage
            );

            game.health[i] = clamp(
                game.health[i] - damage,
                0,
                RULES.startingHealth
            );

            showDamageNumber(
                tankX,
                tankY - 20,
                damage
            );

            playSound("hit");
        }

        drawTerrain();
        positionTanks();
        updateHUD();

        setTimeout(() => {
            if (!game.running) {
                return;
            }

            const defeatedPlayer =
                game.health.findIndex(health => health <= 0);

            if (defeatedPlayer !== -1) {
                finishMatch(1 - defeatedPlayer);
                return;
            }

            endTurn();
        }, 550);
    }

    function showDamageNumber(x, y, damage) {
        const layer = $("effect-layer");

        if (!layer) {
            return;
        }

        const element = document.createElement("div");

        element.className = "damage-number";
        element.textContent = `-${damage}`;

        element.style.left = `${x}px`;
        element.style.top = `${y}px`;

        layer.appendChild(element);

        setTimeout(() => {
            element.remove();
        }, 950);
    }


    /* =====================================================
       TURN MANAGEMENT
    ====================================================== */

    function endTurn() {
        stopMovement();

        game.activePlayer = 1 - game.activePlayer;

        if (game.activePlayer === 0) {
            game.round++;
        }

        game.movementLeft[game.activePlayer] =
            RULES.movementSeconds;

        const angleInput = $("aim-angle");

        if (angleInput) {
            angleInput.value =
                game.angle[game.activePlayer];
        }

        const powerInput = $("shot-power");

        if (powerInput) {
            powerInput.value = game.power;
        }

        game.busy = false;

        updateHUD();
        updateControls();
        drawAimGuide();

        saveMatch();

        notice(
            `${game.players[game.activePlayer].name}'s turn!`
        );
    }

    function finishMatch(winner) {
        stopMovement();

        game.running = false;
        game.busy = true;

        clearSavedMatch();

        const winnerPlayer = game.players[winner];

        setText("result-title", "VICTORY!");
        setText("winner-name", winnerPlayer.name);

        setText(
            "result-description",
            `${winnerPlayer.name} won the battle!`
        );

        setText(
            "result-health1",
            `${game.health[0]} HP`
        );

        setText(
            "result-health2",
            `${game.health[1]} HP`
        );

        const resultImage = $("result-tank-image");

        if (resultImage) {
            resultImage.src = getTankImage(winner);
        }

        playSound("victory");

        showScreen("result-screen");
    }


    /* =====================================================
       HUD AND CONTROLS
    ====================================================== */

    function updateHUD() {
        if (game.players.length !== 2) {
            return;
        }

        for (let i = 0; i < 2; i++) {
            const health = game.health[i];

            setText(
                `hud-name${i + 1}`,
                game.players[i].name
            );

            setText(
                `tank${i + 1}-name`,
                game.players[i].name
            );

            setText(
                `hud-health${i + 1}-text`,
                `${health} HP`
            );

            const fill = $(`health${i + 1}-fill`);

            if (fill) {
                fill.style.width = `${health}%`;
            }

            const bar = $(`health${i + 1}-bar`);

            if (bar) {
                bar.setAttribute("aria-valuenow", health);
            }
        }

        setText("round-number", game.round);

        setText(
            "turn-indicator",
            `${game.players[game.activePlayer].name}'S TURN`
        );

        setText(
            "angle-value",
            `${game.angle[game.activePlayer]}°`
        );

        setText("power-value", `${game.power}%`);

        updateMovementDisplay();
    }

    function updateControls() {
        const disabled =
            !game.running ||
            game.busy ||
            game.paused;

        [
            "fire-btn",
            "aim-angle",
            "shot-power",
            "angle-down-btn",
            "angle-up-btn"
        ].forEach(id => {
            const element = $(id);

            if (element) {
                element.disabled = disabled;
            }
        });

        updateMovementDisplay();
    }


    /* =====================================================
       SAVE AND RESUME
    ====================================================== */

    function saveMatch() {
        if (
            !game.running ||
            game.screen !== "battle-screen"
        ) {
            return;
        }

        const width = game.terrainWidth || 1;
        const height = game.terrainHeight || 1;

        const save = {
            players: game.players,
            selectedTanks: game.selectedTanks,

            health: game.health,
            activePlayer: game.activePlayer,
            round: game.round,

            x: game.x.map(value => value / width),
            angle: game.angle,
            power: game.power,

            movementLeft: game.movementLeft,

            terrain: game.terrain.map(point => ({
                x: point.x / width,
                y: point.y / height
            }))
        };

        try {
            localStorage.setItem(
                "tankWarSave",
                JSON.stringify(save)
            );

            updateResumeButton();
        } catch {
            // Storage may be disabled in the browser.
        }
    }

    function clearSavedMatch() {
        try {
            localStorage.removeItem("tankWarSave");
        } catch {
            // Ignore storage restrictions.
        }

        updateResumeButton();
    }

    function resumeMatch() {
        let save;

        try {
            save = JSON.parse(
                localStorage.getItem("tankWarSave") || "null"
            );
        } catch {
            save = null;
        }

        if (!save || !save.players || save.players.length !== 2) {
            notice("No saved match was found.");
            return;
        }

        stopMovement();

        game.matchToken++;

        game.players = save.players;
        game.selectedTanks = save.selectedTanks || [0, 1];

        game.health = save.health || [100, 100];
        game.activePlayer = save.activePlayer || 0;
        game.round = save.round || 1;

        game.angle = save.angle || [45, 45];
        game.power = save.power || 65;

        game.movementLeft = save.movementLeft || [2, 2];

        game.running = true;
        game.busy = false;
        game.paused = false;

        showScreen("battle-screen");

        const { width, height } = getBattlefieldSize();

        game.terrain = (save.terrain || []).map(point => ({
            x: point.x * width,
            y: point.y * height
        }));

        game.terrainWidth = width;
        game.terrainHeight = height;

        game.x = (save.x || [0.18, 0.82]).map(
            value => value * width
        );

        drawTerrain();
        positionTanks();
        updateHUD();
        updateControls();
        drawAimGuide();

        notice("Match resumed.");
    }


    /* =====================================================
       PAUSE MENU AND CONFIRMATION
    ====================================================== */

    function openPauseMenu() {
        if (!game.running || game.busy) {
            return;
        }

        stopMovement();

        game.paused = true;

        $("battle-menu-overlay")?.classList.remove("hidden");

        updateControls();
    }

    function closePauseMenu() {
        game.paused = false;

        $("battle-menu-overlay")?.classList.add("hidden");

        updateControls();
        drawAimGuide();
    }

    function askConfirmation(title, message, action) {
        setText("confirmation-title", title);
        setText("confirmation-message", message);

        game.confirmAction = action;

        $("confirmation-overlay")?.classList.remove("hidden");
    }

    function closeConfirmation() {
        $("confirmation-overlay")?.classList.add("hidden");

        game.confirmAction = null;
    }


    /* =====================================================
       SETTINGS
    ====================================================== */

    function loadSettings() {
        try {
            const saved = JSON.parse(
                localStorage.getItem("tankWarSettings") || "{}"
            );

            game.settings = {
                ...game.settings,
                ...saved
            };
        } catch {
            // Use default settings.
        }

        if ($("effects-toggle")) {
            $("effects-toggle").checked =
                game.settings.effects;
        }

        if ($("music-toggle")) {
            $("music-toggle").checked =
                game.settings.music;
        }

        if ($("volume-slider")) {
            $("volume-slider").value =
                game.settings.volume;
        }

        setText(
            "volume-value",
            `${game.settings.volume}%`
        );
    }

    function saveSettings() {
        try {
            localStorage.setItem(
                "tankWarSettings",
                JSON.stringify(game.settings)
            );
        } catch {
            // Ignore storage restrictions.
        }
    }


    /* =====================================================
       EVENT LISTENERS
    ====================================================== */

    function bind(id, event, callback) {
        const element = $(id);

        if (element) {
            element.addEventListener(event, callback);
        }
    }

    function bindEvents() {

        /* Main menu */

        bind("play-btn", "click", () => {
            playSound("button");
            showScreen("mode-screen");
        });

        bind("online-btn", "click", () => {
            playSound("button");
            showScreen("online-screen");
            notice("Online multiplayer requires server setup.");
        });

        bind("local-mode-btn", "click", () => {
            playSound("button");
            showScreen("setup-screen");
        });

        bind("online-mode-btn", "click", () => {
            playSound("button");
            showScreen("online-screen");
        });

        bind("menu-settings-btn", "click", openSettings);
        bind("menu-settings-secondary-btn", "click", openSettings);

        bind("resume-match-btn", "click", resumeMatch);


        /* Navigation */

        document.querySelectorAll('[data-action="back-to-menu"]')
            .forEach(button => {
                button.addEventListener("click", () => {
                    showScreen("main-menu");
                });
            });

        document.querySelectorAll('[data-action="back-to-mode"]')
            .forEach(button => {
                button.addEventListener("click", () => {
                    showScreen("mode-screen");
                });
            });


        /* Tank setup */

        bind("player1-tank", "change", updateTankPreviews);
        bind("player2-tank", "change", updateTankPreviews);

        bind("start-match-btn", "click", startMatch);


        /* Movement */

        bind("move-left-btn", "pointerdown", event => {
            event.preventDefault();
            startMovement(-1);
        });

        bind("move-right-btn", "pointerdown", event => {
            event.preventDefault();
            startMovement(1);
        });

        ["move-left-btn", "move-right-btn"].forEach(id => {
            bind(id, "pointerup", stopMovement);
            bind(id, "pointercancel", stopMovement);
            bind(id, "lostpointercapture", stopMovement);
        });

        window.addEventListener("pointerup", stopMovement);


        /* Aiming and power */

        bind("aim-angle", "input", updateAimFromInput);
        bind("shot-power", "input", updateAimFromInput);

        bind("angle-down-btn", "click", () => {
            const input = $("aim-angle");

            if (!input) return;

            input.value = clamp(
                Number(input.value) - 1,
                RULES.minimumAngle,
                RULES.maximumAngle
            );

            updateAimFromInput();
        });

        bind("angle-up-btn", "click", () => {
            const input = $("aim-angle");

            if (!input) return;

            input.value = clamp(
                Number(input.value) + 1,
                RULES.minimumAngle,
                RULES.maximumAngle
            );

            updateAimFromInput();
        });

        bind("fire-btn", "click", fireShot);


        /* Pause menu */

        bind("battle-menu-btn", "click", openPauseMenu);

        bind("continue-battle-btn", "click", closePauseMenu);

        bind("save-match-btn", "click", () => {
            saveMatch();
            notice("Match saved on this device.");
        });

        bind("restart-match-btn", "click", () => {
            askConfirmation(
                "RESTART MATCH?",
                "Your current match progress will be lost.",
                () => {
                    closeConfirmation();
                    closePauseMenu();
                    clearSavedMatch();
                    startMatch();
                }
            );
        });

        bind("return-menu-btn", "click", () => {
            askConfirmation(
                "RETURN TO MENU?",
                "Your current battle will end.",
                () => {
                    stopMovement();

                    game.running = false;
                    game.busy = false;
                    game.paused = false;

                    clearSavedMatch();

                    $("battle-menu-overlay")?.classList.add("hidden");

                    showScreen("main-menu");
                    closeConfirmation();
                }
            );
        });


        /* Results */

        bind("rematch-btn", "click", startMatch);

        bind("result-menu-btn", "click", () => {
            showScreen("main-menu");
        });


        /* Confirmation dialog */

        bind("confirm-cancel-btn", "click", closeConfirmation);

        bind("confirm-accept-btn", "click", () => {
            const action = game.confirmAction;

            closeConfirmation();

            if (typeof action === "function") {
                action();
            }
        });


        /* Settings */

        bind("settings-back-btn", "click", () => {
            showScreen(game.savedReturnScreen);
        });

        bind("effects-toggle", "change", event => {
            game.settings.effects = event.target.checked;
            saveSettings();
        });

        bind("music-toggle", "change", event => {
            toggleMusic(event.target.checked);
            saveSettings();
        });

        bind("volume-slider", "input", event => {
            game.settings.volume = Number(event.target.value);

            setText(
                "volume-value",
                `${game.settings.volume}%`
            );

            if (game.musicAudio) {
                game.musicAudio.volume =
                    game.settings.volume / 100;
            }

            saveSettings();
        });

        bind("reset-settings-btn", "click", () => {
            game.settings = {
                effects: true,
                music: false,
                volume: 45
            };

            loadSettings();
            toggleMusic(false);
            saveSettings();

            notice("Settings reset.");
        });


        /* Online controls — UI only until backend exists */

        bind("create-room-btn", "click", () => {
            notice(
                "Online rooms are not connected yet. A multiplayer server is required."
            );
        });

        bind("join-room-btn", "click", () => {
            const code = (
                $("room-code-input")?.value || ""
            ).trim().toUpperCase();

            if (!/^[A-Z0-9]{6}$/.test(code)) {
                notice("Enter a valid six-character room code.");
                return;
            }

            notice("Online server is not connected yet.");
        });

        bind("ready-btn", "click", () => {
            notice("Ready status requires the online server.");
        });

        bind("leave-room-btn", "click", () => {
            showScreen("main-menu");
        });

        bind("copy-room-code-btn", "click", async () => {
            const code = $("room-code-display")?.textContent.trim();

            if (!code || code === "------") {
                notice("No room code is available.");
                return;
            }

            try {
                await navigator.clipboard.writeText(code);
                notice("Room code copied.");
            } catch {
                notice(`Room code: ${code}`);
            }
        });

        bind("share-room-btn", "click", async () => {
            const code = $("room-code-display")?.textContent.trim();

            if (!code || code === "------") {
                notice("Create a room first.");
                return;
            }

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: "Tank War",
                        text: `Join my Tank War room: ${code}`
                    });
                } catch {
                    // User cancelled sharing.
                }
            } else {
                notice(`Share this room code: ${code}`);
            }
        });


        /* Resize */

        window.addEventListener("resize", () => {
            if (game.screen === "battle-screen") {
                resizeBattlefield();
                positionTanks();
                drawAimGuide();
            }
        });

        window.addEventListener("orientationchange", () => {
            setTimeout(() => {
                if (game.screen === "battle-screen") {
                    resizeBattlefield();
                    positionTanks();
                    drawAimGuide();
                }
            }, 200);
        });

        window.addEventListener("beforeunload", saveMatch);
    }


    /* =====================================================
       SETTINGS NAVIGATION
    ====================================================== */

    function openSettings() {
        game.savedReturnScreen = game.screen;

        playSound("button");

        showScreen("settings-screen");
    }


    /* =====================================================
       INITIALISATION
    ====================================================== */

    function init() {
        bindEvents();

        loadSettings();

        updateTankPreviews();

        updateResumeButton();

        showScreen("main-menu");

        console.log("Tank War engine initialised.");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();