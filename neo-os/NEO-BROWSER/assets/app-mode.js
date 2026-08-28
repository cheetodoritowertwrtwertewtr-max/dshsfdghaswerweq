(() => {
  "use strict";

  const setMuted = (muted) => {
    document.querySelectorAll("audio, video").forEach((media) => {
      media.muted = muted;
    });
    const frame = document.getElementById("frame");
    if (!frame || !frame.contentWindow) return;
    try {
      frame.contentWindow.postMessage({ type: "neo-shell:set-muted", muted }, "*");
    } catch {}
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    if (!event.data || event.data.type !== "neo-shell:set-muted") return;
    setMuted(Boolean(event.data.muted));
  });

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
