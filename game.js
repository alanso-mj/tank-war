// =====================================
// TANK WAR V2 — MENU NAVIGATION
// =====================================

const screens = document.querySelectorAll(".screen");

function showScreen(screenId) {
  screens.forEach((screen) => {
    screen.classList.remove("active");
  });

  const target = document.getElementById(screenId);

  if (target) {
    target.classList.add("active");
  }
}

// =====================================
// MAIN MENU BUTTONS
// =====================================

document.getElementById("play-btn").addEventListener("click", () => {
  showScreen("mode-screen");
});

document.getElementById("settings-btn").addEventListener("click", () => {
  showScreen("settings-screen");
});

document.getElementById("how-btn").addEventListener("click", () => {
  showScreen("how-screen");
});

// =====================================
// GAME MODE BUTTONS
// =====================================

document.getElementById("local-btn").addEventListener("click", () => {
  alert("Local Match setup will be added in the next development stage!");
});

document.getElementById("online-btn").addEventListener("click", () => {
  showScreen("online-screen");
});

// =====================================
// BACK BUTTONS
// =====================================

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => {
    showScreen(button.dataset.back);
  });
});

// =====================================
// SOUND SETTINGS
// =====================================

let soundEnabled = true;

const soundButton = document.getElementById("sound-btn");

soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;

  soundButton.textContent = soundEnabled
    ? "SOUND: ON"
    : "SOUND: OFF";
});

console.log("TANK WAR V2 loaded successfully!");
