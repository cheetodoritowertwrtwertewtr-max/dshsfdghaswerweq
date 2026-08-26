(function () {
  "use strict";

  var layer = document.getElementById("window-layer");
  if (!layer) return;

  var directions = ["n", "e", "s", "w", "ne", "nw", "se", "sw"];
  var active = null;
  var tabFullscreenWindow = null;

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function smallScreen() {
    return window.matchMedia("(max-width: 720px)").matches;
  }

  function limits(win) {
    var style = getComputedStyle(win);
    return {
      width: Math.max(280, parseFloat(style.minWidth) || 320),
      height: Math.max(220, parseFloat(style.minHeight) || 280)
    };
  }

  function updateAccessibleSize(handle, win) {
    handle.setAttribute("aria-valuetext", Math.round(win.offsetWidth) + " by " + Math.round(win.offsetHeight) + " pixels");
  }

  function syncFullscreenButton(win, active) {
    if (!win) return;
    var button = win.querySelector('[data-window-action="fullscreen"]');
    if (!button) return;
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.setAttribute("aria-label", active ? "Exit app fullscreen" : "Enter app fullscreen");
    button.title = active ? "Exit fullscreen (Esc)" : "Fullscreen (Ctrl+B)";
  }

  function attach(win) {
    if (!win || win.dataset.resizeReady === "true") return;
    win.dataset.resizeReady = "true";
    win.setAttribute("aria-keyshortcuts", "Control+B");
    directions.forEach(function (direction) {
      var handle = document.createElement("span");
      handle.className = "window-resize-handle";
      handle.dataset.windowResize = direction;
      if (direction === "se") {
        handle.tabIndex = 0;
        handle.setAttribute("role", "separator");
        handle.setAttribute("aria-label", "Resize window");
        updateAccessibleSize(handle, win);
      } else {
        handle.setAttribute("aria-hidden", "true");
      }
      win.appendChild(handle);
    });
  }

  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches(".neo-window")) attach(node);
    node.querySelectorAll(".neo-window").forEach(attach);
  }

  function beginResize(event) {
    var handle = event.target.closest("[data-window-resize]");
    if (!handle || event.button !== 0 || smallScreen()) return;
    var win = handle.closest(".neo-window");
    if (!win || win.classList.contains("is-maximized") || win.classList.contains("is-tab-fullscreen")) return;
    var rect = win.getBoundingClientRect();
    active = {
      handle: handle,
      win: win,
      direction: handle.dataset.windowResize,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      rect: rect,
      bounds: layer.getBoundingClientRect(),
      minimum: limits(win)
    };
    handle.setPointerCapture(event.pointerId);
    win.classList.add("is-resizing");
    document.documentElement.classList.add("is-resizing-window");
    event.preventDefault();
  }

  function moveResize(event) {
    if (!active || event.pointerId !== active.pointerId) return;
    var direction = active.direction;
    var start = active.rect;
    var bounds = active.bounds;
    var minimum = active.minimum;
    var dx = event.clientX - active.x;
    var dy = event.clientY - active.y;
    var left = start.left;
    var top = start.top;
    var width = start.width;
    var height = start.height;

    if (direction.includes("e")) width = clamp(start.width + dx, minimum.width, bounds.right - start.left);
    if (direction.includes("s")) height = clamp(start.height + dy, minimum.height, bounds.bottom - start.top);
    if (direction.includes("w")) {
      left = clamp(start.left + dx, bounds.left, start.right - minimum.width);
      width = start.right - left;
    }
    if (direction.includes("n")) {
      top = clamp(start.top + dy, bounds.top, start.bottom - minimum.height);
      height = start.bottom - top;
    }

    active.win.style.left = Math.round(left - bounds.left) + "px";
    active.win.style.top = Math.round(top - bounds.top) + "px";
    active.win.style.width = Math.round(width) + "px";
    active.win.style.height = Math.round(height) + "px";
    updateAccessibleSize(active.handle, active.win);
  }

  function endResize(event) {
    if (!active || (event.pointerId != null && event.pointerId !== active.pointerId)) return;
    if (active.handle.hasPointerCapture(active.pointerId)) active.handle.releasePointerCapture(active.pointerId);
    active.win.classList.remove("is-resizing");
    active.win.dispatchEvent(new CustomEvent("neo-window-resized"));
    document.documentElement.classList.remove("is-resizing-window");
    active = null;
  }

  function keyboardResize(event) {
    var handle = event.target.closest('[data-window-resize="se"]');
    if (!handle || smallScreen()) return;
    var win = handle.closest(".neo-window");
    if (!win || win.classList.contains("is-maximized") || win.classList.contains("is-tab-fullscreen")) return;
    var horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
    var vertical = event.key === "ArrowUp" || event.key === "ArrowDown";
    if (!horizontal && !vertical) return;
    var step = event.shiftKey ? 24 : 8;
    var rect = win.getBoundingClientRect();
    var bounds = layer.getBoundingClientRect();
    var minimum = limits(win);
    var width = rect.width + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0);
    var height = rect.height + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0);
    win.style.width = Math.round(clamp(width, minimum.width, bounds.right - rect.left)) + "px";
    win.style.height = Math.round(clamp(height, minimum.height, bounds.bottom - rect.top)) + "px";
    updateAccessibleSize(handle, win);
    win.dispatchEvent(new CustomEvent("neo-window-resized"));
    event.preventDefault();
  }

  function leaveTabFullscreen(returnFocus) {
    if (!tabFullscreenWindow) return false;
    var win = tabFullscreenWindow;
    tabFullscreenWindow = null;
    win.classList.remove("is-tab-fullscreen");
    syncFullscreenButton(win, false);
    document.documentElement.classList.remove("has-tab-fullscreen");
    document.documentElement.removeAttribute("data-tab-fullscreen");
    if (returnFocus && win.isConnected && !win.classList.contains("is-minimized")) {
      win.focus({ preventScroll: true });
    }
    return true;
  }

  function enterTabFullscreen(win) {
    if (!win) return false;
    if (tabFullscreenWindow && tabFullscreenWindow !== win) leaveTabFullscreen(false);
    tabFullscreenWindow = win;
    win.classList.add("is-tab-fullscreen");
    syncFullscreenButton(win, true);
    document.documentElement.classList.add("has-tab-fullscreen");
    document.documentElement.dataset.tabFullscreen = win.dataset.appId || "app";
    win.focus({ preventScroll: true });
    return true;
  }

  function activeWindow() {
    return layer.querySelector(".neo-window.is-open.is-active:not(.is-minimized)");
  }

  function handleTabFullscreenShortcut(event) {
    var isShortcut = event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.code === "KeyB";
    if (isShortcut) {
      var win = tabFullscreenWindow || activeWindow();
      if (!win) return;
      event.preventDefault();
      if (event.repeat) return;
      if (tabFullscreenWindow) leaveTabFullscreen(true);
      else enterTabFullscreen(win);
      return;
    }
    if (event.key === "Escape" && tabFullscreenWindow) {
      event.preventDefault();
      leaveTabFullscreen(true);
    }
  }

  function handleFullscreenButton(event) {
    var button = event.target.closest('[data-window-action="fullscreen"]');
    if (!button) return;
    var win = button.closest(".neo-window");
    if (!win) return;
    event.preventDefault();
    if (tabFullscreenWindow === win) leaveTabFullscreen(true);
    else enterTabFullscreen(win);
  }

  function syncTabFullscreen() {
    if (!tabFullscreenWindow) return;
    if (!tabFullscreenWindow.isConnected || !tabFullscreenWindow.classList.contains("is-open") || tabFullscreenWindow.classList.contains("is-minimized")) {
      leaveTabFullscreen(false);
    }
  }

  document.addEventListener("pointerdown", beginResize);
  document.addEventListener("pointermove", moveResize);
  document.addEventListener("pointerup", endResize);
  document.addEventListener("pointercancel", endResize);
  document.addEventListener("keydown", keyboardResize);
  document.addEventListener("keydown", handleTabFullscreenShortcut, true);
  document.addEventListener("click", handleFullscreenButton);

  scan(layer);
  new MutationObserver(function (records) {
    records.forEach(function (record) { record.addedNodes.forEach(scan); });
    syncTabFullscreen();
  }).observe(layer, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
})();
