// ========================================
// TANK WAR V2 — BATTLEFIELD PROTOTYPE
// ========================================

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

  const game = {
    players: [
      { name: "PLAYER 1", hp: 100, x: 12 },
      { name: "PLAYER 2", hp: 100, x: 78 }
    ],
    current: 0,
    movementLeft: 3,
    moving: null,
    moveTimer: null,
    soundEnabled: true
  };

  function showScreen(id) {
    if (!screenIds.includes(id)) return;

    screenIds.forEach(screenId => {
      const screen = $(screenId);
      if (!screen) return;

      screen.classList.remove("active");
      screen.style.display = "none";
      screen.setAttribute("aria-hidden", "true");
    });

    const target = $(id);
    if (!target) return;

    target.style.display = "flex";
    target.classList.add("active");
    target.setAttribute("aria-hidden", "false");
  }

  function setMessage(message) {
    $("battle-message").textContent = message;
  }

  function stopMovement() {
    if (game.moveTimer) {
      clearInterval(game.moveTimer);
      game.moveTimer = null;
    }

    game.moving = null;
  }

  function updateTankPositions() {
    $("tank1").style.left = `${game.players[0].x}%`;
    $("tank1").style.right = "auto";

    $("tank2").style.left = `${game.players[1].x}%`;
    $("tank2").style.right = "auto";

    // Face each tank toward the opposing player.
    $("tank1").style.transform = "scaleX(1)";
    $("tank2").style.transform = "scaleX(-1)";
  }

  function updateHUD() {
    const p1 = game.players[0];
    const p2 = game.players[1];

    $("battle-name1").textContent = p1.name;
    $("battle-name2").textContent = p2.name;

    $("health1").style.width = `${p1.hp}%`;
    $("health2").style.width = `${p2.hp}%`;

    $("hp-text1").textContent = `${p1.hp} HP`;
    $("hp-text2").textContent = `${p2.hp} HP`;

    $("turn-indicator").textContent =
      `${game.players[game.current].name}'S TURN`;

    $("movement-remaining").textContent =
      `${game.movementLeft.toFixed(1)}s LEFT`;

    $("move-left-btn").disabled = game.movementLeft <= 0;
    $("move-right-btn").disabled = game.movementLeft <= 0;
  }

  function resetGame() {
    stopMovement();

    game.players = [
      {
        name: $("player1-name").value.trim() || "PLAYER 1",
        hp: 100,
        x: 12
      },
      {
        name: $("player2-name").value.trim() || "PLAYER 2",
        hp: 100,
        x: 78
      }
    ];

    game.current = 0;
    game.movementLeft = 3;

    $("victory-overlay").hidden = true;

    updateTankPositions();
    updateHUD();
    setMessage("PLAYER 1: MOVE YOUR TANK");
  }

  function startMovement(direction) {
    if (game.movementLeft <= 0 || game.moving) return;

    game.moving = direction;

    game.moveTimer = setInterval(() => {
      const player = game.players[game.current];
      const opponent = game.players[1 - game.current];

      const step = 0.7;
      const next = player.x + direction * step;

      const min = 2;
      const max = 90;

      // Keep tanks separated.
      const tankGap = 10;
      const opponentLeft = opponent.x;

      if (game.current === 0) {
        player.x = Math.min(
          Math.max(next, min),
          opponentLeft - tankGap
        );
      } else {
        player.x = Math.max(
          Math.min(next, max),
          opponentLeft + tankGap
        );
      }

      player.x = Math.max(min, Math.min(max, player.x));

      game.movementLeft = Math.max(0, game.movementLeft - 0.1);

      updateTankPositions();
      updateHUD();

      if (game.movementLeft <= 0) {
        stopMovement();
        setMessage("MOVEMENT USED. END YOUR TURN.");
      }
    }, 100);
  }

  function endMovement() {
    stopMovement();

    game.current = 1 - game.current;
    game.movementLeft = 3;

    updateHUD();

    setMessage(`${game.players[game.current].name}: YOUR TURN`);
  }

  // Main menu navigation.
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
    $("setup-error").textContent = "";
    showScreen("local-setup-screen");
  });

  $("online-match-btn").addEventListener("click", () => {
    showScreen("online-screen");
  });

  document.querySelectorAll("[data-screen]").forEach(button => {
    button.addEventListener("click", () => {
      stopMovement();
      showScreen(button.dataset.screen);
    });
  });

  // Update tank previews when selections change.
  function updateSetupPreviews() {
    const tank1 = $("player1-tank").value;
    const tank2 = $("player2-tank").value;

    $("setup-tank1").className = `tank-preview ${tank1}-preview`;
    $("setup-tank2").className = `tank-preview ${tank2}-preview`;
  }

  $("player1-tank").addEventListener("change", updateSetupPreviews);
  $("player2-tank").addEventListener("change", updateSetupPreviews);

  // Start local match.
  $("start-battle-btn").addEventListener("click", () => {
    const p1 = $("player1-name").value.trim();
    const p2 = $("player2-name").value.trim();

    if (!p1 || !p2) {
      $("setup-error").textContent =
        "Enter nicknames for both players.";
      return;
    }

    if (p1.toLowerCase() === p2.toLowerCase()) {
      $("setup-error").textContent =
        "Choose different nicknames.";
      return;
    }

    $("vs-player1-name").textContent = p1;
    $("vs-player2-name").textContent = p2;

    $("vs-tank1").className =
      `tank-preview ${$("player1-tank").value}-preview`;

    $("vs-tank2").className =
      `tank-preview ${$("player2-tank").value}-preview`;

    $("vs-tank1").textContent = "🚙";
    $("vs-tank2").textContent = "🚙";

    showScreen("vs-screen");
  });

  $("vs-continue-btn").addEventListener("click", () => {
    resetGame();
    showScreen("battle-screen");
  });

  $("rematch-btn").addEventListener("click", () => {
    resetGame();
  });

  // Movement controls support both tapping and holding.
  function bindMovement(buttonId, direction) {
    const button = $(buttonId);

    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      startMovement(direction);
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach(type => {
      button.addEventListener(type, stopMovement);
    });
  }

  bindMovement("move-left-btn", -1);
  bindMovement("move-right-btn", 1);

  $("end-move-btn").addEventListener("click", endMovement);

  // Sound toggle placeholder.
  $("sound-toggle-btn").addEventListener("click", () => {
    game.soundEnabled = !game.soundEnabled;

    $("sound-toggle-btn").textContent =
      game.soundEnabled ? "SOUND: ON" : "SOUND: OFF";
  });

  showScreen("main-menu");
});
