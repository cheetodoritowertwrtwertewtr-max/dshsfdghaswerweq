(function () {
  "use strict";

  var cachedWindows = new Map();

  function createShell(app, body, iconMarkup) {
    body.classList.add("music-unified-window-body");
    body.innerHTML =
      '<section class="music-unified-shell" data-unified-music>' +
        '<nav class="music-unified-tabs" role="tablist" aria-label="Music sources">' +
          '<button type="button" role="tab" aria-selected="true" aria-controls="music-listen-panel" data-unified-music-mode="listen">' + iconMarkup("stream") + '<span>Listen</span></button>' +
          '<button type="button" role="tab" aria-selected="false" aria-controls="music-mp3-panel" data-unified-music-mode="mp3">' + iconMarkup("music") + '<span>Audio Player</span></button>' +
        '</nav>' +
        '<div class="music-unified-panel" id="music-listen-panel" role="tabpanel" data-unified-music-panel="listen"></div>' +
        '<div class="music-unified-panel" id="music-mp3-panel" role="tabpanel" data-unified-music-panel="mp3" hidden></div>' +
      '</section>';
    var shell = body.querySelector("[data-unified-music]");
    var listenPanel = shell.querySelector('[data-unified-music-panel="listen"]');
    var direct = app.browserDirect === true && Boolean(app.browserTarget);
    if (direct) mountDirect(app, listenPanel);
    return {
      shell: shell,
      tabs: Array.from(shell.querySelectorAll("[data-unified-music-mode]")),
      listenPanel: listenPanel,
      mp3Panel: shell.querySelector('[data-unified-music-panel="mp3"]'),
      direct: direct
    };
  }

  function mountDirect(app, panel) {
    var target;
    try { target = new URL(app.browserTarget); } catch (error) { target = null; }
    if (!target || target.protocol !== "https:") {
      panel.innerHTML = '<div class="feature-loader is-error" role="alert"><strong>Music is unavailable</strong><p>The listening source is not valid.</p></div>';
      return;
    }

    var session = document.createElement("div");
    session.className = "music-direct-session";
    var loader = document.createElement("div");
    loader.className = "feature-loader music-direct-loader";
    loader.setAttribute("role", "status");
    loader.innerHTML = '<span class="library-spinner" aria-hidden="true"></span><strong>Opening Music</strong><p>Connecting directly to the music library.</p><button class="button" type="button" data-music-direct-retry hidden>Retry</button>';
    var frame = document.createElement("iframe");
    frame.className = "music-direct-frame";
    frame.title = "Music library";
    frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.loading = "eager";
    frame.fetchPriority = "high";
    session.append(frame, loader);
    panel.replaceChildren(session);

    var retry = loader.querySelector("[data-music-direct-retry]");
    var slowTimer = 0;

    function startLoad(isRetry) {
      window.clearTimeout(slowTimer);
      session.classList.remove("is-ready", "is-slow");
      loader.querySelector("strong").textContent = isRetry ? "Reopening Music" : "Opening Music";
      loader.querySelector("p").textContent = "Connecting directly to the music library.";
      retry.hidden = true;
      var destination = new URL(target.href);
      if (isRetry) destination.searchParams.set("neo_retry", String(Date.now()));
      frame.src = destination.href;
      slowTimer = window.setTimeout(function () {
        if (session.classList.contains("is-ready")) return;
        session.classList.add("is-slow");
        loader.querySelector("strong").textContent = "Music is taking longer than expected";
        loader.querySelector("p").textContent = "Check the connection or retry the music session.";
        retry.hidden = false;
      }, 12000);
    }

    frame.addEventListener("load", function () {
      window.clearTimeout(slowTimer);
      session.classList.add("is-ready");
      session.classList.remove("is-slow");
    });
    frame.addEventListener("error", function () {
      window.clearTimeout(slowTimer);
      session.classList.add("is-slow");
      loader.querySelector("strong").textContent = "Music could not connect";
      loader.querySelector("p").textContent = "Retry the direct music session.";
      retry.hidden = false;
    });
    retry.addEventListener("click", function () { startLoad(true); });
    startLoad(false);
  }

  function cacheWindow(win, id, openWindows, app, forceDestroy, renderDock, activateTopWindow) {
    if (!win || !id || forceDestroy === true || !app || !app.keepAlive || app.installed === false) return false;
    if (document.activeElement && win.contains(document.activeElement)) document.activeElement.blur();
    window.clearTimeout(win._neoCloseTimer);
    win.classList.add("is-closing");
    win.classList.remove("is-open", "is-active", "is-minimized");
    win.setAttribute("aria-hidden", "true");
    win.setAttribute("inert", "");
    openWindows.delete(id);
    cachedWindows.set(id, win);
    win._neoCloseTimer = window.setTimeout(function () {
      if (cachedWindows.get(id) !== win) return;
      win.hidden = true;
      win.classList.remove("is-closing");
    }, 180);
    renderDock();
    activateTopWindow();
    return true;
  }

  function restoreWindow(id, openWindows, renderDock, activateWindow) {
    var win = cachedWindows.get(id);
    if (!win) return null;
    window.clearTimeout(win._neoCloseTimer);
    win._neoCloseTimer = 0;
    cachedWindows.delete(id);
    win.hidden = false;
    win.removeAttribute("aria-hidden");
    win.removeAttribute("inert");
    win.classList.remove("is-closing", "is-minimized");
    win.classList.add("is-open");
    openWindows.set(id, win);
    renderDock();
    activateWindow(win);
    window.requestAnimationFrame(function () { win.focus({ preventScroll: true }); });
    return win;
  }

  function dropWindow(id) {
    var win = cachedWindows.get(id);
    if (win) window.clearTimeout(win._neoCloseTimer);
    cachedWindows.delete(id);
  }

  window.NEO_MUSIC_RUNTIME = {
    createShell: createShell,
    mountDirect: mountDirect,
    cacheWindow: cacheWindow,
    restoreWindow: restoreWindow,
    getWindow: function (id, openWindows) { return openWindows.get(id) || cachedWindows.get(id) || null; },
    dropWindow: dropWindow
  };
})();
