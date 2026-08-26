(function () {
  "use strict";

  var api = null;
  var preview = null;
  var showTimer = 0;
  var hideTimer = 0;
  var activeId = "";
  var anchor = null;

  function clearTimers() {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    showTimer = 0;
    hideTimer = 0;
  }

  function appName(app) {
    if (!app) return "Application";
    return String(app.accessibleName || app.title || "Application");
  }

  function visibleTitle(app) {
    return app && !app.hideName ? String(app.title || "Application") : "Open window";
  }

  function cloneIcon(button) {
    var icon = button && button.querySelector(".dock-app-art");
    return icon ? icon.cloneNode(true) : document.createElement("span");
  }

  function mediaPlaceholder(button) {
    var placeholder = document.createElement("div");
    placeholder.className = "neo-taskbar-preview-media";
    var icon = cloneIcon(button);
    icon.classList.add("neo-taskbar-preview-media-icon");
    placeholder.appendChild(icon);
    var label = document.createElement("span");
    label.textContent = "Window content";
    placeholder.appendChild(label);
    return placeholder;
  }

  function scrubClone(clone, button) {
    clone.removeAttribute("id");
    clone.removeAttribute("inert");
    clone.removeAttribute("aria-hidden");
    [clone].concat(Array.from(clone.querySelectorAll("*"))).forEach(function (node) {
      Array.from(node.attributes).forEach(function (attribute) {
        if (attribute.name.indexOf("data-") === 0 || attribute.name === "name" || attribute.name === "for") node.removeAttribute(attribute.name);
      });
      node.removeAttribute("id");
      node.removeAttribute("role");
      node.removeAttribute("aria-controls");
      node.removeAttribute("aria-describedby");
      node.removeAttribute("aria-labelledby");
    });
    clone.querySelectorAll("[autofocus]").forEach(function (node) { node.removeAttribute("autofocus"); });
    clone.querySelectorAll("script, style, link[rel=stylesheet]").forEach(function (node) { node.remove(); });
    clone.querySelectorAll("iframe, video, audio, canvas, object, embed").forEach(function (node) {
      node.replaceWith(mediaPlaceholder(button));
    });
    clone.querySelectorAll("input, textarea, select, button, a").forEach(function (node) {
      node.tabIndex = -1;
      node.removeAttribute("autoplay");
    });
    clone.setAttribute("inert", "");
    clone.setAttribute("aria-hidden", "true");
  }

  function fallbackPreview(button, app, stateText) {
    var fallback = document.createElement("div");
    fallback.className = "neo-taskbar-preview-fallback";
    var icon = cloneIcon(button);
    icon.classList.add("neo-taskbar-preview-fallback-icon");
    fallback.appendChild(icon);
    var copy = document.createElement("span");
    var strong = document.createElement("strong");
    strong.textContent = visibleTitle(app);
    var small = document.createElement("small");
    small.textContent = stateText;
    copy.append(strong, small);
    fallback.appendChild(copy);
    return fallback;
  }

  function renderWindow(win, button, app) {
    var viewport = preview.querySelector("[data-taskbar-preview-viewport]");
    viewport.textContent = "";
    var minimized = win.classList.contains("is-minimized");
    var stateText = minimized ? "Minimized" : "Running";
    preview.querySelector("[data-taskbar-preview-status]").textContent = stateText;
    preview.querySelector("[data-taskbar-preview-title]").textContent = visibleTitle(app);
    preview.querySelector("[data-taskbar-preview-open]").setAttribute("aria-label", (minimized ? "Restore " : "Switch to ") + appName(app));
    preview.querySelector("[data-taskbar-preview-close]").setAttribute("aria-label", "Close " + appName(app));

    if (win.querySelectorAll("*").length > 900) {
      viewport.appendChild(fallbackPreview(button, app, stateText));
      return;
    }

    var clone = win.cloneNode(true);
    clone.classList.remove("is-minimized", "is-closing", "is-active", "is-dragging", "is-maximized");
    clone.classList.add("neo-taskbar-preview-clone");
    scrubClone(clone, button);
    var width = Math.max(420, win.offsetWidth || parseFloat(win.style.width) || 1000);
    var height = Math.max(300, win.offsetHeight || parseFloat(win.style.height) || 700);
    clone.style.width = width + "px";
    clone.style.height = height + "px";
    viewport.appendChild(clone);
    requestAnimationFrame(function () {
      if (!clone.isConnected) return;
      var scale = Math.min(viewport.clientWidth / width, viewport.clientHeight / height);
      clone.style.transform = "scale(" + scale + ")";
      clone.style.left = Math.round((viewport.clientWidth - width * scale) / 2) + "px";
      clone.style.top = Math.round((viewport.clientHeight - height * scale) / 2) + "px";
    });
  }

  function positionPreview(button) {
    if (!preview || preview.hidden || !button || !button.isConnected) return;
    var rect = button.getBoundingClientRect();
    var width = preview.offsetWidth;
    var left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - width - 10));
    preview.style.left = Math.round(left) + "px";
    preview.style.bottom = Math.round(window.innerHeight - rect.top + 10) + "px";
  }

  function hideNow() {
    clearTimers();
    activeId = "";
    anchor = null;
    if (!preview) return;
    preview.classList.remove("is-open");
    window.setTimeout(function () {
      if (!activeId && preview) {
        preview.hidden = true;
        preview.querySelector("[data-taskbar-preview-viewport]").textContent = "";
      }
    }, 120);
  }

  function queueHide(delay) {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hideNow, delay == null ? 150 : delay);
  }

  function show(button) {
    if (!api || !button || !button.isConnected) return;
    var id = button.dataset.app;
    var win = api.windows.get(id);
    if (!win) {
      hideNow();
      return;
    }
    clearTimers();
    activeId = id;
    anchor = button;
    renderWindow(win, button, api.apps[id]);
    preview.hidden = false;
    positionPreview(button);
    requestAnimationFrame(function () {
      if (activeId === id) preview.classList.add("is-open");
    });
  }

  function queueShow(button, delay) {
    if (!button.classList.contains("is-running")) {
      queueHide(80);
      return;
    }
    window.clearTimeout(hideTimer);
    if (activeId === button.dataset.app && !preview.hidden) {
      anchor = button;
      positionPreview(button);
      return;
    }
    window.clearTimeout(showTimer);
    showTimer = window.setTimeout(function () { show(button); }, delay == null ? 220 : delay);
  }

  function createPreview() {
    var node = document.createElement("section");
    node.className = "neo-taskbar-preview";
    node.hidden = true;
    node.setAttribute("aria-label", "Window preview");
    node.innerHTML =
      '<header class="neo-taskbar-preview-titlebar">' +
        '<span><strong data-taskbar-preview-title></strong><small data-taskbar-preview-status></small></span>' +
        '<button type="button" data-taskbar-preview-close><svg class="icon" aria-hidden="true"><use href="#i-close"></use></svg></button>' +
      '</header>' +
      '<button class="neo-taskbar-preview-open" type="button" data-taskbar-preview-open>' +
        '<span class="neo-taskbar-preview-viewport" data-taskbar-preview-viewport></span>' +
      '</button>';
    document.body.appendChild(node);
    node.addEventListener("pointerenter", function () { window.clearTimeout(hideTimer); });
    node.addEventListener("pointerleave", function () { queueHide(120); });
    node.querySelector("[data-taskbar-preview-open]").addEventListener("click", function () {
      var id = activeId;
      hideNow();
      if (id) api.open(id);
    });
    node.querySelector("[data-taskbar-preview-close]").addEventListener("click", function (event) {
      event.stopPropagation();
      var win = api.windows.get(activeId);
      hideNow();
      if (win) api.close(win);
    });
    return node;
  }

  function bindDock() {
    api.dock.addEventListener("pointerover", function (event) {
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      var button = event.target.closest(".dock-button[data-app]");
      if (!button || !api.dock.contains(button) || (event.relatedTarget && button.contains(event.relatedTarget))) return;
      queueShow(button);
    });
    api.dock.addEventListener("pointerout", function (event) {
      var button = event.target.closest(".dock-button[data-app]");
      if (!button || !api.dock.contains(button)) return;
      if (event.relatedTarget && (button.contains(event.relatedTarget) || preview.contains(event.relatedTarget))) return;
      queueHide();
    });
    api.dock.addEventListener("focusin", function (event) {
      var button = event.target.closest(".dock-button[data-app]");
      if (button) queueShow(button, 0);
    });
    api.dock.addEventListener("focusout", function (event) {
      if (event.relatedTarget && (api.dock.contains(event.relatedTarget) || preview.contains(event.relatedTarget))) return;
      queueHide(80);
    });
    new MutationObserver(function () {
      if (!activeId) return;
      var next = Array.from(api.dock.querySelectorAll(".dock-button[data-app]")).find(function (button) { return button.dataset.app === activeId; });
      if (!next || !api.windows.has(activeId)) hideNow();
      else {
        anchor = next;
        renderWindow(api.windows.get(activeId), next, api.apps[activeId]);
        positionPreview(next);
      }
    }).observe(api.dock, { childList: true });
  }

  function start(dock, windows, apps, open, close) {
    if (!dock || !windows || preview) return;
    api = { dock: dock, windows: windows, apps: apps, open: open, close: close };
    preview = createPreview();
    bindDock();
    window.addEventListener("resize", function () { if (anchor) positionPreview(anchor); }, { passive: true });
    window.addEventListener("blur", hideNow);
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && activeId) hideNow(); });
    document.addEventListener("pointerdown", function (event) {
      if (activeId && !preview.contains(event.target) && !event.target.closest(".dock-button[data-app]")) hideNow();
    }, { passive: true });
  }

  window.NEO_TASKBAR_PREVIEW = { start: start };
})();
