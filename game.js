// ========================================
// TANK WAR V2 — GAME.JS
// Screen navigation and button controls
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  const screenIds = [
    "main-menu",
    "mode-screen",
    "settings-screen",
    "how-to-screen",
    "online-screen"
  ];

  let currentScreen = "main-menu";
  let soundEnabled = true;

  // Show a screen and hide the others
  function showScreen(id) {
    const target = document.getElementById(id);

    if (!target) {
      console.error(`Tank War: Screen "${id}" not found.`);
      return;
    }

    screenIds.forEach(screenId => {
      const screen = document.getElementById(screenId);

      if (screen) {
        screen.classList.remove("active");
        screen.style.display = "none";
        screen.setAttribute("aria-hidden", "true");
      }
    });

    target.style.display = "flex";
    target.classList.add("active");
    target.setAttribute("aria-hidden", "false");

    currentScreen = id;
  }

  // Find buttons by their displayed text
  function findButton(label, parent = document) {
    return [...parent.querySelectorAll("button")].find(button =>
      button.textContent.trim().toUpperCase() === label.toUpperCase()
    );
  }

  // Connect a button to a screen
  function connectButton(label, screenId) {
    const button = findButton(label);

    if (button) {
      button.addEventListener("click", () => showScreen(screenId));
    }
  }

  // Main menu navigation
  connectButton("PLAY", "mode-screen");
  connectButton("SETTINGS", "settings-screen");
  connectButton("HOW TO PLAY", "how-to-screen");

  // Mode selection
  const localButton = [...document.querySelectorAll("button")].find(button =>
    button.textContent.toUpperCase().includes("LOCAL MATCH")
  );

  if (localButton) {
    localButton.addEventListener("click", () => {
      alert("Local Match setup is the next feature to build!");
    });
  }

  const onlineButton = [...document.querySelectorAll("button")].find(button =>
    button.textContent.toUpperCase().includes("ONLINE MATCH")
  );

  if (onlineButton) {
    onlineButton.addEventListener("click", () => {
      showScreen("online-screen");
    });
  }

  // Back and main-menu buttons
  document.querySelectorAll("button").forEach(button => {
    const label = button.textContent.trim().toUpperCase();

    if (label === "BACK" || label === "MAIN MENU") {
      button.addEventListener("click", () => {
        showScreen("main-menu");
      });
    }
  });

  // Sound toggle
  const soundButton = [...document.querySelectorAll("button")].find(button =>
    button.textContent.toUpperCase().includes("SOUND")
  );

  if (soundButton) {
    soundButton.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      soundButton.textContent = soundEnabled ? "SOUND: ON" : "SOUND: OFF";
    });
  }

  // Initial screen
  showScreen("main-menu");

  // Helpful debug message
  console.log("Tank War V2 initialized successfully!");
});
