// ========================================
// TANK WAR V2 — NAVIGATION AND LOCAL SETUP
// ========================================

document.addEventListener("DOMContentLoaded", () => {
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

  const $ = id => document.getElementById(id);

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

  // Main menu
  $("play-btn").addEventListener("click", () => {
    showScreen("mode-screen");
  });

  $("settings-btn").addEventListener("click", () => {
    showScreen("settings-screen");
  });

  $("how-to-btn").addEventListener("click", () => {
    showScreen("how-to-screen");
  });

  // Match modes
  $("local-match-btn").addEventListener("click", () => {
    $("setup-error").textContent = "";
    showScreen("local-setup-screen");
  });

  $("online-match-btn").addEventListener("click", () => {
    showScreen("online-screen");
  });

  // Back buttons
  document.querySelectorAll("[data-screen]").forEach(button => {
    button.addEventListener("click", () => {
      showScreen(button.dataset.screen);
    });
  });

  // Local Match setup
  $("start-battle-btn").addEventListener("click", () => {
    const player1 = $("player1-name").value.trim();
    const player2 = $("player2-name").value.trim();

    if (!player1 || !player2) {
      $("setup-error").textContent =
        "Enter nicknames for both players first.";
      return;
    }

    if (player1.toLowerCase() === player2.toLowerCase()) {
      $("setup-error").textContent =
        "Choose different nicknames for each player.";
      return;
    }

    const tank1 = $("player1-tank").value;
    const tank2 = $("player2-tank").value;

    $("vs-player1-name").textContent = player1;
    $("vs-player2-name").textContent = player2;

    $("vs-tank1").className = `tank-preview ${tank1}-preview`;
    $("vs-tank2").className = `tank-preview ${tank2}-preview`;

    $("vs-tank1").textContent = "🚙";
    $("vs-tank2").textContent = "🚙";

    localStorage.setItem("tankwar-player1", player1);
    localStorage.setItem("tankwar-player2", player2);
    localStorage.setItem("tankwar-tank1", tank1);
    localStorage.setItem("tankwar-tank2", tank2);

    $("setup-error").textContent = "";
    showScreen("vs-screen");
  });

  // Start placeholder battle screen
  $("vs-continue-btn").addEventListener("click", () => {
    const player1 = $("player1-name").value.trim();
    const player2 = $("player2-name").value.trim();

    $("battle-player-info").textContent =
      `${player1} vs ${player2}`;

    $("battle-message").textContent =
      "The battlefield is ready. Combat is the next feature to build!";

    showScreen("battle-screen");
  });

  // Sound setting
  let soundEnabled = true;

  $("sound-toggle-btn").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    $("sound-toggle-btn").textContent =
      soundEnabled ? "SOUND: ON" : "SOUND: OFF";
  });

  // Start at main menu
  showScreen("main-menu");

  console.log("Tank War V2 ready!");
});
