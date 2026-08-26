(function () {
  "use strict";

  var STORAGE_KEY = "neo_os_rainmeter_v1";
  var clock = document.getElementById("rainmeter-clock");
  if (!clock) return;

  var defaults = {
    color: "#f7f7f7",
    scale: 150,
    opacity: 100,
    position: "middle-center",
    shadow: true
  };
  var positions = [
    "top-left", "top-center", "top-right",
    "middle-left", "middle-center", "middle-right",
    "bottom-left", "bottom-center", "bottom-right"
  ];
  var presetColors = ["#f7f7f7", "#d9dee5", "#9ed6ff", "#ffd38a", "#ffb8c7"];
  var saveTimer = 0;
  var returnFocus = null;
  var lastAnchor = { x: window.innerWidth / 2, y: 80 };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || min));
  }

  function readState() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return normalize(parsed);
    } catch (error) {
      return Object.assign({}, defaults);
    }
  }

  function normalize(value) {
    var next = Object.assign({}, defaults, value && typeof value === "object" ? value : {});
    if (!/^#[0-9a-f]{6}$/i.test(next.color)) next.color = defaults.color;
    next.color = next.color.toLowerCase();
    next.scale = clamp(next.scale, 70, 250);
    next.opacity = clamp(next.opacity, 35, 100);
    if (positions.indexOf(next.position) === -1) next.position = defaults.position;
    next.shadow = next.shadow !== false;
    return next;
  }

  var state = readState();
  var panel = document.createElement("section");
  panel.id = "rainmeter-editor";
  panel.className = "rainmeter-editor";
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "rainmeter-editor-title");
  panel.innerHTML = [
    '<header class="rainmeter-editor-header">',
    '  <span class="rainmeter-editor-mark" aria-hidden="true">R</span>',
    '  <span class="rainmeter-editor-heading"><strong id="rainmeter-editor-title">Rainmeter</strong><small>Clock appearance</small></span>',
    '  <button class="rainmeter-editor-close" type="button" data-rainmeter-close aria-label="Close Rainmeter settings"><svg class="icon" aria-hidden="true"><use href="#i-close"></use></svg></button>',
    '</header>',
    '<div class="rainmeter-editor-section">',
    '  <div class="rainmeter-control-heading"><strong>Text color</strong><output data-rainmeter-color-value></output></div>',
    '  <div class="rainmeter-colors" role="group" aria-label="Text color presets">',
    presetColors.map(function (color, index) { return '<button class="rainmeter-color" type="button" data-rainmeter-color="' + color + '" style="--swatch:' + color + '" aria-label="Color preset ' + (index + 1) + '" aria-pressed="false"></button>'; }).join(""),
    '    <label class="rainmeter-custom-color" aria-label="Choose a custom text color"><input type="color" data-rainmeter-custom-color value="#f7f7f7" /></label>',
    '  </div>',
    '</div>',
    '<div class="rainmeter-editor-section">',
    '  <div class="rainmeter-control-heading"><label for="rainmeter-size">Size</label><output data-rainmeter-size-value>150%</output></div>',
    '  <input class="rainmeter-range" id="rainmeter-size" data-rainmeter-size type="range" min="70" max="250" step="5" value="150" />',
    '</div>',
    '<div class="rainmeter-editor-section">',
    '  <div class="rainmeter-control-heading"><label for="rainmeter-opacity">Opacity</label><output data-rainmeter-opacity-value>100%</output></div>',
    '  <input class="rainmeter-range" id="rainmeter-opacity" data-rainmeter-opacity type="range" min="35" max="100" step="5" value="100" />',
    '</div>',
    '<div class="rainmeter-editor-section">',
    '  <div class="rainmeter-control-heading"><strong>Position</strong><output data-rainmeter-position-value>Middle Center</output></div>',
    '  <div class="rainmeter-position-grid" role="group" aria-label="Clock position">',
    positions.map(function (position) { return '<button class="rainmeter-position" type="button" data-rainmeter-position="' + position + '" aria-label="' + labelFor(position) + '" aria-pressed="false"><span aria-hidden="true"></span></button>'; }).join(""),
    '  </div>',
    '</div>',
    '<div class="rainmeter-editor-section">',
    '  <label class="rainmeter-switch-row"><span class="rainmeter-switch-copy"><strong>Soft shadow</strong><small>Improves contrast over bright wallpaper</small></span><input class="sr-only" type="checkbox" data-rainmeter-shadow checked /><span class="rainmeter-switch" aria-hidden="true"></span></label>',
    '</div>',
    '<footer class="rainmeter-editor-footer"><button type="button" data-rainmeter-reset>Reset</button><button class="rainmeter-done" type="button" data-rainmeter-close>Done</button></footer>'
  ].join("");
  document.body.appendChild(panel);

  var sizeInput = panel.querySelector("[data-rainmeter-size]");
  var opacityInput = panel.querySelector("[data-rainmeter-opacity]");
  var customColor = panel.querySelector("[data-rainmeter-custom-color]");
  var shadowInput = panel.querySelector("[data-rainmeter-shadow]");

  function labelFor(value) {
    return value.split("-").map(function (word) { return word.charAt(0).toUpperCase() + word.slice(1); }).join(" ");
  }

  function applyState() {
    clock.dataset.rainmeterReady = "true";
    clock.dataset.rainmeterPosition = state.position;
    clock.style.setProperty("--rainmeter-color", state.color);
    clock.style.setProperty("--rainmeter-scale", String(state.scale / 100));
    clock.style.setProperty("--rainmeter-opacity", String(state.opacity / 100));
    clock.style.setProperty("--rainmeter-text-shadow", state.shadow ? "0 2px 14px rgba(0, 0, 0, .58)" : "none");
  }

  function saveState() {
    window.clearTimeout(saveTimer);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) {}
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveState, 120);
  }

  function syncPanel() {
    sizeInput.value = String(state.scale);
    opacityInput.value = String(state.opacity);
    customColor.value = state.color;
    shadowInput.checked = state.shadow;
    panel.querySelector("[data-rainmeter-size-value]").textContent = state.scale + "%";
    panel.querySelector("[data-rainmeter-opacity-value]").textContent = state.opacity + "%";
    panel.querySelector("[data-rainmeter-color-value]").textContent = state.color.toUpperCase();
    panel.querySelector("[data-rainmeter-position-value]").textContent = labelFor(state.position);
    panel.querySelectorAll("[data-rainmeter-color]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.dataset.rainmeterColor === state.color ? "true" : "false");
    });
    panel.querySelectorAll("[data-rainmeter-position]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.dataset.rainmeterPosition === state.position ? "true" : "false");
    });
  }

  function placePanel(x, y) {
    lastAnchor = { x: x, y: y };
    panel.style.left = "8px";
    panel.style.top = "8px";
    var rect = panel.getBoundingClientRect();
    var clockRect = clock.getBoundingClientRect();
    var left = Math.max(8, Math.min(x + 8, window.innerWidth - rect.width - 8));
    var top = y + 8;
    var fitsRight = clockRect.right + rect.width + 10 < window.innerWidth - 8;
    var fitsLeft = clockRect.left - rect.width - 10 > 8;
    if (fitsRight || fitsLeft) {
      left = fitsRight && (x >= clockRect.left + clockRect.width / 2 || !fitsLeft) ? clockRect.right + 10 : clockRect.left - rect.width - 10;
      top = clockRect.top;
    } else if (clockRect.bottom + rect.height + 12 < window.innerHeight - 58) top = clockRect.bottom + 10;
    else if (clockRect.top - rect.height - 10 > 8) top = clockRect.top - rect.height - 10;
    top = Math.max(8, Math.min(top, window.innerHeight - rect.height - 8));
    panel.style.left = left + "px";
    panel.style.top = top + "px";
  }

  function openPanel(x, y) {
    var desktopMenu = document.getElementById("desktop-context-menu");
    var taskbarMenu = document.getElementById("neo-taskbar-menu");
    if (desktopMenu) desktopMenu.hidden = true;
    if (taskbarMenu) taskbarMenu.hidden = true;
    returnFocus = document.activeElement;
    syncPanel();
    panel.hidden = false;
    clock.setAttribute("aria-expanded", "true");
    requestAnimationFrame(function () {
      placePanel(x, y);
      panel.focus({ preventScroll: true });
    });
  }

  function closePanel(restore) {
    if (panel.hidden) return;
    panel.hidden = true;
    clock.setAttribute("aria-expanded", "false");
    saveState();
    if (restore && returnFocus && typeof returnFocus.focus === "function") returnFocus.focus({ preventScroll: true });
  }

  clock.tabIndex = 0;
  clock.setAttribute("aria-haspopup", "dialog");
  clock.setAttribute("aria-expanded", "false");
  clock.title = "Right-click to customize Rainmeter";
  applyState();

  document.addEventListener("contextmenu", function (event) {
    if (!clock.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    openPanel(event.clientX, event.clientY);
  }, true);

  clock.addEventListener("keydown", function (event) {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault();
    var rect = clock.getBoundingClientRect();
    openPanel(rect.left + Math.min(rect.width, 220), rect.top + 28);
  });
  clock.addEventListener("transitionend", function (event) {
    if (!panel.hidden && /^(transform|top|right|bottom|left)$/.test(event.propertyName)) placePanel(lastAnchor.x, lastAnchor.y);
  });

  panel.addEventListener("contextmenu", function (event) { event.preventDefault(); });
  panel.addEventListener("click", function (event) {
    var color = event.target.closest("[data-rainmeter-color]");
    var position = event.target.closest("[data-rainmeter-position]");
    if (color) state.color = color.dataset.rainmeterColor;
    if (position) state.position = position.dataset.rainmeterPosition;
    if (event.target.closest("[data-rainmeter-reset]")) {
      state = Object.assign({}, defaults);
      if (window.NEO_SHELL) window.NEO_SHELL.notify("Rainmeter reset", "Clock settings returned to default.", "refresh");
    }
    if (color || position || event.target.closest("[data-rainmeter-reset]")) {
      applyState();
      syncPanel();
      saveState();
      if (position || event.target.closest("[data-rainmeter-reset]")) requestAnimationFrame(function () { placePanel(lastAnchor.x, lastAnchor.y); });
    }
    if (event.target.closest("[data-rainmeter-close]")) closePanel(true);
  });

  sizeInput.addEventListener("input", function () {
    state.scale = clamp(sizeInput.value, 70, 250);
    applyState();
    syncPanel();
    scheduleSave();
  });
  opacityInput.addEventListener("input", function () {
    state.opacity = clamp(opacityInput.value, 35, 100);
    applyState();
    syncPanel();
    scheduleSave();
  });
  customColor.addEventListener("input", function () {
    state.color = customColor.value.toLowerCase();
    applyState();
    syncPanel();
    scheduleSave();
  });
  shadowInput.addEventListener("change", function () {
    state.shadow = shadowInput.checked;
    applyState();
    saveState();
  });

  document.addEventListener("pointerdown", function (event) {
    if (!panel.hidden && !panel.contains(event.target) && !clock.contains(event.target)) closePanel(false);
  }, true);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      closePanel(true);
    }
  });
  window.addEventListener("resize", function () {
    if (!panel.hidden) placePanel(lastAnchor.x, lastAnchor.y);
  }, { passive: true });
})();
