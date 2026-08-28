(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  if (params.get("neo-app-mode") !== "1") return;

  let target;
  try {
    target = new URL(params.get("neo-app-target") || "");
  } catch {
    return;
  }
  if (!/^https?:$/.test(target.protocol)) return;

  const navigate = () => {
    const address = document.getElementById("url");
    const go = document.getElementById("go");
    if (!address || !go) return false;
    address.value = target.href;
    address.dispatchEvent(new Event("input", { bubbles: true }));
    go.click();
    return true;
  };

  const start = () => {
    if (navigate()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (navigate() || attempts >= 40) window.clearInterval(timer);
    }, 50);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
