// ---------- INSTALL PROMPT (Add to Home Screen) ----------
let deferredInstallPrompt = null;
const installBtn = document.getElementById("installBtn");
const installSection = document.getElementById("installSection");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (installBtn) installBtn.classList.remove("hidden");
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.classList.add("hidden");
  });
}

window.addEventListener("appinstalled", () => {
  if (installBtn) installBtn.classList.add("hidden");
});

// Hide the whole install section if already running as an installed app
if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
  if (installSection) installSection.classList.add("hidden");
}

// ---------- REGISTER SERVICE WORKER ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Silent fail — app still works fine without offline support.
    });
  });
}
