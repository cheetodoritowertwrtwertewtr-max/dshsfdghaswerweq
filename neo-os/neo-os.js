(function () {
  "use strict";

  var SETTINGS_KEY = "neo_os_settings_v1";
  var WIDGET_LAYOUT_KEY = "neo_os_widget_layout_v1";
  var RECENT_APPS_KEY = "neo_os_recent_apps_v1";
  var WINDOW_STATE_KEY = "neo_os_window_states_v2";
  var DEFAULT_WINDOW_WIDTH = 1180;
  var DEFAULT_WINDOW_HEIGHT = 760;
  var PINNED_APPS_KEY = "neo_os_pinned_apps_v1";
  var INSTALLED_APPS_KEY = "neo_os_installed_apps_v1";
  var BOOT_SESSION_KEY = "neo_os_booted_session";
  var GUEST_SESSION_KEY = "neo_os_guest_session_v1";
  var MUSIC_MODE_KEY = "neo_os_music_mode_v1";
  var WALLPAPER_DB = "neo_os_wallpapers";
  var WALLPAPER_STORE = "assets";
  var NEO_CHAT_POLL_MS = 4500;
  var NEO_CHAT_SLOW_MODE_MS = 5000;
  var root = document.documentElement;
  var windowLayer = document.getElementById("window-layer");
  var launcher = document.getElementById("app-launcher");
  var launcherDismissLayer = document.getElementById("launcher-dismiss-layer");
  var launcherScroll = document.querySelector(".launcher-scroll-region");
  var launcherGrid = document.getElementById("launcher-grid");
  var launcherSearch = document.getElementById("launcher-search");
  var launcherRecent = document.getElementById("launcher-recent");
  var launcherRecentEmpty = document.getElementById("launcher-recent-empty");
  var launcherCategories = document.getElementById("launcher-categories");
  var launcherResults = document.querySelector("[data-launcher-results]");
  var launcherResultList = document.getElementById("launcher-result-list");
  var launcherResultCount = document.getElementById("launcher-result-count");
  var launcherSearchEmpty = document.getElementById("launcher-search-empty");
  var toastRegion = document.getElementById("toast-region");
  var widgetLayer = document.getElementById("widget-layer");
  var activeAppLabel = document.getElementById("active-app-label");
  var nowPlayingWidget = document.querySelector("[data-widget='now-playing']");
  var nowPlayingState = null;
  var nowPlayingLevelTimer = 0;
  var mediaPrioritySources = new Set();
  var connectionState = document.getElementById("connection-state");
  var openWindows = new Map();
  var musicRuntime = window.NEO_MUSIC_RUNTIME;
  var zIndex = 100;
  var windowSequence = 0;
  var catalogPromise = null;
  var catalog = null;
  var coverManifestPromise = null;
  var coverManifest = Object.create(null);
  var coverManifestLoaded = false;
  var customWallpaperUrl = "";
  var wallpaperEngine = window.NEOWallpaperEngine || null;
  var weatherFrame = 0;
  var weatherResizeObserver = null;
  var launcherReturnFocus = null;
  var launcherShowAll = false;
  var launcherSelectedIndex = 0;
  var ctrlTapCandidate = false;
  var searchTimer = 0;
  var featureRuntimePromise = null;
  var filesRuntimePromise = null;
  var onlineWallpaperRuntimePromise = null;
  var browseRuntimePromise = null;
  var onlineWallpaperRequestSerial = 0;
  var shellApi = null;

  var defaultSettings = {
    designVersion: 13,
    wallpaper: "we-steam-1403160205",
    wallpaperFavorites: [],
    wallpaperRecent: [],
    wallpaperFit: "cover",
    wallpaperMuted: true,
    wallpaperVolume: 60,
    wallpaperSpeed: 1,
    wallpaperLoop: true,
    wallpaperPaused: false,
    brightness: 100,
    saturation: 100,
    blur: 0,
    motion: true,
    weather: true,
    batterySaver: false,
    widgets: true,
    widgetLock: true,
    dockMagnify: true,
    taskbarMaterial: "clear",
    taskbarOpacity: 0,
    taskbarTint: "#000000",
    taskbarAccent: "#ffffff",
    taskbarBlur: 0,
    reduceMotion: false,
    performance: "auto"
  };

  var savedSettings = readJson(SETTINGS_KEY, {});
  var savedDesignVersion = Number(savedSettings.designVersion) || 0;
  if (!Array.isArray(savedSettings.wallpaperFavorites)) savedSettings.wallpaperFavorites = [];
  if (!Array.isArray(savedSettings.wallpaperRecent)) savedSettings.wallpaperRecent = [];
  if (savedDesignVersion < 8) {
    savedSettings.taskbarMaterial = "clear";
    savedSettings.taskbarOpacity = 0;
    savedSettings.taskbarBlur = 0;
  }
  if (savedDesignVersion < 9) savedSettings.wallpaperSpeed = 1;
  if (savedDesignVersion < 10) {
    savedSettings.taskbarTint = "#000000";
    savedSettings.taskbarAccent = "#ffffff";
  }
  if (savedDesignVersion < 11) {
    if (Number(savedSettings.brightness) === 92) savedSettings.brightness = 100;
    if (Number(savedSettings.saturation) === 82) savedSettings.saturation = 100;
  }
  if (savedDesignVersion < 12 && (!savedSettings.wallpaper || savedSettings.wallpaper === "neo")) {
    savedSettings.wallpaper = "we-steam-1403160205";
  }
  if (savedDesignVersion < 13 && savedSettings.wallpaper === "we-steam-3192588052") {
    savedSettings.wallpaper = "we-steam-1403160205";
  }
  savedSettings.designVersion = 13;
  var settings = Object.assign({}, defaultSettings, savedSettings);
  settings.wallpaperMuted = true;
  settings.wallpaperPaused = false;
  var widgetLayout = readJson(WIDGET_LAYOUT_KEY, {});
  var windowStates = readJson(WINDOW_STATE_KEY, {});
  if (!windowStates || typeof windowStates !== "object" || Array.isArray(windowStates)) windowStates = {};

  var apps = {
    browser: {
      id: "browser",
      title: "Browse",
      hideName: true,
      accessibleName: "Web app",
      subtitle: "Private DuckDuckGo search",
      icon: "duckduckgo",
      route: "./NEO-BROWSER/index.html",
      keepAlive: true,
      width: 1080,
      height: 720,
      launcher: true,
      pinned: true,
      core: true,
      category: "Web",
      aliases: ["duckduckgo", "browse", "internet"]
    },
    files: {
      id: "files",
      title: "Drive",
      subtitle: "My Drive",
      icon: "google-drive",
      lazy: true,
      runtime: "files",
      width: 1080,
      height: 720,
      launcher: true,
      pinned: true,
      core: true,
      category: "System",
      aliases: ["file explorer", "file manager", "downloads", "documents", "drive", "storage"]
    },
    zones: {
      id: "zones",
      title: "HTML Games",
      subtitle: "Your complete HTML game catalog",
      icon: "html-games",
      template: "library-template",
      width: 1180,
      height: 760,
      launcher: true,
      pinned: true,
      core: true,
      category: "Games",
      aliases: ["html games", "games", "play", "arcade", "catalog", "zones"]
    },
    chat: {
      id: "chat",
      title: "Messages",
      subtitle: "Conversations and rooms",
      icon: "chat",
      template: "messages-template",
      width: 1180,
      height: 760,
      launcher: true,
      pinned: true,
      core: true,
      category: "Social",
      aliases: ["messages", "rooms", "dm"]
    },
    music: {
      id: "music",
      title: "Audio Player",
      subtitle: "Your local MP3 library",
      icon: "music",
      lazy: true,
      width: 1120,
      height: 720,
      launcher: false,
      pinned: false,
      category: "Media",
      aliases: ["mp3", "songs", "audio", "player", "playlists"]
    },
    media: {
      id: "media",
      title: "Media Player",
      subtitle: "Local video and picture-in-picture",
      icon: "media-player",
      lazy: true,
      width: 1100,
      height: 720,
      launcher: true,
      pinned: true,
      category: "Media",
      aliases: ["media player", "video", "movies", "watch", "picture in picture"]
    },
    report: {
      id: "report",
      title: "Support",
      subtitle: "Report a problem",
      icon: "info",
      route: "/report-a-bug",
      width: 940,
      height: 680,
      launcher: false,
      pinned: false,
      category: "System",
      aliases: ["help", "bug", "feedback"]
    },
    wallpaper: {
      id: "wallpaper",
      title: "Wallpaper Engine",
      subtitle: "Installed wallpaper library",
      icon: "wallpaper",
      template: "wallpaper-template",
      width: 1180,
      height: 760,
      launcher: true,
      pinned: true,
      category: "Personalization",
      aliases: ["background", "wallpaper", "theme", "animated wallpaper", "wallpaper engine"]
    },
    control: {
      id: "control",
      title: "Taskbar Settings",
      subtitle: "Taskbar appearance",
      icon: "settings",
      template: "control-template",
      width: 780,
      height: 560,
      launcher: true,
      pinned: true,
      core: true,
      category: "System",
      aliases: ["settings", "preferences", "taskbar"]
    },
    terminal: {
      id: "terminal",
      title: "Terminal",
      subtitle: "NEO command line",
      icon: "terminal",
      lazy: true,
      width: 760,
      height: 480,
      launcher: true,
      pinned: false,
      core: true,
      category: "System",
      aliases: ["console", "shell", "command line"]
    },
    calendar: {
      id: "calendar",
      title: "Date & Time",
      subtitle: "Local time",
      icon: "monitor",
      template: "calendar-template",
      width: 520,
      height: 460,
      launcher: false
    }
  };
  Object.assign(apps, window.NEO_EXTRA_APPS || {});

  var storedInstalledApps = readJson(INSTALLED_APPS_KEY, null);
  var installedAppIds = new Set((Array.isArray(storedInstalledApps)
    ? storedInstalledApps
    : Object.keys(apps).filter(function (id) { return apps[id].launcher; }))
    .filter(function (id) { return Object.prototype.hasOwnProperty.call(apps, id); }));
  Object.keys(apps).forEach(function (id) {
    var app = apps[id];
    app.installed = !app.launcher || app.core || installedAppIds.has(id);
    if (app.installed && app.launcher) installedAppIds.add(id);
  });
  writeJson(INSTALLED_APPS_KEY, Array.from(installedAppIds));

  var storedPinnedApps = readJson(PINNED_APPS_KEY, null);
  if (Array.isArray(storedPinnedApps) && storedPinnedApps.length) {
    storedPinnedApps = storedPinnedApps.filter(function (id) { return Object.prototype.hasOwnProperty.call(apps, id); });
    Object.keys(apps).forEach(function (id) {
      if (apps[id].launcher) apps[id].pinned = storedPinnedApps.indexOf(id) !== -1;
    });
  }
  var pinnedAppOrder = (Array.isArray(storedPinnedApps) ? storedPinnedApps : Object.keys(apps).filter(function (id) {
    return apps[id].launcher && apps[id].pinned;
  })).filter(function (id, index, ids) {
    return ids.indexOf(id) === index && apps[id] && apps[id].launcher;
  });

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      showToast("Could not save locally", "Local storage may be unavailable.", "info");
    }
  }

  function escapeSelector(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function iconMarkup(name) {
    if (name === "stream") {
      return '<img class="app-image-icon spotify-vector" src="./assets/spotify-official.png?v=20260827-user-artwork-v1" width="512" height="512" alt="">';
    }
    var imageIcons = {
      duckduckgo: "./assets/duckduckgo.png",
      chat: "./assets/messages.png",
      "geometry-dash": "./assets/geometry-dash.png",
      "google-drive": "./assets/google-drive.svg?v=20260824-drive-logo-v3",
      wallpaper: "./assets/wallpaper-engine.png",
      "media-player": "./assets/media-player.svg?v=20260827-high-resolution-v1",
      "html-games": "./assets/html-games.svg?v=20260827-blue-controller-v1",
      zstream: "./assets/zstream.png?v=20260827-zstream-official-v1",
      discord: "./assets/discord-official.png?v=20260828-user-artwork-v2",
      youtube: "./assets/youtube-official.webp?v=20260828-user-artwork-v1"
    };
    if (imageIcons[name]) return '<img class="app-image-icon" src="' + imageIcons[name] + '" width="24" height="24" alt="">';
    return '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function appIconClass(name) {
    return "app-icon-" + String(name || "app").replace(/[^a-z0-9_-]/gi, "");
  }

  function renderActiveWidget(app) {
    window.NEORenderActiveApp(app, iconMarkup(app.icon), appIconClass(app.icon));
  }

  function safeMediaCover(value) {
    var source = String(value || "").trim();
    if (!source || source.length > 900000) return "";
    if (/^data:image\/(?:avif|gif|jpeg|png|webp);/i.test(source)) return source;
    try {
      var url = new URL(source, window.location.href);
      return /^(?:blob:|https?:)$/.test(url.protocol) ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function mediaNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  function formatMediaTime(value) {
    var seconds = Math.floor(mediaNumber(value));
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    var remainder = String(seconds % 60).padStart(2, "0");
    return hours ? hours + ":" + String(minutes).padStart(2, "0") + ":" + remainder : minutes + ":" + remainder;
  }

  function closeNowPlayingVolume() {
    if (!nowPlayingWidget) return;
    nowPlayingWidget.classList.remove("is-volume-open");
    var trigger = nowPlayingWidget.querySelector("[data-now-playing-volume-trigger]");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function setNowPlayingVolume(value) {
    if (!nowPlayingState) return;
    var volume = Math.max(0, Math.min(1, Number(value) || 0));
    nowPlayingState.volume = volume;
    var input = nowPlayingWidget && nowPlayingWidget.querySelector("[data-now-playing-volume]");
    var output = nowPlayingWidget && nowPlayingWidget.querySelector("[data-now-playing-volume-output]");
    var percentage = Math.round(volume * 100);
    if (input) {
      input.value = String(percentage);
      input.setAttribute("aria-valuetext", percentage + " percent");
    }
    if (output) output.textContent = percentage + "%";
    if (nowPlayingState.source === "local-music") {
      loadFeatureRuntime().then(function (runtime) {
        if (runtime && typeof runtime.setVolume === "function") runtime.setVolume(volume);
      }).catch(function () {});
      return;
    }
    window.dispatchEvent(new CustomEvent("neo-media-volume-request", {
      detail: { source: nowPlayingState.source, volume: volume }
    }));
  }

  function clearNowPlayingLevels() {
    window.clearTimeout(nowPlayingLevelTimer);
    nowPlayingLevelTimer = 0;
    if (!nowPlayingWidget) return;
    nowPlayingWidget.classList.remove("is-reactive");
    nowPlayingWidget.querySelectorAll("[data-now-playing-wave] i").forEach(function (bar) {
      bar.style.removeProperty("--neo-wave-level");
    });
  }

  function renderNowPlayingLevels(detail) {
    if (!nowPlayingWidget || !nowPlayingState || !nowPlayingState.playing || systemPrefersReducedMotion()) {
      clearNowPlayingLevels();
      return;
    }
    if (String(detail.source || "") !== nowPlayingState.source) return;
    var levels = Array.from(detail.levels || []).slice(0, 8).map(function (value) {
      return Math.max(0, Math.min(1, Number(value) || 0));
    });
    if (levels.length !== 8) return;

    var bars = nowPlayingWidget.querySelectorAll("[data-now-playing-wave] i");
    bars.forEach(function (bar, index) {
      bar.style.setProperty("--neo-wave-level", String(0.12 + (levels[index] * 0.88)));
    });
    nowPlayingWidget.classList.add("is-reactive");
    window.clearTimeout(nowPlayingLevelTimer);
    nowPlayingLevelTimer = window.setTimeout(clearNowPlayingLevels, 480);
  }

  function renderNowPlaying(detail) {
    if (!nowPlayingWidget || !detail) return;
    var source = String(detail.source || "media");
    var topbarMedia = document.querySelector("[data-topbar-media]");
    if (detail.active === false) {
      if (nowPlayingState && nowPlayingState.source === source) {
        nowPlayingState = null;
        clearNowPlayingLevels();
        closeNowPlayingVolume();
        nowPlayingWidget.hidden = true;
        if (topbarMedia) topbarMedia.hidden = true;
      }
      return;
    }

    var title = String(detail.title || "").trim().slice(0, 160);
    if (!title) return;
    var appId = apps[detail.appId] ? detail.appId : "media";
    var app = apps[appId] || apps.media;
    var playing = detail.playing === true;
    var paused = detail.playing === false;
    var visualizing = playing || detail.visualizer === true;
    var cover = safeMediaCover(detail.cover);
    var position = mediaNumber(detail.position);
    var duration = mediaNumber(detail.duration);
    var hasTiming = position > 0 || duration > 0;
    var reportedVolume = Number(detail.volume);
    var hasVolume = detail.volumeControl === true && Number.isFinite(reportedVolume);
    var volume = hasVolume ? Math.max(0, Math.min(1, reportedVolume)) : 0;
    if (!playing || !nowPlayingState || nowPlayingState.source !== source) clearNowPlayingLevels();
    nowPlayingState = {
      source: source,
      appId: appId,
      playing: playing,
      paused: paused,
      volume: volume
    };

    nowPlayingWidget.hidden = false;
    nowPlayingWidget.classList.toggle("is-playing", playing);
    nowPlayingWidget.classList.toggle("is-paused", paused);
    nowPlayingWidget.classList.toggle("is-visualizing", visualizing);
    nowPlayingWidget.classList.toggle("has-cover", Boolean(cover));
    nowPlayingWidget.dataset.mediaSource = source;

    var state = nowPlayingWidget.querySelector("[data-now-playing-state]");
    var open = nowPlayingWidget.querySelector(".now-playing-open");
    var titleNode = nowPlayingWidget.querySelector("[data-now-playing-title]");
    var copyNode = nowPlayingWidget.querySelector("[data-now-playing-copy]");
    var art = nowPlayingWidget.querySelector("[data-now-playing-art]");
    var image = nowPlayingWidget.querySelector("[data-now-playing-cover]");
    var fallback = nowPlayingWidget.querySelector("[data-now-playing-fallback]");
    var controls = nowPlayingWidget.querySelector(".now-playing-controls");
    var toggle = nowPlayingWidget.querySelector("[data-now-playing-toggle]");
    var timing = nowPlayingWidget.querySelector("[data-now-playing-timing]");
    var elapsed = nowPlayingWidget.querySelector("[data-now-playing-elapsed]");
    var total = nowPlayingWidget.querySelector("[data-now-playing-duration]");
    var timingSeparator = timing && timing.querySelector("span");
    var volumePanel = nowPlayingWidget.querySelector("[data-now-playing-volume-panel]");
    var volumeTrigger = nowPlayingWidget.querySelector("[data-now-playing-volume-trigger]");
    var volumeInput = nowPlayingWidget.querySelector("[data-now-playing-volume]");
    var volumeOutput = nowPlayingWidget.querySelector("[data-now-playing-volume-output]");

    state.textContent = String(detail.state || (playing ? "PLAYING" : paused ? "PAUSED" : "OPEN")).slice(0, 18).toUpperCase();
    titleNode.textContent = title;
    copyNode.textContent = String(detail.copy || detail.subtitle || app.subtitle || "Now playing").trim().slice(0, 180);
    open.dataset.app = appId;
    open.setAttribute("aria-label", "Open " + app.title + " for " + title);
    fallback.className = "now-playing-art-fallback " + appIconClass(detail.icon || app.icon || "music");
    fallback.innerHTML = iconMarkup(detail.icon || app.icon || "music");
    art.style.setProperty("--media-hue", String(Number.isFinite(Number(detail.hue)) ? Number(detail.hue) : 158));

    if (timing) timing.hidden = !hasTiming;
    if (elapsed) elapsed.textContent = formatMediaTime(position);
    if (total) {
      total.hidden = duration <= 0;
      total.textContent = formatMediaTime(duration);
    }
    if (timingSeparator) timingSeparator.hidden = duration <= 0;
    if (volumePanel) volumePanel.hidden = !hasVolume;
    if (volumeTrigger) {
      volumeTrigger.hidden = !hasVolume;
      if (!hasVolume) closeNowPlayingVolume();
    }
    if (hasVolume) {
      var percentage = Math.round(volume * 100);
      if (volumeInput) {
        volumeInput.value = String(percentage);
        volumeInput.setAttribute("aria-valuetext", percentage + " percent");
      }
      if (volumeOutput) volumeOutput.textContent = percentage + "%";
    }

    image.onerror = function () {
      image.hidden = true;
      fallback.hidden = false;
      nowPlayingWidget.classList.remove("has-cover");
    };
    if (cover) {
      image.src = cover;
      image.hidden = false;
      fallback.hidden = true;
    } else {
      image.removeAttribute("src");
      image.hidden = true;
      fallback.hidden = false;
    }

    if (topbarMedia) {
      var topbarTitle = topbarMedia.querySelector("[data-topbar-media-title]");
      var topbarCover = topbarMedia.querySelector("[data-topbar-media-cover]");
      var topbarFallback = topbarMedia.querySelector("[data-topbar-media-fallback]");
      var topbarTime = topbarMedia.querySelector("[data-topbar-media-time]");
      topbarMedia.hidden = false;
      topbarMedia.dataset.app = appId;
      topbarMedia.classList.toggle("is-playing", playing);
      topbarMedia.setAttribute("aria-label", "Open " + app.title + " for " + title);
      if (topbarTitle) topbarTitle.textContent = title;
      if (topbarTime) {
        topbarTime.hidden = !hasTiming;
        topbarTime.textContent = formatMediaTime(position) + (duration > 0 ? " / " + formatMediaTime(duration) : "");
      }
      if (topbarCover) {
        topbarCover.onerror = function () {
          topbarCover.hidden = true;
          if (topbarFallback) topbarFallback.hidden = false;
        };
        if (cover) {
          topbarCover.src = cover;
          topbarCover.hidden = false;
          if (topbarFallback) topbarFallback.hidden = true;
        } else {
          topbarCover.removeAttribute("src");
          topbarCover.hidden = true;
          if (topbarFallback) topbarFallback.hidden = false;
        }
      }
    }

    controls.hidden = detail.transport !== true;
    if (toggle) {
      toggle.innerHTML = iconMarkup(playing ? "pause" : "play");
      toggle.setAttribute("aria-label", playing ? "Pause" : "Play");
    }
  }

  function showStreamNowPlaying() {
    var source = "browse-media:stream";
    if (nowPlayingState && nowPlayingState.appId === "stream" && nowPlayingState.source === source) return;
    if (nowPlayingState && nowPlayingState.playing) return;
    renderNowPlaying({
      source: source,
      appId: "stream",
      icon: "stream",
      title: "Music",
      copy: "Choose a song to start listening",
      state: "READY",
      playing: null,
      visualizer: true,
      active: true
    });
  }

  function isSmallScreen() {
    return window.matchMedia("(max-width: 720px)").matches;
  }

  function systemPrefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function autoLowPower() {
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var saveData = Boolean(connection && connection.saveData);
    var memoryLow = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;
    var coresLow = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4;
    return saveData || (memoryLow && coresLow);
  }

  function effectiveLowPower() {
    if (settings.performance === "low") return true;
    if (settings.performance === "balanced") return false;
    return autoLowPower();
  }

  function effectiveReducedMotion() {
    return settings.reduceMotion || systemPrefersReducedMotion();
  }

  function effectiveWallpaperMotion() {
    if (!settings.motion || effectiveReducedMotion()) return false;
    return !(settings.batterySaver && isSmallScreen());
  }

  function colorToRgb(value) {
    var match = /^#([0-9a-f]{6})$/i.exec(String(value || ""));
    var number = parseInt(match ? match[1] : "000000", 16);
    return [number >> 16, (number >> 8) & 255, number & 255].join(", ");
  }

  function buildAccentPalette(value) {
    var visible = /^#[0-9a-f]{6}$/i.test(value) ? String(value).toLowerCase() : "#ffffff";
    var visibleRgb = colorToRgb(visible);
    var rgb = visibleRgb.split(", ").map(Number);
    var onLightRgb = rgb.slice();
    var linear = function (channel) {
      channel /= 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    };
    var whiteContrast = function (channels) {
      var luminance = 0.2126 * linear(channels[0]) + 0.7152 * linear(channels[1]) + 0.0722 * linear(channels[2]);
      return 1.05 / (luminance + 0.05);
    };
    while (whiteContrast(onLightRgb) < 4.5) onLightRgb = onLightRgb.map(function (channel) { return Math.max(0, Math.round(channel * 0.88)); });
    var toHex = function (channels) {
      return "#" + channels.map(function (channel) { return channel.toString(16).padStart(2, "0"); }).join("");
    };
    var onLight = toHex(onLightRgb);
    var onLightHover = toHex(onLightRgb.map(function (channel) { return Math.max(0, Math.round(channel * 0.86)); }));
    return {
      visible: visible,
      visibleRgb: visibleRgb,
      contrast: rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114 > 150000 ? "#000000" : "#ffffff",
      onLight: onLight,
      onLightHover: onLightHover
    };
  }

  function applySettings(options) {
    options = options || {};
    var wallpaper = settings.wallpaper;
    var previousWallpaper = root.dataset.wallpaper || wallpaper || "we-steam-1403160205";
    var wallpaperSettings = Object.assign({}, settings, { motion: effectiveWallpaperMotion() });
    var accent = buildAccentPalette(settings.taskbarAccent);
    if (wallpaper === "custom" && !customWallpaperUrl) wallpaper = "we-steam-1403160205";
    root.dataset.wallpaper = wallpaper;
    root.dataset.motion = wallpaperSettings.motion ? "true" : "false";
    root.dataset.weather = settings.weather && !effectiveReducedMotion() ? "true" : "false";
    root.dataset.widgets = settings.widgets ? "true" : "false";
    root.dataset.widgetLock = settings.widgetLock ? "true" : "false";
    root.dataset.dockMagnify = settings.dockMagnify ? "true" : "false";
    root.dataset.taskbarMaterial = settings.taskbarMaterial;
    root.dataset.reduceMotion = settings.reduceMotion ? "true" : "false";
    root.dataset.performance = effectiveLowPower() ? "low" : "balanced";
    root.style.setProperty("--wallpaper-brightness", String(clamp(Number(settings.brightness), 45, 115) / 100));
    root.style.setProperty("--wallpaper-saturation", String(clamp(Number(settings.saturation), 0, 140) / 100));
    root.style.setProperty("--wallpaper-blur", clamp(Number(settings.blur), 0, 12) + "px");
    root.style.setProperty("--neo-taskbar-opacity", String(clamp(Number(settings.taskbarOpacity), 0, 100) / 100));
    root.style.setProperty("--neo-taskbar-tint", colorToRgb(settings.taskbarTint));
    root.style.setProperty("--neo-accent", accent.visible);
    root.style.setProperty("--neo-accent-visible", accent.visible);
    root.style.setProperty("--neo-accent-visible-rgb", accent.visibleRgb);
    root.style.setProperty("--neo-accent-contrast", accent.contrast);
    root.style.setProperty("--neo-accent-on-light", accent.onLight);
    root.style.setProperty("--neo-accent-on-light-hover", accent.onLightHover);
    root.style.setProperty("--neo-accent-soft", "rgba(" + accent.visibleRgb + ", 0.16)");
    root.style.setProperty("--messages-blue", accent.onLight);
    document.querySelectorAll('.neo-window[data-app-id="stream"] iframe').forEach(function (frame) {
      try {
        var frameRoot = frame.contentDocument && frame.contentDocument.documentElement;
        if (!frameRoot) return;
        frameRoot.style.setProperty("--neo-music-accent", accent.visible);
        frameRoot.style.setProperty("--neo-music-accent-contrast", accent.contrast);
      } catch (error) {}
    });
    root.style.setProperty("--neo-taskbar-blur", clamp(Number(settings.taskbarBlur), 0, 40) + "px");
    if (wallpaperEngine) {
      wallpaperEngine.apply(wallpaper, wallpaperSettings).catch(function () {
        if (settings.wallpaper !== wallpaper) return;
        var activeWallpaper = wallpaperEngine.getState().id || previousWallpaper || "we-steam-1403160205";
        settings.wallpaper = activeWallpaper;
        settings.wallpaperRecent = settings.wallpaperRecent.filter(function (id) { return id !== wallpaper; });
        root.dataset.wallpaper = activeWallpaper;
        writeJson(SETTINGS_KEY, settings);
        wallpaperStudios().forEach(refreshWallpaperStudio);
        showToast("Wallpaper unavailable", "Chrome could not decode that file. Your previous wallpaper was kept.", "info");
      });
    }
    syncSettingControls();
    applyWidgetLayout();
    updateWeatherEngine();
    if (options.persist !== false) writeJson(SETTINGS_KEY, settings);
  }

  function setSetting(name, value, options) {
    if (!Object.prototype.hasOwnProperty.call(defaultSettings, name)) return;
    settings[name] = value;
    applySettings(options);
  }

  function syncSettingControls(scope) {
    var host = scope || document;
    Object.keys(settings).forEach(function (name) {
      var nodes = host.querySelectorAll('[data-setting="' + escapeSelector(name) + '"]');
      nodes.forEach(function (node) {
        if (node.type === "checkbox") node.checked = Boolean(settings[name]);
        else node.value = String(settings[name]);
      });
    });
    host.querySelectorAll("[data-output]").forEach(function (output) {
      var name = output.getAttribute("data-output");
      if (name === "blur" || name === "taskbarBlur") output.textContent = settings[name] + "px";
      else output.textContent = settings[name] + "%";
    });
    host.querySelectorAll("[data-taskbar-material]").forEach(function (button) {
      var active = button.getAttribute("data-taskbar-material") === settings.taskbarMaterial;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    host.querySelectorAll("[data-wallpaper-option]").forEach(function (option) {
      if (option.closest("[data-wallpaper-studio]")) return;
      var active = option.getAttribute("data-wallpaper-option") === settings.wallpaper;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (!scope) wallpaperStudios().forEach(refreshWallpaperStudio);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }

  function updateClock() {
    var now = new Date();
    var dayName = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now);
    var monthDay = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(now);
    var monthName = new Intl.DateTimeFormat(undefined, { month: "long" }).format(now);
    var time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(now);
    var topbarDay = document.getElementById("topbar-day");
    var topbarClock = document.getElementById("topbar-clock");
    var taskbarClock = document.getElementById("taskbar-clock");
    var taskbarDate = document.getElementById("taskbar-date");
    var rainmeter = document.getElementById("rainmeter-clock");
    var rainmeterWeekday = document.getElementById("rainmeter-weekday");
    var rainmeterDate = document.getElementById("rainmeter-date");
    var rainmeterTime = document.getElementById("rainmeter-time");
    if (topbarDay) topbarDay.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(now);
    if (topbarClock) topbarClock.textContent = time;
    if (taskbarClock) taskbarClock.textContent = time;
    if (taskbarDate) taskbarDate.textContent = (now.getMonth() + 1) + "/" + now.getDate() + "/" + now.getFullYear();
    if (rainmeter) rainmeter.setAttribute("aria-label", dayName + ", " + monthDay + ", " + now.getFullYear() + ", " + time);
    if (rainmeterWeekday) {
      var weekdayLetters = document.createDocumentFragment();
      Array.from(dayName.toUpperCase()).forEach(function (letter) {
        var glyph = document.createElement("span");
        glyph.setAttribute("aria-hidden", "true");
        glyph.textContent = letter;
        weekdayLetters.appendChild(glyph);
      });
      rainmeterWeekday.setAttribute("aria-label", dayName);
      rainmeterWeekday.replaceChildren(weekdayLetters);
    }
    if (rainmeterDate) rainmeterDate.textContent = String(now.getDate()).padStart(2, "0") + " " + monthName.toUpperCase() + ", " + now.getFullYear() + ".";
    if (rainmeterTime) rainmeterTime.textContent = "- " + time + " -";
    document.querySelectorAll("[data-calendar-weekday]").forEach(function (node) { node.textContent = dayName; });
    document.querySelectorAll("[data-calendar-date]").forEach(function (node) { node.textContent = monthDay; });
    document.querySelectorAll("[data-calendar-time]").forEach(function (node) { node.textContent = time; });
    window.setTimeout(updateClock, 60000 - (Date.now() % 60000) + 20);
  }

  function updateConnection() {
    var online = navigator.onLine;
    if (connectionState) {
      connectionState.classList.toggle("is-offline", !online);
      var label = connectionState.querySelector(".connection-label");
      if (label) label.textContent = online ? "Online" : "Offline";
    }
    var taskbarNetwork = document.getElementById("taskbar-network");
    if (taskbarNetwork) {
      taskbarNetwork.classList.toggle("is-offline", !online);
      taskbarNetwork.title = online ? "Online" : "Offline";
    }
  }

  function updateTopbarAccount() {
    var session = nativeChatSession();
    var button = document.querySelector("[data-topbar-account]");
    if (!button) return;
    var initial = button.querySelector("[data-topbar-account-initial]");
    var name = session.username || "Guest";
    if (initial) initial.textContent = session.id ? name.charAt(0).toUpperCase() : "?";
    button.classList.toggle("is-signed-in", Boolean(session.id));
    button.title = session.id ? name : "Choose a name";
    button.setAttribute("aria-label", session.id ? "Open Messages as " + name : "Choose a chat name");
  }

  function initBatteryStatus() {
    var output = document.querySelector("[data-topbar-battery]");
    var button = output && output.closest(".topbar-battery");
    if (!output || !button || typeof navigator.getBattery !== "function") return;
    navigator.getBattery().then(function (battery) {
      function renderBattery() {
        var percent = Math.round(clamp(Number(battery.level) * 100, 0, 100));
        output.textContent = percent + "%";
        button.classList.toggle("is-charging", Boolean(battery.charging));
        button.setAttribute("aria-label", "Open settings, battery " + percent + " percent" + (battery.charging ? ", charging" : ""));
      }
      battery.addEventListener("levelchange", renderBattery);
      battery.addEventListener("chargingchange", renderBattery);
      renderBattery();
    }).catch(function () {});
  }

  function showToast(title, copy, icon) {
    if (!toastRegion) return;
    var toast = document.createElement("div");
    toast.className = "neo-toast";
    toast.innerHTML = iconMarkup(icon || "check") + "<span></span>";
    var text = toast.lastElementChild;
    var strong = document.createElement("strong");
    var small = document.createElement("small");
    strong.textContent = title;
    small.textContent = copy || "";
    text.append(strong, small);
    toastRegion.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add("is-visible"); });
    window.setTimeout(function () {
      toast.classList.add("is-leaving");
      window.setTimeout(function () { toast.remove(); }, 220);
    }, 2800);
    if (window.NEO_FEATURES && typeof window.NEO_FEATURES.recordNotification === "function") {
      window.NEO_FEATURES.recordNotification(title, copy, icon);
    }
  }

  function createDockButton(app) {
    var win = openWindows.get(app.id);
    var minimized = Boolean(win && win.classList.contains("is-minimized"));
    var button = document.createElement("button");
    button.className = "dock-button";
    button.type = "button";
    button.dataset.app = app.id;
    button.draggable = true;
    var accessibleName = appAccessibleName(app);
    if (!app.hideName) button.dataset.tooltip = app.title;
    button.setAttribute("aria-label", (minimized ? "Restore " : (win ? "Switch to " : "Open ")) + accessibleName);
    var art = document.createElement("span");
    art.className = "dock-app-tile dock-app-art app-icon-shape " + appIconClass(app.icon);
    art.innerHTML = iconMarkup(app.icon);
    button.appendChild(art);
    button.classList.toggle("is-running", Boolean(win));
    button.classList.toggle("is-minimized", minimized);
    return button;
  }

  function fitDockToViewport(dock) {
    var taskbar = dock && dock.closest(".taskbar");
    if (!taskbar) return;
    taskbar.style.removeProperty("--vertical-dock-hit");
    taskbar.style.removeProperty("--vertical-dock-art");
    taskbar.style.removeProperty("--vertical-dock-gap");
    if (window.innerWidth <= 700) return;

    var count = dock.querySelectorAll(".dock-button").length;
    if (!count) return;
    var viewportHeight = Math.max(320, window.innerHeight || document.documentElement.clientHeight || 720);
    var naturalHit = Math.min(46, Math.max(36, viewportHeight * 0.051));
    var naturalArt = Math.min(34, Math.max(27, viewportHeight * 0.038));
    var naturalGap = Math.min(7, Math.max(2, viewportHeight * 0.0065));
    var centerGap = Math.min(7, Math.max(3, viewportHeight * 0.007));
    var startHeight = 42;
    var verticalPadding = viewportHeight <= 660 ? 12 : 16;
    var available = viewportHeight - verticalPadding - startHeight - (centerGap * 2);
    var fittedHit = Math.floor((available - (naturalGap * Math.max(0, count - 1))) / count);
    var hit = Math.max(28, Math.min(naturalHit, fittedHit));
    var gap = naturalGap;

    if ((hit * count) + (gap * Math.max(0, count - 1)) > available && count > 1) {
      gap = Math.max(0, (available - (hit * count)) / (count - 1));
    }
    if (hit >= naturalHit - 0.25 && gap >= naturalGap - 0.25) return;
    taskbar.style.setProperty("--vertical-dock-hit", hit + "px");
    taskbar.style.setProperty("--vertical-dock-art", Math.max(22, Math.min(naturalArt, hit - 9)) + "px");
    taskbar.style.setProperty("--vertical-dock-gap", gap + "px");
  }

  function renderDock() {
    var dock = document.getElementById("neo-dock");
    if (!dock) return;
    var visible = new Map();
    normalizePinnedAppOrder().forEach(function (id) {
      if (apps[id] && apps[id].installed && apps[id].pinned) visible.set(id, apps[id]);
    });
    openWindows.forEach(function (_, id) { if (apps[id]) visible.set(id, apps[id]); });
    dock.textContent = "";
    visible.forEach(function (app) { dock.appendChild(createDockButton(app)); });
    fitDockToViewport(dock);
  }

  function normalizePinnedAppOrder() {
    var next = [];
    pinnedAppOrder.forEach(function (id) {
      if (apps[id] && apps[id].launcher && apps[id].installed && apps[id].pinned && next.indexOf(id) === -1) next.push(id);
    });
    launcherApps().forEach(function (app) {
      if (app.pinned && next.indexOf(app.id) === -1) next.push(app.id);
    });
    pinnedAppOrder = next;
    return next.slice();
  }

  function savePinnedAppOrder() {
    writeJson(PINNED_APPS_KEY, normalizePinnedAppOrder());
  }

  function reorderDockApp(sourceId, targetId, placeAfter) {
    var source = apps[sourceId];
    if (!source || !source.launcher || !source.installed || sourceId === targetId) return;
    source.pinned = true;
    var order = normalizePinnedAppOrder().filter(function (id) { return id !== sourceId; });
    var targetIndex = order.indexOf(targetId);
    if (targetIndex === -1) order.push(sourceId);
    else order.splice(targetIndex + (placeAfter ? 1 : 0), 0, sourceId);
    pinnedAppOrder = order;
    savePinnedAppOrder();
    renderDock();
    renderLauncher();
  }

  function enableDockReordering() {
    var dock = document.getElementById("neo-dock");
    if (!dock || dock.dataset.reorderReady === "true") return;
    dock.dataset.reorderReady = "true";
    var draggedId = "";
    var dropTarget = null;

    function clearDropState() {
      dock.querySelectorAll(".is-dragging, .is-drop-before, .is-drop-after").forEach(function (button) {
        button.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
      });
      dropTarget = null;
    }

    dock.addEventListener("dragstart", function (event) {
      var button = event.target.closest(".dock-button[data-app]");
      if (!button) return;
      draggedId = button.dataset.app;
      button.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedId);
    });

    dock.addEventListener("dragover", function (event) {
      if (!draggedId) return;
      var button = event.target.closest(".dock-button[data-app]");
      if (!button || button.dataset.app === draggedId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dropTarget && dropTarget !== button) dropTarget.classList.remove("is-drop-before", "is-drop-after");
      dropTarget = button;
      var rect = button.getBoundingClientRect();
      var vertical = getComputedStyle(dock).flexDirection === "column";
      var placeAfter = vertical ? event.clientY >= rect.top + rect.height / 2 : event.clientX >= rect.left + rect.width / 2;
      button.classList.toggle("is-drop-before", !placeAfter);
      button.classList.toggle("is-drop-after", placeAfter);
    });

    dock.addEventListener("drop", function (event) {
      if (!draggedId || !dropTarget) return;
      event.preventDefault();
      reorderDockApp(draggedId, dropTarget.dataset.app, dropTarget.classList.contains("is-drop-after"));
      draggedId = "";
      clearDropState();
    });

    dock.addEventListener("dragend", function () {
      draggedId = "";
      clearDropState();
    });
  }

  function setAppPinned(id, pinned) {
    var app = apps[id];
    if (!app || !app.launcher || !app.installed) return false;
    app.pinned = Boolean(pinned);
    pinnedAppOrder = pinnedAppOrder.filter(function (itemId) { return itemId !== id; });
    if (app.pinned) pinnedAppOrder.push(id);
    savePinnedAppOrder();
    renderDock();
    renderLauncher();
    return app.pinned;
  }

  function storeApps() {
    return Object.keys(apps).map(function (id) { return apps[id]; }).filter(function (app) { return app.launcher; });
  }

  function setAppInstalled(id, installed) {
    var app = apps[id];
    if (!app || !app.launcher || (app.core && !installed)) return false;
    app.installed = Boolean(installed);
    if (app.installed) installedAppIds.add(id);
    else installedAppIds.delete(id);
    if (!app.installed) {
      app.pinned = false;
      pinnedAppOrder = pinnedAppOrder.filter(function (itemId) { return itemId !== id; });
      var open = musicRuntime.getWindow(id, openWindows);
      if (open) closeWindow(open, true);
    }
    writeJson(INSTALLED_APPS_KEY, Array.from(installedAppIds));
    savePinnedAppOrder();
    renderDock();
    enableDockReordering();
    renderLauncher();
    return app.installed;
  }

  function launcherApps() {
    return storeApps().filter(function (app) { return app.installed; });
  }

  function normalizeSearchValue(value) {
    return String(value || "").toLocaleLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function subsequenceScore(query, candidate) {
    var queryIndex = 0;
    var gaps = 0;
    for (var index = 0; index < candidate.length && queryIndex < query.length; index += 1) {
      if (candidate[index] === query[queryIndex]) queryIndex += 1;
      else if (queryIndex > 0) gaps += 1;
    }
    return queryIndex === query.length ? Math.max(1, 35 - gaps) : 0;
  }

  function launcherMatchScore(app, rawQuery) {
    var query = normalizeSearchValue(rawQuery);
    if (!query) return app.pinned ? 20 : 10;
    var values = [app.title, app.subtitle].concat(app.aliases || []).map(normalizeSearchValue).filter(Boolean);
    var best = 0;
    values.forEach(function (value) {
      if (value === query) best = Math.max(best, 120);
      if (value.indexOf(query) === 0) best = Math.max(best, 95 - Math.min(20, value.length - query.length));
      if (value.split(" ").some(function (word) { return word.indexOf(query) === 0; })) best = Math.max(best, 75);
      if (value.indexOf(query) !== -1) best = Math.max(best, 60);
      best = Math.max(best, subsequenceScore(query, value));
    });
    return best ? best + (app.pinned ? 4 : 0) : 0;
  }

  function searchLauncherApps(query) {
    return launcherApps().map(function (app) {
      return { app: app, score: launcherMatchScore(app, query) };
    }).filter(function (item) {
      return item.score > 0;
    }).sort(function (left, right) {
      return right.score - left.score || left.app.title.localeCompare(right.app.title);
    }).map(function (item) {
      return item.app;
    });
  }

  function createLauncherIcon(app, className) {
    var icon = document.createElement("span");
    icon.className = (className || "launcher-app-icon") + " app-icon-shape " + appIconClass(app.icon);
    icon.innerHTML = iconMarkup(app.icon);
    return icon;
  }

  function appDisplayTitle(app) {
    return app && !app.hideName ? String(app.title || "") : "";
  }

  function appAccessibleName(app) {
    return String((app && (app.accessibleName || app.title)) || "Application");
  }

  function createPinnedApp(app) {
    var button = document.createElement("button");
    button.className = "launcher-app";
    button.type = "button";
    button.dataset.app = app.id;
    button.title = app.subtitle;
    button.setAttribute("aria-label", "Open " + appAccessibleName(app));
    button.appendChild(createLauncherIcon(app));
    if (!app.hideName) {
      var label = document.createElement("span");
      label.textContent = app.title;
      button.appendChild(label);
    }
    return button;
  }

  function createDetailedApp(app, className, role) {
    var button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.dataset.app = app.id;
    button.setAttribute("aria-label", "Open " + appAccessibleName(app));
    if (role) button.setAttribute("role", role);
    button.appendChild(createLauncherIcon(app, "launcher-detail-icon"));
    var copy = document.createElement("span");
    var title = document.createElement("strong");
    var detail = document.createElement("small");
    title.textContent = appDisplayTitle(app);
    title.hidden = app.hideName === true;
    detail.textContent = app.category || app.subtitle;
    copy.append(title, detail);
    button.appendChild(copy);
    return button;
  }

  function renderLauncherRecent() {
    if (!launcherRecent || !launcherRecentEmpty) return;
    var recentIds = readJson(RECENT_APPS_KEY, []);
    if (!Array.isArray(recentIds)) recentIds = [];
    var recentApps = recentIds.map(function (id) { return apps[id]; }).filter(function (app) { return app && app.launcher; }).slice(0, 6);
    launcherRecent.textContent = "";
    recentApps.forEach(function (app) { launcherRecent.appendChild(createDetailedApp(app, "recent-app")); });
    launcherRecentEmpty.hidden = recentApps.length > 0;
    launcherRecent.hidden = recentApps.length === 0;
  }

  function renderLauncherCategories() {
    if (!launcherCategories) return;
    var groups = new Map();
    launcherApps().forEach(function (app) {
      var category = app.category || "Applications";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(app);
    });
    launcherCategories.textContent = "";
    groups.forEach(function (items, category) {
      var group = document.createElement("article");
      group.className = "category-group";
      var icons = document.createElement("div");
      icons.className = "category-icons";
      items.slice(0, 4).forEach(function (app) {
        var button = document.createElement("button");
        button.type = "button";
        button.dataset.app = app.id;
        if (!app.hideName) button.title = app.title;
        button.setAttribute("aria-label", "Open " + appAccessibleName(app));
        button.appendChild(createLauncherIcon(app, "launcher-category-icon"));
        icons.appendChild(button);
      });
      var label = document.createElement("span");
      label.textContent = category;
      group.append(icons, label);
      launcherCategories.appendChild(group);
    });
  }

  function renderLauncher() {
    if (!launcherGrid) return;
    var available = launcherApps();
    var ordered = available.filter(function (app) { return app.pinned; }).concat(
      available.filter(function (app) { return !app.pinned; }).sort(function (left, right) {
        return appAccessibleName(left).localeCompare(appAccessibleName(right));
      })
    );
    launcherGrid.textContent = "";
    ordered.forEach(function (app) { launcherGrid.appendChild(createPinnedApp(app)); });
    var toggle = launcher.querySelector("[data-launcher-toggle-all]");
    if (toggle) {
      toggle.hidden = ordered.length <= 6;
      toggle.setAttribute("aria-expanded", launcherShowAll ? "true" : "false");
      var label = toggle.querySelector("span");
      if (label) label.textContent = launcherShowAll ? "Show less" : "Show all";
      toggle.classList.toggle("is-expanded", launcherShowAll);
    }
    renderLauncherRecent();
    renderLauncherCategories();
    filterLauncher(launcherSearch ? launcherSearch.value : "");
  }

  function recordRecentApp(id) {
    var recentIds = readJson(RECENT_APPS_KEY, []);
    if (!Array.isArray(recentIds)) recentIds = [];
    recentIds = [id].concat(recentIds.filter(function (item) { return item !== id; })).slice(0, 6);
    writeJson(RECENT_APPS_KEY, recentIds);
    renderLauncherRecent();
  }

  function setLauncherOpen(open, returnFocus) {
    if (!launcher) return;
    if (open) {
      launcherReturnFocus = returnFocus || document.activeElement;
      if (launcherDismissLayer) launcherDismissLayer.hidden = false;
      launcher.hidden = false;
      launcher.setAttribute("aria-hidden", "false");
      launcherSearch.value = "";
      launcherSelectedIndex = 0;
      filterLauncher("");
      requestAnimationFrame(function () { launcherSearch.focus(); });
    } else {
      launcher.hidden = true;
      launcher.setAttribute("aria-hidden", "true");
      if (launcherDismissLayer) launcherDismissLayer.hidden = true;
      if (launcherReturnFocus && document.contains(launcherReturnFocus)) launcherReturnFocus.focus();
      launcherReturnFocus = null;
    }
  }

  function filterLauncher(value) {
    var query = normalizeSearchValue(value);
    launcher.querySelectorAll("[data-launcher-home]").forEach(function (section) { section.hidden = Boolean(query); });
    if (!launcherResults || !launcherResultList) return;
    launcherResults.hidden = !query;
    launcherResultList.textContent = "";
    if (!query) return;
    var results = searchLauncherApps(query).slice(0, 24);
    launcherSelectedIndex = Math.min(launcherSelectedIndex, Math.max(0, results.length - 1));
    results.forEach(function (app, index) {
      var button = createPinnedApp(app);
      button.classList.add("search-result");
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", index === launcherSelectedIndex ? "true" : "false");
      button.classList.toggle("is-selected", index === launcherSelectedIndex);
      button.dataset.launcherResultIndex = String(index);
      launcherResultList.appendChild(button);
    });
    if (launcherResultCount) launcherResultCount.textContent = results.length + (results.length === 1 ? " result" : " results");
    if (launcherSearchEmpty) launcherSearchEmpty.hidden = results.length > 0;
  }

  function moveLauncherSelection(direction) {
    var buttons = Array.from(launcherResultList.querySelectorAll(".search-result"));
    if (!buttons.length) return;
    launcherSelectedIndex = clamp(launcherSelectedIndex + direction, 0, buttons.length - 1);
    buttons.forEach(function (button, index) {
      var selected = index === launcherSelectedIndex;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function createWindow(app) {
    var win = document.createElement("section");
    win.className = "neo-window";
    win.dataset.appId = app.id;
    win.setAttribute("role", "region");
    win.setAttribute("aria-label", appAccessibleName(app));
    win.tabIndex = -1;
    var sequence = windowSequence++;
    var availableWidth = Math.max(320, window.innerWidth - 40);
    var availableHeight = Math.max(280, window.innerHeight - 120);
    var savedWindow = windowStates[app.id] || {};
    var width = Math.min(clamp(Number(savedWindow.width || DEFAULT_WINDOW_WIDTH), 320, availableWidth), availableWidth);
    var height = Math.min(clamp(Number(savedWindow.height || DEFAULT_WINDOW_HEIGHT), 280, availableHeight), availableHeight);
    win.style.width = width + "px";
    win.style.height = height + "px";
    if (!isSmallScreen()) {
      var left = Number.isFinite(Number(savedWindow.left)) ? Number(savedWindow.left) : 36 + (sequence % 6) * 26;
      var top = Number.isFinite(Number(savedWindow.top)) ? Number(savedWindow.top) : 24 + (sequence % 5) * 22;
      win.style.left = Math.min(left, Math.max(8, window.innerWidth - width - 16)) + "px";
      win.style.top = Math.min(top, Math.max(8, availableHeight - height + 42)) + "px";
    }
    win.innerHTML =
      '<header class="window-chrome">' +
        '<span class="window-app-icon app-icon-shape ' + appIconClass(app.icon) + '">' + iconMarkup(app.icon) + "</span>" +
        '<span class="window-title"><strong></strong><small></small></span>' +
        '<span class="window-controls">' +
          '<button class="window-control minimize" type="button" data-window-action="minimize" aria-label="Minimize">' + iconMarkup("minimize") + "</button>" +
          '<button class="window-control maximize" type="button" data-window-action="maximize" aria-label="Maximize">' + iconMarkup("maximize") + "</button>" +
          '<button class="window-control fullscreen" type="button" data-window-action="fullscreen" aria-label="Enter app fullscreen" aria-pressed="false">' + iconMarkup("fullscreen") + "</button>" +
          '<button class="window-control close" type="button" data-window-action="close" aria-label="Close">' + iconMarkup("close") + "</button>" +
        "</span>" +
      "</header>" +
      '<div class="window-body"></div>';
    var windowTitle = win.querySelector(".window-title");
    windowTitle.hidden = app.hideName === true;
    windowTitle.querySelector("strong").textContent = appDisplayTitle(app);
    windowTitle.querySelector("small").textContent = app.subtitle || "NEO OS app";
    win.querySelectorAll('[data-window-action]:not([data-window-action="fullscreen"])').forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        handleWindowAction(button);
      });
    });
    var body = win.querySelector(".window-body");
    if (app.id === "stream") mountUnifiedMusic(app, body);
    else if (app.lazy) mountLazyApp(app, body);
    else if (app.template) mountTemplate(app, body);
    else if (app.route) mountFrame(app, body);
    windowLayer.appendChild(win);
    if (savedWindow.maximized && !isSmallScreen()) win.classList.add("is-maximized");
    openWindows.set(app.id, win);
    renderDock();
    activateWindow(win);
    wireWindowDrag(win);
    wireWindowPersistence(win);
    requestAnimationFrame(function () {
      win.classList.add("is-open");
      win.focus({ preventScroll: true });
    });
    return win;
  }

  function loadFeatureRuntime() {
    if (window.NEO_FEATURES) return Promise.resolve(window.NEO_FEATURES);
    if (featureRuntimePromise) return featureRuntimePromise;
    featureRuntimePromise = new Promise(function (resolve, reject) {
      if (!document.querySelector('link[data-neo-features]')) {
        var style = document.createElement("link");
        style.rel = "stylesheet";
        style.href = "./neo-os-features.css?v=20260826-playlist-actions-v1";
        style.dataset.neoFeatures = "";
        document.head.appendChild(style);
      }
      var script = document.createElement("script");
      script.src = "./neo-os-features.js?v=20260828-minimized-mute-v3";
      script.async = true;
      script.onload = function () {
        if (!window.NEO_FEATURES) {
          reject(new Error("The NEO feature runtime did not start."));
          return;
        }
        if (typeof window.NEO_FEATURES.init === "function") window.NEO_FEATURES.init(shellApi);
        resolve(window.NEO_FEATURES);
      };
      script.onerror = function () { reject(new Error("The NEO feature runtime could not be loaded.")); };
      document.head.appendChild(script);
    });
    return featureRuntimePromise;
  }

  function loadFilesRuntime() {
    if (window.NEO_FILES) return Promise.resolve(window.NEO_FILES);
    if (filesRuntimePromise) return filesRuntimePromise;
    filesRuntimePromise = new Promise(function (resolve, reject) {
      if (!document.querySelector('link[data-neo-files]')) {
        var style = document.createElement("link");
        style.rel = "stylesheet";
        style.href = "./neo-files.css?v=20260827-file-explorer-ui-v1";
        style.dataset.neoFiles = "";
        document.head.appendChild(style);
      }
      var script = document.createElement("script");
      script.src = "./neo-files.js?v=20260828-open-file-copy-v1";
      script.async = true;
      script.onload = function () {
        if (!window.NEO_FILES) {
          reject(new Error("Drive did not start."));
          return;
        }
        resolve(window.NEO_FILES);
      };
      script.onerror = function () { reject(new Error("Drive could not be loaded.")); };
      document.head.appendChild(script);
    });
    return filesRuntimePromise;
  }

  function loadBrowseRuntime() {
    if (window.NEO_BROWSER_ENGINE) return Promise.resolve(window.NEO_BROWSER_ENGINE);
    if (browseRuntimePromise) return browseRuntimePromise;
    browseRuntimePromise = new Promise(function (resolve, reject) {
      var existing = document.getElementById("neo-browse-runtime-script");
      var script = existing || document.createElement("script");
      script.id = "neo-browse-runtime-script";
      script.src = "./neo-browser-runtime.js?v=20260827-transport-recovery-v67";
      script.async = true;
      script.onload = function () {
        if (!window.NEO_BROWSER_ENGINE) {
          reject(new Error("The web session did not start."));
          return;
        }
        resolve(window.NEO_BROWSER_ENGINE);
      };
      script.onerror = function () { reject(new Error("The web session could not be loaded.")); };
      if (!existing) document.head.appendChild(script);
    }).catch(function (error) {
      var failed = document.getElementById("neo-browse-runtime-script");
      if (failed) failed.remove();
      browseRuntimePromise = null;
      throw error;
    });
    return browseRuntimePromise;
  }

  function scheduleBrowsePrewarm() {
    if (!("serviceWorker" in navigator) || navigator.onLine === false) return;
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || ""))) return;

    var warming = false;
    var warm = function () {
      if (warming) return;
      warming = true;
      loadBrowseRuntime().then(function (engine) {
        if (engine && typeof engine.warm === "function") return engine.warm();
      }).catch(function () {});
    };

    document.addEventListener("pointerover", function prewarmOnPointer(event) {
      if (!event.target.closest('[data-app="browser"], [data-app="stream"]')) return;
      document.removeEventListener("pointerover", prewarmOnPointer);
      document.removeEventListener("focusin", prewarmOnFocus);
      warm();
    }, { passive: true });
    function prewarmOnFocus(event) {
      if (!event.target.closest('[data-app="browser"], [data-app="stream"]')) return;
      document.removeEventListener("pointerover", prewarmOnPointer);
      document.removeEventListener("focusin", prewarmOnFocus);
      warm();
    }
    document.addEventListener("focusin", prewarmOnFocus);
    if ("requestIdleCallback" in window) window.requestIdleCallback(warm, { timeout: 1400 });
    else window.setTimeout(warm, 450);
  }

  function mountLazyApp(app, body) {
    body.innerHTML = '<div class="feature-loader" role="status"><span class="library-spinner" aria-hidden="true"></span><strong>Opening ' + appAccessibleName(app) + '</strong><p>Loading the app workspace.</p></div>';
    var loader = app.runtime === "files" ? loadFilesRuntime() : loadFeatureRuntime();
    loader.then(function (runtime) {
      body.textContent = "";
      runtime.mount(app.id, body, shellApi);
    }).catch(function (error) {
      body.innerHTML = '<div class="feature-loader is-error" role="alert"><strong>Could not open ' + appAccessibleName(app) + '</strong><p></p><button class="button" type="button" data-feature-retry>Retry</button></div>';
      body.querySelector("p").textContent = error && error.message ? error.message : "The app is unavailable.";
      body.querySelector("[data-feature-retry]").addEventListener("click", function () { mountLazyApp(app, body); });
    });
  }

  function mountUnifiedMusic(app, body) {
    var view = musicRuntime.createShell(app, body, iconMarkup);
    var shell = view.shell;
    var tabs = view.tabs;
    var listenPanel = view.listenPanel;
    var mp3Panel = view.mp3Panel;
    var template = document.getElementById(app.template);
    var mp3Promise = null;

    if (!view.direct && template) {
      listenPanel.appendChild(template.content.cloneNode(true));
      wireBrowserApp(listenPanel, app);
    } else if (!view.direct) {
      listenPanel.innerHTML = '<div class="feature-loader is-error" role="alert"><strong>Music is unavailable</strong><p>The listening workspace could not be opened.</p></div>';
    }

    function loadMp3Player() {
      if (mp3Promise) return mp3Promise;
      mp3Panel.innerHTML = '<div class="feature-loader" role="status"><span class="library-spinner" aria-hidden="true"></span><strong>Opening Audio Player</strong><p>Loading your local audio library.</p></div>';
      mp3Promise = loadFeatureRuntime().then(function (runtime) {
        if (!body.isConnected) return;
        mp3Panel.textContent = "";
        runtime.mount("music", mp3Panel, shellApi);
      }).catch(function (error) {
        mp3Promise = null;
        mp3Panel.innerHTML = '<div class="feature-loader is-error" role="alert"><strong>Could not open Audio Player</strong><p></p><button class="button" type="button" data-mp3-retry>Retry</button></div>';
        mp3Panel.querySelector("p").textContent = error && error.message ? error.message : "The local player is unavailable.";
        mp3Panel.querySelector("[data-mp3-retry]").addEventListener("click", loadMp3Player);
      });
      return mp3Promise;
    }

    function selectMode(mode, focusTab) {
      mode = mode === "mp3" ? "mp3" : "listen";
      tabs.forEach(function (tab) {
        var selected = tab.dataset.unifiedMusicMode === mode;
        tab.classList.toggle("is-active", selected);
        tab.setAttribute("aria-selected", selected ? "true" : "false");
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focusTab) tab.focus({ preventScroll: true });
      });
      listenPanel.hidden = mode !== "listen";
      mp3Panel.hidden = mode !== "mp3";
      shell.dataset.musicMode = mode;
      writeJson(MUSIC_MODE_KEY, mode);
      if (mode === "mp3") loadMp3Player();
    }

    shell.querySelector(".music-unified-tabs").addEventListener("click", function (event) {
      var tab = event.target.closest("[data-unified-music-mode]");
      if (tab) selectMode(tab.dataset.unifiedMusicMode, false);
    });
    shell.querySelector(".music-unified-tabs").addEventListener("keydown", function (event) {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(event.key) === -1) return;
      event.preventDefault();
      var current = Math.max(0, tabs.indexOf(document.activeElement));
      var next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      selectMode(tabs[next].dataset.unifiedMusicMode, true);
    });

    selectMode(readJson(MUSIC_MODE_KEY, "listen"), false);
  }

  function mountTemplate(app, body) {
    var template = document.getElementById(app.template);
    if (!template) {
      body.textContent = "This app is unavailable.";
      return;
    }
    body.appendChild(template.content.cloneNode(true));
    syncSettingControls(body);
    if (app.id === "zones") wireLibraryApp(body);
    if (app.id === "search") wireSearchApp(body);
    if (app.template === "browser-template") wireBrowserApp(body, app);
    if (app.id === "chat") wireMessagesApp(body);
    if (app.id === "wallpaper") wireWallpaperStudio(body);
    if (app.id === "calendar") updateClock();
  }

  function wireBrowserApp(scope, app) {
    var browser = scope.querySelector("[data-neo-browser]");
    if (!browser || browser.dataset.ready === "true") return;
    browser.dataset.ready = "true";

    var initialTarget = app.browserTarget;
    var initialLabel = appAccessibleName(app);
    var appMode = app.browserChrome === false;
    var appTheme = app.browserTheme || "";
    var directOrigin = app.browserDirect === true;
    browser.classList.toggle("is-dedicated-app", appMode);

    var form = browser.querySelector("[data-browser-search-form]");
    var input = browser.querySelector("[data-browser-search-input]");
    var sessionView = browser.querySelector("[data-browser-session]");
    var loading = browser.querySelector("[data-browser-loading]");
    var errorView = browser.querySelector("[data-browser-error]");
    var errorCopy = browser.querySelector("[data-browser-error-copy]");
    var retry = browser.querySelector("[data-browser-retry]");
    var startClose = browser.querySelector("[data-browser-start-close]");
    var startPlus = browser.querySelector("[data-browser-start-plus]");
    var content = browser.querySelector("[data-browser-content]");
    var hostWindow = scope.closest(".neo-window");
    var currentQuery = "";
    var currentTarget = "";
    var signInStop;
    var runtimeView = null;

    function stopRequest() {
      if (signInStop) signInStop();
      signInStop = null;
      if (runtimeView && typeof runtimeView._neoBrowserCleanup === "function") {
        runtimeView._neoBrowserCleanup();
      }
      runtimeView = null;
    }

    function setBrowserState(state, message) {
      browser.classList.toggle("has-query", state !== "home");
      browser.classList.toggle(
        "has-tabs",
        state === "content" && Boolean(runtimeView && runtimeView.classList.contains("neo-browser-runtime"))
      );
      sessionView.hidden = state === "home";
      loading.hidden = state !== "loading";
      errorView.hidden = state !== "error";
      content.hidden = state !== "content";
      if (message) errorCopy.textContent = message;
    }

    function prepareBrowserEngine() {
      return loadBrowseRuntime().then(function (engine) {
        if (typeof engine.openQuery !== "function" || typeof engine.warm !== "function") {
          throw new Error("The web session is unavailable.");
        }
        if (directOrigin) return engine;
        return engine.warm().then(function () { return engine; });
      });
    }

    function openTarget(targetHref, label) {
      var target;
      try { target = new URL(targetHref); } catch (error) { return; }
      if (target.protocol !== "https:") return;
      currentQuery = label || target.hostname;
      currentTarget = target.href;
      input.value = currentQuery;
      stopRequest();
      content.textContent = "";
      setBrowserState("loading");

      prepareBrowserEngine().then(function (engine) {
        return engine.openQuery({
          container: content,
          query: currentQuery,
          target: target.href,
          appId: app.id,
          appMode: appMode,
          appTheme: appTheme,
          directOrigin: directOrigin,
          label: initialLabel || currentQuery
        });
      }).then(function (view) {
        runtimeView = view || null;
        setBrowserState("content");
      }).catch(function (error) {
        setBrowserState("error", error && error.message ? error.message : "The web session could not start.");
      });
    }

    function openNewTabShell(addSecondTab) {
      currentQuery = "";
      currentTarget = "";
      input.value = "";
      stopRequest();
      content.textContent = "";
      setBrowserState("loading");
      prepareBrowserEngine().then(function (engine) {
        return engine.openQuery({
          container: content,
          query: "",
          target: "neo://newtab",
          appId: app.id,
          appMode: appMode,
          appTheme: appTheme,
          directOrigin: directOrigin,
          label: initialLabel || "New tab"
        });
      }).then(function (view) {
        runtimeView = view || null;
        setBrowserState("content");
        if (addSecondTab && runtimeView) {
          requestAnimationFrame(function () {
            runtimeView.querySelector("[data-browser-new-tab]")?.click();
          });
        }
      }).catch(function (error) {
        setBrowserState("error", error && error.message ? error.message : "The web session could not start.");
      });
    }

    function openSignInPage() {
      stopRequest();
      currentQuery = "Choose a name";
      currentTarget = "";
      input.value = currentQuery;
      content.textContent = "";
      setBrowserState("loading");
       import("./neo-account-signin.js?v=5").then(function (runtime) {
        if(currentQuery!=="Choose a name")return;
        signInStop = runtime.mountAccountSignIn(content, function () { setBrowserState("content"); }, function (payload) {
          window.dispatchEvent(new CustomEvent("neo-auth-changed", { detail: { user: payload.user } }));
          showToast("Chat ready", "You are now " + payload.user.username + ".", "chat");
          window.setTimeout(function () { openApp("chat"); }, 350);
        }, {
          title: "Choose your name",
          copy: "This is how you will appear in Global Chat.",
          success: "Name saved. Opening Global Chat..."
        });
      }).catch(function () {
        if(currentQuery==="Choose a name")setBrowserState("error","Name service unavailable.");
      });
    }

    function destinationFromEntry(value) {
      var entry = String(value || "").replace(/\s+/g, " ").trim();
      if (!entry) return null;

      try {
        var absolute = new URL(entry);
        if (absolute.protocol === "https:") return absolute;
      } catch (error) {}

      if (!entry.includes(" ") && entry.includes(".")) {
        try { return new URL("https://" + entry); } catch (error) {}
      }
      return null;
    }

    function search() {
      var query = input.value.replace(/\s+/g, " ").trim();
      if (!query) {
        input.focus();
        return;
      }
      var direct = destinationFromEntry(query);
      if (direct) {
        openTarget(direct.href, direct.hostname.replace(/^www\./, ""));
        return;
      }
      var target = new URL("https://html.duckduckgo.com/html/");
      target.searchParams.set("q", query);
      openTarget(target.href, query);
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      search();
    });
    input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      form.requestSubmit();
    });
    retry.addEventListener("click", function () {
      if (currentTarget) openTarget(currentTarget, currentQuery);
    });
    if (startClose) startClose.addEventListener("click", function () {
      if (hostWindow) closeWindow(hostWindow);
    });
    if (startPlus) startPlus.addEventListener("click", function () {
      openNewTabShell(true);
    });
    browser.addEventListener("neo-browser-open", function (event) {
      var detail = event.detail || {};
      if (detail.page === "sign-in") {
        openSignInPage();
        return;
      }
      if (detail.target) openTarget(detail.target, detail.label || "Web page");
    });
    if (hostWindow) hostWindow._neoBrowserCleanup = stopRequest;
    var warmBrowse = function () { prepareBrowserEngine().catch(function () {}); };
    if ("requestIdleCallback" in window) window.requestIdleCallback(warmBrowse, { timeout: 900 });
    else window.setTimeout(warmBrowse, 120);
    requestAnimationFrame(function () {
      if (initialTarget) openTarget(initialTarget, initialLabel || "Web app");
      else input.focus({ preventScroll: true });
    });
  }

  function nativeChatKey(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  }

  function nativeChatSession() {
    var token = "";
    var username = "";
    try { token = localStorage.getItem("ugp_token") || ""; } catch (error) {}
    if (token.indexOf("static-firebase:") === 0) {
      try { username = decodeURIComponent(token.slice(16)); } catch (error) {}
    }
    var session = readJson("ugp_session", {}) || {};
    username = token ? String(username || session.username || session.id || "").trim() : "";
    return { username: username, id: token && username ? nativeChatKey(username) : "", token: token && username ? token : "" };
  }

  function nativeChatEndpoint(path) {
    var endpoint = String(path || "");
    if (!endpoint.startsWith("/")) endpoint = "/" + endpoint;
    return window.location.protocol === "file:"
      ? "http://127.0.0.1:4195" + endpoint
      : endpoint;
  }

  function nativeChatStateRequest(session, parentSignal, compact) {
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 6500);
    var abort = function () { controller.abort(); };
    if (parentSignal) parentSignal.addEventListener("abort", abort, { once: true });
    return fetch(nativeChatEndpoint("/.netlify/functions/chat-state" + (compact ? "?compact=1" : "")), {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Authorization: "Bearer " + String(session && session.token || "") },
      signal: controller.signal
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok) {
          var requestError = new Error(payload.detail || "Messages could not connect.");
          requestError.status = response.status;
          throw requestError;
        }
        return payload;
      });
    }).finally(function () {
      window.clearTimeout(timer);
      if (parentSignal) parentSignal.removeEventListener("abort", abort);
    });
  }

  function nativeChatRows(raw) {
    var rows = Array.isArray(raw)
      ? raw.map(function (message, index) { return [message && (message.firebaseKey || message.id) || String(index), message]; })
      : (raw && typeof raw === "object" ? Object.entries(raw) : []);
    return rows.filter(function (entry) { return entry[1] && !entry[1].deleted; }).map(function (entry) {
      var message = entry[1];
      return Object.assign({}, message, {
        firebaseKey: String(message.firebaseKey || entry[0]),
        id: String(message.id || entry[0]),
        clientId: String(message.clientId || ""),
        room: String(message.room || "global"),
        user: String(message.user || message.username || "Guest"),
        text: String(message.text || message.body || message.message || ""),
        time: Number(message.time || message.createdAt || message.updatedAt || 0)
      });
    }).filter(function (message) { return message.text; }).sort(function (a, b) { return a.time - b.time; });
  }

  function nativeChatMembers(room) {
    var source = Array.isArray(room && room.members) ? room.members : (room && room.members && typeof room.members === "object" ? Object.keys(room.members) : []);
    return source.map(function (member) { return nativeChatKey(typeof member === "string" ? member : member && (member.id || member.username)); }).filter(Boolean);
  }

  function nativeChatAccount(accounts, id) {
    if (accounts[id]) return accounts[id];
    return Object.values(accounts).find(function (account) { return nativeChatKey(account && (account.username || account.id)) === id; }) || {};
  }

  function nativeChatAvatar(account) {
    var source = String(account && (account.avatar || (account.profile && account.profile.avatar) || account.profilePicture || account.profilePic || account.photoURL || account.pfp || ""));
    return /^(?:data:image\/(?:png|jpeg|webp|gif);base64,|https:\/\/)/i.test(source) ? source : "";
  }

  function applyNativeChatAvatar(element, account, name) {
    var label = String((account && account.username) || name || "?").trim();
    var hue = Array.from(label).reduce(function (sum, char) { return sum + char.charCodeAt(0); }, 0) % 360;
    element.textContent = (label[0] || "?").toUpperCase();
    element.style.setProperty("--avatar-hue", String(hue));
    var source = nativeChatAvatar(account);
    if (source) {
      var image = document.createElement("img");
      image.alt = "";
      image.src = source;
      element.replaceChildren(image);
    }
  }

  function nativeChatTime(stamp) {
    if (!stamp) return "";
    var date = new Date(stamp);
    var today = new Date();
    if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function wireMessagesApp(scope) {
    var app = scope.querySelector("[data-messages-app]");
    if (!app || app.dataset.ready === "true") return;
    app.dataset.ready = "true";
    var hostWindow = scope.closest(".neo-window");
    var pinnedSection = app.querySelector("[data-chat-pinned-section]");
    var pinnedList = app.querySelector("[data-chat-pinned-list]");
    var roomList = app.querySelector("[data-chat-room-list]");
    var serverSection = app.querySelector("[data-chat-server-section]");
    var serverList = app.querySelector("[data-chat-server-list]");
    var searchInput = app.querySelector("[data-chat-search]");
    var composeButton = app.querySelector("[data-chat-compose]");
    var thread = app.querySelector("[data-chat-thread]");
    var input = app.querySelector("[data-chat-input]");
    var form = app.querySelector("[data-chat-form]");
    var sendButton = app.querySelector("[data-chat-send]");
    var feedback = app.querySelector("[data-chat-feedback]");
    var accountTag = app.querySelector("[data-chat-account]");
    var signInButton = app.querySelector("[data-chat-sign-in]");
    var connection = app.querySelector("[data-chat-connection]");
    var connectionDot = app.querySelector("[data-chat-connection-dot]");
    var title = app.querySelector("[data-chat-title]");
    var subtitle = app.querySelector("[data-chat-subtitle]");
    var headingAvatar = app.querySelector("[data-chat-heading-avatar]");
    var profileDialog = app.querySelector("[data-chat-profile]");
    var profileAvatar = app.querySelector("[data-chat-profile-avatar]");
    var profileName = app.querySelector("[data-chat-profile-name]");
    var profileStatus = app.querySelector("[data-chat-profile-status]");
    var profileFeedback = app.querySelector("[data-chat-profile-feedback]");
    var profileDm = app.querySelector("[data-chat-profile-dm]");
    var state = { session: null, accounts: {}, rooms: {}, recent: [], local: {}, people: [], selected: "global", profileUser: "", loading: true, error: "", search: "", searchTimer: 0, searchController: null, controller: null, refreshRequest: null, poll: 0, pollFailures: 0, loadVersion: 0, pendingCount: 0, sendRequests: {}, slowUntil: 0, slowTimer: 0, destroyed: false };

    function roomObjects() {
      if (!state.session || !state.session.id) return [];
      return Object.entries(state.rooms || {}).map(function (entry) {
        return entry[1] && typeof entry[1] === "object" ? Object.assign({}, entry[1], { id: entry[1].id || entry[0] }) : null;
      }).filter(function (room) {
        var kind = String(room && (room.kind || room.type) || "").toLowerCase();
        return room && (room.private === true || kind === "dm" || kind === "group") && nativeChatMembers(room).includes(state.session.id);
      }).sort(function (a, b) { return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0); });
    }

    function serverObjects() {
      return Object.entries(state.rooms || {}).map(function (entry) {
        return entry[1] && typeof entry[1] === "object" ? Object.assign({}, entry[1], { id: entry[1].id || entry[0] }) : null;
      }).filter(function (room) {
        var kind = String(room && (room.kind || room.type) || "").toLowerCase();
        return room && room.private !== true && (kind === "server" || kind === "public" || kind === "channel");
      }).sort(function (a, b) { return String(a.name || a.title || a.id).localeCompare(String(b.name || b.title || b.id)); });
    }

    function roomById(id) { return roomObjects().concat(serverObjects()).find(function (room) { return String(room.id) === String(id); }); }
    function isServerRoom(room) {
      var kind = String(room && (room.kind || room.type) || "").toLowerCase();
      return kind === "server" || kind === "public" || kind === "channel";
    }
    function otherRoomAccount(room) {
      var other = nativeChatMembers(room).find(function (id) { return id !== state.session.id; });
      return nativeChatAccount(state.accounts, other || "");
    }
    function roomName(id) {
      if (id === "global") return "Global Chat";
      var room = roomById(id) || {};
      if (isServerRoom(room)) return String(room.name || room.title || "Server");
      var other = otherRoomAccount(room);
      return String(room.name || room.title || other.username || "Private Chat");
    }
    function messageIdentity(message) {
      if (!message) return "";
      return String(message.clientId ? "client:" + message.clientId : (message.firebaseKey ? "firebase:" + message.firebaseKey : "id:" + message.id));
    }
    function messagesFor(id) {
      var unique = new Map();
      (state.local[id] || []).forEach(function (message) { unique.set(messageIdentity(message), message); });
      state.recent.filter(function (message) { return message.room === id; }).forEach(function (message) {
        unique.set(messageIdentity(message), message);
        if (message.clientId) unique.delete("id:" + message.clientId);
      });
      return Array.from(unique.values()).sort(function (a, b) { return a.time - b.time; }).slice(-100);
    }
    function setConnection(text, online) {
      connection.textContent = text;
      connectionDot.classList.toggle("is-online", Boolean(online));
      connectionDot.classList.toggle("is-connecting", !online && text === "Reconnecting...");
      connectionDot.setAttribute("aria-label", online ? "Online" : text);
    }
    function canCompose() {
      return Boolean(state.session && state.session.id && state.session.token && !state.loading && !state.error && state.accounts[state.session.id]);
    }
    function slowModeRemaining() {
      return Math.max(0, Number(state.slowUntil || 0) - Date.now());
    }
    function syncComposerState() {
      var enabled = canCompose();
      input.disabled = !enabled;
      sendButton.disabled = !enabled || slowModeRemaining() > 0 || !String(input.value || "").trim();
      form.setAttribute("aria-busy", state.pendingCount ? "true" : "false");
    }
    function beginSlowMode(duration) {
      window.clearInterval(state.slowTimer);
      state.slowUntil = Date.now() + Math.max(250, Number(duration || NEO_CHAT_SLOW_MODE_MS));
      function renderSlowMode() {
        var remaining = slowModeRemaining();
        if (remaining <= 0) {
          window.clearInterval(state.slowTimer);
          state.slowTimer = 0;
          state.slowUntil = 0;
          if (feedback.dataset.slowMode === "true") {
            feedback.textContent = "";
            delete feedback.dataset.slowMode;
          }
          syncComposerState();
          return;
        }
        feedback.dataset.slowMode = "true";
        feedback.textContent = "Slow mode: send again in " + Math.max(1, Math.ceil(remaining / 1000)) + "s.";
        syncComposerState();
      }
      renderSlowMode();
      state.slowTimer = window.setInterval(renderSlowMode, 250);
    }

    function renderHeader() {
      if (!state.session || !state.session.id) {
        title.textContent = "Messages";
        subtitle.textContent = "Choose a name to continue";
        thread.setAttribute("aria-label", "Messages name setup");
        headingAvatar.classList.remove("is-global");
        applyNativeChatAvatar(headingAvatar, {}, "M");
        return;
      }
      var name = roomName(state.selected);
      var room = roomById(state.selected);
      var account = state.selected === "global" || isServerRoom(room) ? {} : otherRoomAccount(room || {});
      title.textContent = name;
      subtitle.textContent = state.error ? "Unavailable" : (state.selected === "global" ? "Shared public conversation · Slow mode 5s" : (isServerRoom(room) ? "Public server · Slow mode 5s" : "Private conversation · Slow mode 5s"));
      thread.setAttribute("aria-label", name + " messages");
      headingAvatar.classList.toggle("is-global", state.selected === "global");
      applyNativeChatAvatar(headingAvatar, account, state.selected === "global" ? "G" : name);
    }

    function createRoomButton(room, pinned) {
        var id = String(room.id);
        var rows = messagesFor(id);
        var latest = rows[rows.length - 1];
        var button = document.createElement("button");
        button.type = "button";
        button.className = (pinned ? "messages-pinned-room" : "messages-room") + (id === state.selected ? " is-active" : "") + (id === "global" ? " is-global" : "");
        button.dataset.chatRoom = id;
        button.setAttribute("aria-pressed", id === state.selected ? "true" : "false");
        var avatar = document.createElement("span");
        avatar.className = "messages-avatar";
        applyNativeChatAvatar(avatar, id === "global" || isServerRoom(room) ? {} : otherRoomAccount(room), id === "global" ? "G" : roomName(id));
        if (pinned) {
          var label = document.createElement("strong");
          label.textContent = roomName(id);
          button.append(avatar, label);
          return button;
        }
        var copy = document.createElement("span");
        copy.className = "messages-room-copy";
        var strong = document.createElement("strong");
        strong.textContent = roomName(id);
        var small = document.createElement("small");
        small.textContent = latest ? ((nativeChatKey(latest.user) === (state.session && state.session.id) ? "You: " : "") + latest.text) : "No messages yet";
        copy.append(strong, small);
        var time = document.createElement("time");
        time.textContent = latest ? nativeChatTime(latest.time) : "";
        button.append(avatar, copy, time);
        return button;
    }

    function renderRooms() {
      pinnedList.textContent = "";
      roomList.textContent = "";
      if (serverList) serverList.textContent = "";
      if (!state.session || !state.session.id) {
        pinnedSection.hidden = true;
        if (serverSection) serverSection.hidden = true;
        var signedOutCopy = document.createElement("p");
        signedOutCopy.className = "messages-room-empty";
        signedOutCopy.textContent = "Choose a name to view your conversations.";
        roomList.appendChild(signedOutCopy);
        return;
      }
      if (state.loading) {
        pinnedSection.hidden = false;
        var pinnedLoading = document.createElement("div");
        pinnedLoading.className = "messages-pinned-loading";
        pinnedLoading.setAttribute("aria-hidden", "true");
        pinnedLoading.innerHTML = "<span></span>";
        pinnedList.appendChild(pinnedLoading);
        var roomLoading = document.createElement("div");
        roomLoading.className = "messages-room-loading";
        roomLoading.setAttribute("aria-hidden", "true");
        roomLoading.innerHTML = "<span></span><span></span><span></span>";
        roomList.appendChild(roomLoading);
        if (serverSection) serverSection.hidden = true;
        return;
      }
      var query = state.search.toLowerCase();
      var globalRoom = { id: "global", name: "Global Chat" };
      var showGlobal = roomName(globalRoom.id).toLowerCase().includes(query);
      pinnedSection.hidden = !showGlobal;
      if (showGlobal) pinnedList.appendChild(createRoomButton(globalRoom, true));

      var rooms = roomObjects().filter(function (room) { return roomName(room.id).toLowerCase().includes(query); });
      rooms.forEach(function (room) {
        roomList.appendChild(createRoomButton(room, false));
      });

      if (query) {
        state.people.filter(function (person) {
          var id = nativeChatKey(person && person.username);
          return id && id !== (state.session && state.session.id) && !rooms.some(function (room) { return nativeChatMembers(room).includes(id); });
        }).forEach(function (person) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "messages-room messages-person-result";
          button.dataset.chatUser = String(person.username || "");
          var avatar = document.createElement("span");
          avatar.className = "messages-avatar";
          applyNativeChatAvatar(avatar, person, person.username);
          var copy = document.createElement("span");
          copy.className = "messages-room-copy";
          var strong = document.createElement("strong");
          strong.textContent = String(person.username || "Member");
          var small = document.createElement("small");
          small.textContent = "Start a direct message";
          copy.append(strong, small);
          button.append(avatar, copy);
          roomList.appendChild(button);
        });
      }

      if (!roomList.children.length) {
        var empty = document.createElement("p");
        empty.className = "messages-room-empty";
        empty.textContent = query ? "No people or conversations found." : "No recent conversations.";
        roomList.appendChild(empty);
      }

      var servers = serverObjects().filter(function (room) { return roomName(room.id).toLowerCase().includes(query); });
      if (serverSection) serverSection.hidden = !servers.length;
      if (serverList) {
        servers.forEach(function (room) { serverList.appendChild(createRoomButton(room, false)); });
      }
    }

    function threadState(heading, copy, busy) {
      thread.textContent = "";
      var box = document.createElement("div");
      box.className = "messages-thread-state";
      if (busy) {
        var spinner = document.createElement("span");
        spinner.className = "library-spinner";
        spinner.setAttribute("aria-hidden", "true");
        box.appendChild(spinner);
      }
      var strong = document.createElement("strong");
      strong.textContent = heading;
      var paragraph = document.createElement("p");
      paragraph.textContent = copy;
      box.append(strong, paragraph);
      thread.appendChild(box);
    }

    function renderSignedOut() {
      thread.textContent = "";
      var box = document.createElement("div");
      box.className = "messages-thread-state messages-auth-state";
      var icon = document.createElement("span");
      icon.className = "messages-auth-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = '<svg class="icon"><use href="#i-chat"></use></svg>';
      var strong = document.createElement("strong");
      strong.textContent = "Choose your name";
      var paragraph = document.createElement("p");
      paragraph.textContent = "Pick a name to join Global Chat and direct messages.";
      var action = document.createElement("button");
      action.type = "button";
      action.className = "messages-auth-action";
      action.textContent = "Choose name";
      action.addEventListener("click", function () { openBrowserPage("sign-in", "Choose a name"); });
      box.append(icon, strong, paragraph, action);
      thread.appendChild(box);
    }

    function renderThread(forceBottom) {
      renderHeader();
      if (!state.session || !state.session.id || !state.session.token) { renderSignedOut(); return; }
      if (state.loading) { threadState("Opening Messages", "Loading recent conversations.", true); return; }
      if (state.error) { threadState("Messages unavailable", state.error, false); return; }
      var rows = messagesFor(state.selected);
      if (!rows.length) { threadState("No messages yet", "Start the conversation when you are ready.", false); return; }
      var atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 70;
      thread.textContent = "";
      rows.forEach(function (message, index) {
        var own = nativeChatKey(message.user) === state.session.id;
        var previous = rows[index - 1];
        var next = rows[index + 1];
        var messageDate = new Date(message.time || Date.now());
        var previousDate = previous ? new Date(previous.time || Date.now()) : null;
        if (!previousDate || previousDate.toDateString() !== messageDate.toDateString()) {
          var separator = document.createElement("time");
          separator.className = "native-message-date";
          separator.dateTime = messageDate.toISOString();
          separator.textContent = messageDate.toDateString() === new Date().toDateString()
            ? "Today " + messageDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : messageDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + "  " + messageDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          thread.appendChild(separator);
        }
        var groupedWithPrevious = Boolean(previous && nativeChatKey(previous.user) === nativeChatKey(message.user) && message.time - previous.time < 300000 && previousDate.toDateString() === messageDate.toDateString());
        var groupedWithNext = Boolean(next && nativeChatKey(next.user) === nativeChatKey(message.user) && next.time - message.time < 300000 && new Date(next.time || Date.now()).toDateString() === messageDate.toDateString());
        var article = document.createElement("article");
        article.className = "native-message" + (own ? " is-own" : "") + (!groupedWithPrevious ? " is-group-start" : "") + (!groupedWithNext ? " is-group-end" : "") + (message.pending ? " is-pending" : "") + (message.failed ? " is-failed" : "");
        article.dataset.messageIdentity = messageIdentity(message);
        if (!own) {
          if (!groupedWithNext) {
            var avatar = document.createElement("span");
            avatar.className = "messages-avatar";
            applyNativeChatAvatar(avatar, nativeChatAccount(state.accounts, nativeChatKey(message.user)), message.user);
            article.appendChild(avatar);
          } else {
            var avatarSpacer = document.createElement("span");
            avatarSpacer.className = "messages-avatar-spacer";
            avatarSpacer.setAttribute("aria-hidden", "true");
            article.appendChild(avatarSpacer);
          }
        }
        var body = document.createElement("div");
        body.className = "native-message-body";
        if (!own && !groupedWithPrevious) {
          var author = document.createElement("button");
          author.type = "button";
          author.className = "native-message-author";
          author.textContent = message.user;
          author.dataset.chatUser = message.user;
          author.setAttribute("aria-label", "Open " + message.user + " profile");
          body.appendChild(author);
        }
        var bubble = document.createElement("div");
        bubble.className = "native-message-bubble";
        bubble.textContent = message.text;
        bubble.title = messageDate.toLocaleString();
        var meta = document.createElement("time");
        meta.className = "native-message-meta";
        meta.textContent = message.failed ? "Not Delivered" : (message.pending ? "Sending..." : (index === rows.length - 1 ? nativeChatTime(message.time) : ""));
        meta.dateTime = messageDate.toISOString();
        body.append(bubble, meta);
        if (message.failed && message.clientId) {
          var retryButton = document.createElement("button");
          retryButton.type = "button";
          retryButton.className = "native-message-retry";
          retryButton.dataset.chatRetry = message.clientId;
          retryButton.textContent = "Retry";
          retryButton.setAttribute("aria-label", "Retry message");
          body.appendChild(retryButton);
        }
        article.appendChild(body);
        thread.appendChild(article);
      });
      if (forceBottom || atBottom) requestAnimationFrame(function () { thread.scrollTop = thread.scrollHeight; });
    }

    function renderAll(forceBottom) { renderRooms(); renderThread(forceBottom); }

    function mergePeople(people) {
      (Array.isArray(people) ? people : []).forEach(function (person) {
        var id = nativeChatKey(person && person.username);
        if (id) state.accounts[id] = Object.assign({}, state.accounts[id] || {}, person);
      });
    }

    function searchPeople(query) {
      var clean = String(query || "").trim();
      if (clean.length < 2 || !state.session || !state.session.token) {
        state.people = [];
        renderRooms();
        return;
      }
      if (state.searchController) state.searchController.abort();
      state.searchController = new AbortController();
      var controller = state.searchController;
      fetch(nativeChatEndpoint("/.netlify/functions/search-chat-users?q=" + encodeURIComponent(clean)), {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Authorization: "Bearer " + state.session.token },
        signal: controller.signal
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (payload) {
          if (!response.ok) throw new Error(payload.detail || "Could not search people.");
          return payload.users || [];
        });
      }).then(function (people) {
        if (state.destroyed || controller !== state.searchController || clean !== state.search) return;
        state.people = people;
        mergePeople(people);
        renderRooms();
      }).catch(function (error) {
        if (!error || error.name !== "AbortError") {
          state.people = [];
          renderRooms();
        }
      });
    }

    function showProfile(username) {
      var clean = String(username || "").trim();
      var id = nativeChatKey(clean);
      if (!id || !profileDialog) return;
      state.profileUser = clean;
      var account = nativeChatAccount(state.accounts, id);
      profileName.textContent = String(account.username || clean);
      profileStatus.textContent = String(account.bio || account.mood || "NEO member").slice(0, 120);
      profileFeedback.textContent = "";
      profileDm.disabled = id === (state.session && state.session.id);
      profileDm.querySelector("span").textContent = profileDm.disabled ? "This is you" : "Message";
      applyNativeChatAvatar(profileAvatar, account, clean);
      if (typeof profileDialog.showModal === "function" && !profileDialog.open) profileDialog.showModal();
      else profileDialog.setAttribute("open", "");

      if (state.session && state.session.token) {
        fetch(nativeChatEndpoint("/.netlify/functions/search-chat-users?q=" + encodeURIComponent(clean) + "&exact=1"), {
          credentials: "same-origin",
          cache: "no-store",
          headers: { Authorization: "Bearer " + state.session.token }
        }).then(function (response) { return response.ok ? response.json() : { users: [] }; }).then(function (payload) {
          if (state.profileUser !== clean || !payload.users || !payload.users[0]) return;
          var person = payload.users[0];
          mergePeople([person]);
          profileName.textContent = person.username;
          profileStatus.textContent = String(person.bio || person.mood || "NEO member").slice(0, 120);
          applyNativeChatAvatar(profileAvatar, person, person.username);
        }).catch(function () {});
      }
    }

    function startDirectMessage(username) {
      var clean = String(username || "").trim();
      if (!clean || !state.session || !state.session.token || profileDm.disabled) return;
      profileDm.disabled = true;
      profileFeedback.textContent = "Opening conversation...";
      fetch(nativeChatEndpoint("/.netlify/functions/create-chat-room"), {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + state.session.token },
        body: JSON.stringify({ username: clean })
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (payload) {
          if (!response.ok) throw new Error(payload.detail || "Could not start the conversation.");
          return payload.room;
        });
      }).then(function (room) {
        if (!room || !room.id) throw new Error("The conversation response was incomplete.");
        state.rooms[room.id] = room;
        if (typeof profileDialog.close === "function") profileDialog.close();
        else profileDialog.removeAttribute("open");
        selectRoom(room.id);
      }).catch(function (error) {
        profileFeedback.textContent = error && error.message ? error.message : "Could not start the conversation.";
        profileDm.disabled = false;
      });
    }

    function roomSignature(rooms) {
      return Object.entries(rooms || {}).map(function (entry) {
        var room = entry[1] || {};
        return [entry[0], room.id, room.kind, room.type, room.private, room.name, room.title, room.updatedAt, nativeChatMembers(room).join(",")].join(":");
      }).sort().join("|");
    }

    function profileSignature(profiles) {
      return Object.entries(profiles || {}).map(function (entry) {
        var profile = entry[1] || {};
        return [entry[0], profile.username, profile.avatar, profile.bio, profile.mood, profile.status].join(":");
      }).sort().join("|");
    }

    function applyRecent(raw) {
      var rows = nativeChatRows(raw);
      var before = state.recent.map(function (message) { return [messageIdentity(message), message.time, message.user, message.room, message.text].join(":"); }).join("|");
      var after = rows.map(function (message) { return [messageIdentity(message), message.time, message.user, message.room, message.text].join(":"); }).join("|");
      var deliveredClients = new Set(rows.map(function (message) { return message.clientId; }).filter(Boolean));
      Object.keys(state.local).forEach(function (roomId) {
        state.local[roomId] = (state.local[roomId] || []).filter(function (message) {
          return !message.clientId || !deliveredClients.has(message.clientId);
        });
      });
      state.recent = rows;
      return before !== after;
    }

    function loadRecent(quiet) {
      if (!state.session || !state.session.id || state.destroyed) return Promise.resolve();
      if (state.refreshRequest) return state.refreshRequest;
      var sessionToken = state.session.token;
      state.refreshRequest = nativeChatStateRequest(state.session, state.controller.signal, true).then(function (payload) {
        if (!state.session || state.session.token !== sessionToken) return;
        if (state.destroyed) return;
        var beforeRooms = roomSignature(state.rooms);
        var beforeProfiles = profileSignature(state.accounts);
        state.rooms = payload.rooms || {};
        state.accounts = Object.assign({}, state.accounts, payload.profiles || {});
        if (payload.account && payload.account.id) state.accounts[payload.account.id] = Object.assign({}, state.accounts[payload.account.id] || {}, payload.account);
        state.error = "";
        var messagesChanged = applyRecent(payload.messages || []);
        var roomsChanged = beforeRooms !== roomSignature(state.rooms);
        var profilesChanged = beforeProfiles !== profileSignature(state.accounts);
        if (!quiet || messagesChanged || roomsChanged || profilesChanged) renderAll(!quiet);
        state.pollFailures = 0;
        setConnection("Online", true);
      }).catch(function (error) {
        if (state.destroyed) return;
        state.pollFailures += 1;
        if (!quiet || state.pollFailures >= 2) setConnection(quiet ? "Reconnecting..." : "Offline", false);
        if (!quiet) {
          state.error = error && error.name === "AbortError" ? "The chat service took too long to respond." : (error && error.message ? error.message : "Could not load recent messages.");
          renderAll();
        }
      }).finally(function () {
        state.refreshRequest = null;
      });
      return state.refreshRequest;
    }

    function startPolling() {
      window.clearInterval(state.poll);
      state.poll = window.setInterval(function () {
        if (!document.hidden && !state.destroyed) loadRecent(true);
      }, NEO_CHAT_POLL_MS);
    }

    function loadApp() {
      if (state.controller) state.controller.abort();
      Object.values(state.sendRequests).forEach(function (controller) { controller.abort(); });
      state.sendRequests = {};
      state.pendingCount = 0;
      window.clearInterval(state.slowTimer);
      state.slowTimer = 0;
      state.slowUntil = 0;
      state.refreshRequest = null;
      state.pollFailures = 0;
      window.clearInterval(state.poll);
      state.controller = new AbortController();
      var loadVersion = ++state.loadVersion;
      state.session = nativeChatSession();
      var signedIn = Boolean(state.session.id && state.session.token);
      state.loading = signedIn;
      state.error = "";
      state.accounts = {};
      state.rooms = {};
      state.recent = [];
      state.local = {};
      state.people = [];
      feedback.textContent = "";
      accountTag.textContent = signedIn ? state.session.username : "Name required";
      signInButton.hidden = signedIn;
      searchInput.disabled = !signedIn;
      composeButton.disabled = !signedIn;
      app.classList.toggle("is-signed-out", !signedIn);
      input.value = "";
      input.placeholder = signedIn ? "iMessage" : "Choose a name to message";
      syncComposerState();
      setConnection(signedIn ? "Checking name..." : "Name not set", false);
      renderAll();
      if (!signedIn) {
        state.loading = false;
        state.error = "";
        renderAll();
        return;
      }
      nativeChatStateRequest(state.session, state.controller.signal, false).then(function (payload) {
        if (state.destroyed || loadVersion !== state.loadVersion) return;
        var linkedUsername = String(payload.account && payload.account.username || "").trim();
        state.recent = nativeChatRows(payload.messages || []);
        state.rooms = payload.rooms || {};
        state.accounts = Object.assign({}, payload.profiles || {});
        state.loading = false;
        if (!linkedUsername) {
          state.error = "This chat name is not linked to Messages.";
          setConnection("Name not linked", false);
        } else {
          state.accounts[state.session.id] = Object.assign({}, state.accounts[state.session.id] || {}, payload.account || {}, { username: linkedUsername });
          searchInput.disabled = false;
          composeButton.disabled = false;
          input.placeholder = "iMessage";
          app.classList.remove("is-signed-out");
          setConnection("Online", true);
          startPolling();
        }
        syncComposerState();
        renderAll(true);
      }).catch(function (error) {
        if (state.destroyed || loadVersion !== state.loadVersion) return;
        state.loading = false;
        if (error && (error.status === 401 || error.status === 403)) {
          try {
            localStorage.removeItem("ugp_token");
            localStorage.removeItem("ugp_session");
          } catch (storageError) {}
          state.session = { username: "", id: "", token: "" };
          state.error = "";
          accountTag.textContent = "Name required";
          signInButton.hidden = false;
          searchInput.disabled = true;
          composeButton.disabled = true;
          input.placeholder = "Choose a name to message";
          app.classList.add("is-signed-out");
          setConnection("Name not set", false);
          syncComposerState();
          renderAll();
          return;
        }
        state.error = error && error.name === "AbortError" ? "The chat service took too long to respond." : (error && error.message ? error.message : "Could not connect to Messages.");
        setConnection("Offline", false);
        syncComposerState();
        renderAll();
      });
    }

    function selectRoom(id) {
      if (id !== "global" && !roomById(id)) return;
      state.selected = id;
      app.classList.add("is-conversation-open");
      feedback.textContent = "";
      renderAll(true);
      input.focus({ preventScroll: true });
    }

    function createClientMessageId() {
      var random = "";
      if (window.crypto && typeof window.crypto.getRandomValues === "function") {
        var bytes = new Uint32Array(2);
        window.crypto.getRandomValues(bytes);
        random = Array.from(bytes).map(function (value) { return value.toString(36); }).join("");
      } else {
        random = Math.random().toString(36).slice(2, 14);
      }
      return "c" + Date.now().toString(36) + random.slice(0, 20);
    }

    function sendMessage(text, retryMessage) {
      var clean = String(retryMessage ? retryMessage.text : text || "").trim();
      if (!clean || !canCompose()) return;
      if (slowModeRemaining() > 0) {
        beginSlowMode(slowModeRemaining());
        return;
      }
      var roomId = String(retryMessage ? retryMessage.room : state.selected || "global");
      if (roomId !== "global" && !roomById(roomId)) {
        feedback.textContent = "That conversation is no longer available.";
        return;
      }
      var clientId = String(retryMessage && retryMessage.clientId || createClientMessageId());
      if (state.sendRequests[clientId]) return;
      var optimistic = retryMessage || {
        id: clientId,
        clientId: clientId,
        room: roomId,
        user: state.session.username,
        text: clean,
        time: Date.now()
      };
      optimistic.pending = true;
      optimistic.failed = false;
      state.local[roomId] = state.local[roomId] || [];
      if (!state.local[roomId].some(function (item) { return item.clientId === clientId; })) state.local[roomId].push(optimistic);
      if (!retryMessage) {
        input.value = "";
        input.style.height = "38px";
      }
      feedback.textContent = "";
      state.pendingCount += 1;
      syncComposerState();
      renderAll(true);

      var requestVersion = state.loadVersion;
      var controller = new AbortController();
      var timeout = window.setTimeout(function () { controller.abort(); }, 8_000);
      state.sendRequests[clientId] = controller;
      fetch(nativeChatEndpoint("/.netlify/functions/send-chat-message"), {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + state.session.token },
        body: JSON.stringify({ text: clean, roomId: roomId, clientId: clientId }),
        signal: controller.signal
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (payload) {
          if (!response.ok) {
            var requestError = new Error(payload.detail || (response.status === 404 ? "Message sending is unavailable right now." : "Could not send message."));
            requestError.status = response.status;
            requestError.code = payload.code || "";
            requestError.retryAfterMs = Number(payload.retryAfterMs || 0);
            throw requestError;
          }
          if (!payload.message) throw new Error("The message service returned an incomplete response.");
          return payload.message;
        });
      }).then(function (message) {
        if (state.destroyed || requestVersion !== state.loadVersion) return;
        state.local[roomId] = (state.local[roomId] || []).filter(function (item) { return item.clientId !== clientId; });
        var delivered = nativeChatRows([message])[0];
        if (delivered && !state.recent.some(function (item) { return messageIdentity(item) === messageIdentity(delivered); })) state.recent.push(delivered);
        if (state.rooms[roomId]) state.rooms[roomId].updatedAt = Number(message.time || Date.now());
        beginSlowMode(NEO_CHAT_SLOW_MODE_MS);
        renderAll(true);
        window.setTimeout(function () { loadRecent(true); }, 250);
      }).catch(function (error) {
        if (state.destroyed || requestVersion !== state.loadVersion) return;
        if (error && error.code === "slow_mode") {
          state.local[roomId] = (state.local[roomId] || []).filter(function (item) { return item.clientId !== clientId; });
          beginSlowMode(error.retryAfterMs || NEO_CHAT_SLOW_MODE_MS);
          renderAll(true);
          return;
        }
        optimistic.pending = false;
        optimistic.failed = true;
        feedback.textContent = error && error.name === "AbortError"
          ? "Sending timed out. Retry when your connection is ready."
          : (error && error.message ? error.message : "Could not send message.");
        renderAll(true);
      }).finally(function () {
        window.clearTimeout(timeout);
        if (state.sendRequests[clientId] === controller) delete state.sendRequests[clientId];
        state.pendingCount = Math.max(0, state.pendingCount - 1);
        if (requestVersion === state.loadVersion) {
          syncComposerState();
          if (!state.destroyed) input.focus({ preventScroll: true });
        }
      });
    }

    app.addEventListener("click", function (event) {
      var retry = event.target.closest("[data-chat-retry]");
      if (retry) {
        event.preventDefault();
        var clientId = String(retry.dataset.chatRetry || "");
        var retryMessage = Object.values(state.local).flat().find(function (message) { return message.clientId === clientId; });
        if (retryMessage) sendMessage(retryMessage.text, retryMessage);
        return;
      }
      var person = event.target.closest("[data-chat-user]");
      if (person) {
        event.preventDefault();
        showProfile(person.dataset.chatUser);
        return;
      }
      var button = event.target.closest("[data-chat-room]");
      if (button) selectRoom(button.dataset.chatRoom);
    });
    searchInput.addEventListener("input", function (event) {
      state.search = event.target.value.trim();
      state.people = [];
      window.clearTimeout(state.searchTimer);
      renderRooms();
      if (state.search.length >= 2) state.searchTimer = window.setTimeout(function () { searchPeople(state.search); }, 220);
    });
    composeButton.addEventListener("click", function () {
      app.classList.remove("is-conversation-open");
      searchInput.focus({ preventScroll: true });
      searchInput.select();
    });
    signInButton.addEventListener("click", function () { openBrowserPage("sign-in", "Choose a name"); });
    app.querySelector("[data-chat-back]").addEventListener("click", function () { app.classList.remove("is-conversation-open"); });
    if (profileDm) profileDm.addEventListener("click", function () { startDirectMessage(state.profileUser); });
    if (hostWindow) hostWindow.addEventListener("neo-chat-open-section", function (event) {
      app.classList.remove("is-conversation-open");
      if (event.detail && event.detail.section === "servers" && serverSection) serverSection.scrollIntoView({ block: "start" });
    });
    input.addEventListener("input", function () {
      input.style.height = "38px";
      input.style.height = Math.min(input.scrollHeight, 92) + "px";
      syncComposerState();
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener("submit", function (event) { event.preventDefault(); sendMessage(input.value); });
    function handleAuthChanged() { if (!state.destroyed) loadApp(); }
    function handleVisibilityChanged() {
      if (!document.hidden && !state.destroyed && state.session && state.session.id) loadRecent(true);
    }
    window.addEventListener("neo-auth-changed", handleAuthChanged);
    document.addEventListener("visibilitychange", handleVisibilityChanged);
    if (hostWindow) hostWindow._neoMessagesCleanup = function () {
      state.destroyed = true;
      window.clearInterval(state.poll);
      window.clearInterval(state.slowTimer);
      window.clearTimeout(state.searchTimer);
      if (state.controller) state.controller.abort();
      if (state.searchController) state.searchController.abort();
      Object.values(state.sendRequests).forEach(function (controller) { controller.abort(); });
      window.removeEventListener("neo-auth-changed", handleAuthChanged);
      document.removeEventListener("visibilitychange", handleVisibilityChanged);
    };
    loadApp();
  }

  function mountFrame(app, body) {
    var loader = document.createElement("div");
    loader.className = "frame-loader";
    loader.innerHTML = "<span></span><p>Opening " + app.title + "...</p>";
    var fallback = document.createElement("div");
    fallback.className = "frame-error";
    var fallbackTitle = document.createElement("strong");
    var fallbackCopy = document.createElement("p");
    var fallbackActions = document.createElement("div");
    var retry = document.createElement("button");
    var direct = document.createElement("button");
    fallbackTitle.textContent = "This page is taking longer than expected";
    fallbackCopy.textContent = "You can retry the embedded page or open the existing route directly.";
    fallbackActions.className = "upload-actions";
    retry.className = "button primary";
    retry.type = "button";
    retry.setAttribute("data-frame-retry", "");
    retry.textContent = "Retry";
    direct.className = "button";
    direct.type = "button";
    direct.setAttribute("data-frame-direct", app.route);
    direct.innerHTML = iconMarkup("external") + "Open directly";
    fallbackActions.append(retry, direct);
    fallback.append(fallbackTitle, fallbackCopy, fallbackActions);
    var frame = document.createElement("iframe");
    frame.title = app.title;
    frame.loading = "eager";
    if (app.id === "browser") frame.setAttribute("fetchpriority", "high");
    frame.referrerPolicy = "same-origin";
    var frameSandbox = [
      "allow-same-origin",
      "allow-scripts",
      "allow-forms",
      "allow-popups",
      "allow-downloads",
      "allow-pointer-lock",
      "allow-presentation"
    ];
    if (app.id !== "browser") frameSandbox.push("allow-modals");
    frame.sandbox = frameSandbox.join(" ");
    frame.allow = "fullscreen; autoplay; gamepad; clipboard-read; clipboard-write";
    frame.setAttribute("allowfullscreen", "");
    frame.dataset.route = app.route;
    body.append(loader, fallback, frame);

    var timeout = 0;
    var hostWindow = body.closest(".neo-window");
    function handleEmbeddedMediaState(event) {
      if (event.source !== frame.contentWindow) return;
      var data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "neo-shell:video-route") {
        if (data.active === true) pauseMusicForVideoFocus();
        window.dispatchEvent(new CustomEvent("neo-media-priority", {
          detail: {
            source: "route-focus:" + app.id,
            active: data.active === true,
            kind: "video",
            pauseWallpaper: true
          }
        }));
        return;
      }
      if (data.type !== "neo-shell:media-state") return;
      var videoRoute = app.id === "youtube-app" || app.id === "browser";
      window.dispatchEvent(new CustomEvent("neo-media-state", {
        detail: {
          source: "route-media:" + app.id,
          appId: app.id,
          active: data.active === true,
          playing: data.playing === true,
          muted: data.muted === true,
          kind: videoRoute ? "video" : "media",
          pauseWallpaper: videoRoute
        }
      }));
    }
    function clearEmbeddedMediaState() {
      window.dispatchEvent(new CustomEvent("neo-media-priority", {
        detail: {
          source: "route-focus:" + app.id,
          active: false,
          kind: "video",
          pauseWallpaper: true
        }
      }));
      window.dispatchEvent(new CustomEvent("neo-media-state", {
        detail: {
          source: "route-media:" + app.id,
          appId: app.id,
          active: false,
          playing: false,
          muted: false,
          kind: "video",
          pauseWallpaper: true
        }
      }));
    }
    function relayNeoBrowserMessage(event) {
      if (app.id !== "browser" || event.source === frame.contentWindow) return;
      var data = event.data;
      if (!data || typeof data !== "object" || !Object.prototype.hasOwnProperty.call(data, "__neoBridge")) return;
      try {
        frame.contentWindow.postMessage(data, "*");
      } catch (_error) {
        // Ignore messages sent while the browser frame is being replaced.
      }
    }
    window.addEventListener("message", handleEmbeddedMediaState);
    if (app.id === "browser") window.addEventListener("message", relayNeoBrowserMessage);
    if (hostWindow) hostWindow._neoExtraCleanup = function () {
      window.removeEventListener("message", handleEmbeddedMediaState);
      if (app.id === "browser") window.removeEventListener("message", relayNeoBrowserMessage);
      clearEmbeddedMediaState();
    };
    function applyHostIntegration() {
      if (app.id !== "browser") return;
      try {
        var frameDocument = frame.contentDocument;
        if (!frameDocument || !frameDocument.head || frameDocument.getElementById("neo-os-browser-host-fixes")) return;
        var style = frameDocument.createElement("style");
        style.id = "neo-os-browser-host-fixes";
        style.textContent = "#spotOverlay{pointer-events:none!important}";
        frameDocument.head.appendChild(style);
      } catch (_error) {
        // The supplied browser remains usable if a future build becomes cross-origin.
      }
    }
    function beginLoad() {
      loader.classList.remove("is-complete");
      fallback.classList.remove("is-visible");
      window.clearTimeout(timeout);
      timeout = window.setTimeout(function () {
        loader.classList.add("is-complete");
        fallback.classList.add("is-visible");
      }, 9000);
      var frameLoad = window.NEOFrameLoader
        ? window.NEOFrameLoader.load(frame, app.route)
        : Promise.resolve().then(function () { frame.src = app.route; });
      frameLoad.catch(function (error) {
        if (error && error.name === "AbortError") return;
        window.clearTimeout(timeout);
        loader.classList.add("is-complete");
        fallback.classList.add("is-visible");
      });
    }
    frame.addEventListener("load", function () {
      window.clearTimeout(timeout);
      applyHostIntegration();
      loader.classList.add("is-complete");
      fallback.classList.remove("is-visible");
    });
    frame.addEventListener("error", function () {
      window.clearTimeout(timeout);
      loader.classList.add("is-complete");
      fallback.classList.add("is-visible");
    });
    retry.addEventListener("click", beginLoad);
    beginLoad();
  }

  function openApp(id) {
    var app = apps[id];
    if (!app) return null;
    if (app.launcher && !app.installed) {
      showToast("App not available", app.title + " is not available on this device.", "apps");
      return null;
    }
    if (id === "youtube-app") pauseMusicForVideoFocus();
    setLauncherOpen(false);
    if (app.launcher) recordRecentApp(id);
    var existing = openWindows.get(id);
    if (existing) {
      setWindowMinimized(existing, false);
      renderDock();
      activateWindow(existing);
      requestAnimationFrame(function () { existing.classList.add("is-open"); });
      return existing;
    }
    var cached = musicRuntime.restoreWindow(id, openWindows, renderDock, activateWindow);
    if (cached) return cached;
    return createWindow(app);
  }

  function openWallpaperSource(source) {
    var win = openApp("wallpaper");
    if (!win) return null;
    requestAnimationFrame(function () {
      var studio = win.querySelector("[data-wallpaper-studio]");
      if (!studio) return;
      studio.dataset.wallpaperSource = source === "workshop" ? "workshop" : (source === "discover" ? "discover" : "installed");
      studio.dataset.wallpaperView = "installed";
      refreshWallpaperStudio(studio);
      if (studio.dataset.wallpaperSource !== "installed") loadOnlineWallpapers(studio, studio.dataset.wallpaperSource);
    });
    return win;
  }

  function openBrowserTarget(target, label) {
    var win = openApp("browser");
    if (!win) return null;
    requestAnimationFrame(function () {
      var browser = win.querySelector("[data-neo-browser]");
      if (!browser) return;
      browser.dispatchEvent(new CustomEvent("neo-browser-open", { detail: { target: target, label: label || "Web page" } }));
    });
    return win;
  }

  function openBrowserPage(page, label) {
    var win = openApp("browser");
    if (!win) return null;
    requestAnimationFrame(function () {
      var browser = win.querySelector("[data-neo-browser]");
      if (!browser) return;
      browser.dispatchEvent(new CustomEvent("neo-browser-open", { detail: { page: page, label: label || "Web app" } }));
    });
    return win;
  }

  function activateWindow(win) {
    if (!win) return;
    openWindows.forEach(function (item) { item.classList.remove("is-active"); });
    win.classList.add("is-active");
    win.style.zIndex = String(++zIndex);
    var id = win.dataset.appId;
    var app = apps[id];
    if (app) {
      activeAppLabel.textContent = appDisplayTitle(app);
      activeAppLabel.hidden = app.hideName === true;
      renderActiveWidget(app);
      if (id === "stream") showStreamNowPlaying();
    }
  }

  function activateTopWindow() {
    var top = null;
    openWindows.forEach(function (win) {
      if (win.classList.contains("is-minimized")) return;
      if (!top || Number(win.style.zIndex || 0) > Number(top.style.zIndex || 0)) top = win;
    });
    if (top) activateWindow(top);
    else {
      activeAppLabel.textContent = "Desktop";
      renderActiveWidget(apps.browser);
    }
  }

  function stopWindowMedia(win, id) {
    if (id !== "stream") return;
    if (musicRuntime && typeof musicRuntime.stopWindow === "function") {
      try { musicRuntime.stopWindow(win, id); } catch (error) {}
    }
    if (window.NEO_FEATURES && typeof window.NEO_FEATURES.stopMusic === "function") {
      try { window.NEO_FEATURES.stopMusic(); } catch (error) {}
    } else if (featureRuntimePromise) {
      featureRuntimePromise.then(function (runtime) {
        if (runtime && typeof runtime.stopMusic === "function") {
          try { runtime.stopMusic(); } catch (error) {}
        }
      }).catch(function () {});
    }
    if (nowPlayingState && nowPlayingState.appId === "stream") {
      try { renderNowPlaying({ source: nowPlayingState.source, active: false }); } catch (error) {}
    }
    try { renderNowPlaying({ source: "browse-media:stream", active: false }); } catch (error) {}
  }

  function pauseMusicForVideoFocus() {
    if (!musicRuntime || typeof musicRuntime.pauseWindow !== "function") return false;
    var musicWindow = musicRuntime.getWindow("stream", openWindows);
    if (!musicWindow) return false;
    try { return musicRuntime.pauseWindow(musicWindow, "stream"); } catch (error) { return false; }
  }

  function closeWindow(win, forceDestroy) {
    if (!win) return;
    var id = win.dataset.appId;
    var app = apps[id];
    try {
      window.dispatchEvent(new CustomEvent("neo-window-state-change", {
        detail: { id: id || "", minimized: false, closed: true }
      }));
    } catch (error) {}
    try { if (!win.hidden) saveWindowState(win); } catch (error) {}
    try { stopWindowMedia(win, id); } catch (error) {}
    var cached = false;
    try {
      cached = Boolean(musicRuntime.cacheWindow(win, id, openWindows, app, forceDestroy, renderDock, activateTopWindow));
    } catch (error) {}
    if (cached) return;
    try { musicRuntime.dropWindow(id); } catch (error) {}
    if (window.NEOFrameLoader) {
      win.querySelectorAll("iframe").forEach(function (frame) {
        try { window.NEOFrameLoader.cancel(frame); } catch (error) {}
      });
    }
    try { if (win._neoResizeObserver) win._neoResizeObserver.disconnect(); } catch (error) {}
    try { if (typeof win._neoBrowserCleanup === "function") win._neoBrowserCleanup(); } catch (error) {}
    try { if (typeof win._neoMessagesCleanup === "function") win._neoMessagesCleanup(); } catch (error) {}
    try { if (typeof win._neoExtraCleanup === "function") win._neoExtraCleanup(); } catch (error) {}
    window.clearTimeout(win._neoResizeTimer);
    win.classList.add("is-closing");
    win.classList.remove("is-open", "is-active");
    window.setTimeout(function () {
      win.remove();
      openWindows.delete(id);
      try { renderDock(); } catch (error) {}
      try { activateTopWindow(); } catch (error) {}
    }, 220);
  }

  function minimizeWindow(win) {
    if (!win) return;
    if (document.activeElement && win.contains(document.activeElement)) document.activeElement.blur();
    setWindowMinimized(win, true);
    win.classList.remove("is-active");
    renderDock();
    activateTopWindow();
  }

  function setWindowMinimized(win, minimized) {
    if (!win) return;
    win.classList.toggle("is-minimized", minimized);
    win.toggleAttribute("inert", minimized);
    if (minimized) win.setAttribute("aria-hidden", "true");
    else win.removeAttribute("aria-hidden");
    window.dispatchEvent(new CustomEvent("neo-window-state-change", {
      detail: { id: win.dataset.appId || "", minimized: Boolean(minimized), closed: false }
    }));
  }

  function toggleMaximize(win) {
    if (!win || isSmallScreen()) return;
    if (!win.classList.contains("is-maximized")) saveWindowState(win);
    win.classList.toggle("is-maximized");
    var id = win.dataset.appId;
    windowStates[id] = Object.assign({}, windowStates[id] || {}, { maximized: win.classList.contains("is-maximized") });
    writeJson(WINDOW_STATE_KEY, windowStates);
    activateWindow(win);
  }

  function saveWindowState(win) {
    if (!win || isSmallScreen() || win.classList.contains("is-minimized")) return;
    var id = win.dataset.appId;
    var current = Object.assign({}, windowStates[id] || {});
    current.maximized = win.classList.contains("is-maximized");
    if (!current.maximized) {
      var rect = win.getBoundingClientRect();
      current.left = Math.round(rect.left);
      current.top = Math.round(rect.top);
      current.width = Math.round(rect.width);
      current.height = Math.round(rect.height);
    }
    windowStates[id] = current;
    writeJson(WINDOW_STATE_KEY, windowStates);
  }

  function wireWindowPersistence(win) {
    win.addEventListener("neo-window-resized", function () {
      saveWindowState(win);
    });
  }

  function wireWindowDrag(win) {
    var chrome = win.querySelector(".window-chrome");
    var drag = null;
    var dragFrame = 0;

    function paintDrag() {
      dragFrame = 0;
      if (!drag) return;
      win.style.transform = "translate3d(" + (drag.nextLeft - drag.left) + "px," + (drag.nextTop - drag.top) + "px,0)";
    }

    chrome.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || event.target.closest("button") || isSmallScreen() || win.classList.contains("is-maximized")) return;
      activateWindow(win);
      var rect = win.getBoundingClientRect();
      var layerRect = windowLayer.getBoundingClientRect();
      var left = rect.left - layerRect.left;
      var top = rect.top - layerRect.top;
      drag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: left,
        top: top,
        nextLeft: left,
        nextTop: top,
        maxLeft: Math.max(0, layerRect.width - 120),
        maxTop: Math.max(0, layerRect.height - 68)
      };
      win.classList.add("is-dragging");
      chrome.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    chrome.addEventListener("pointermove", function (event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.nextLeft = clamp(drag.left + event.clientX - drag.x, 0, drag.maxLeft);
      drag.nextTop = clamp(drag.top + event.clientY - drag.y, 0, drag.maxTop);
      if (!dragFrame) dragFrame = requestAnimationFrame(paintDrag);
    });
    function endDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (dragFrame) cancelAnimationFrame(dragFrame);
      dragFrame = 0;
      var nextLeft = drag.nextLeft;
      var nextTop = drag.nextTop;
      drag = null;
      win.style.left = Math.round(nextLeft) + "px";
      win.style.top = Math.round(nextTop) + "px";
      win.style.transform = "";
      // Commit the layout position while drag transitions are still disabled.
      // Otherwise the temporary translate and the new left/top can appear together.
      win.getBoundingClientRect();
      win.classList.remove("is-dragging");
      if (chrome.hasPointerCapture(event.pointerId)) chrome.releasePointerCapture(event.pointerId);
      saveWindowState(win);
    }
    chrome.addEventListener("pointerup", endDrag);
    chrome.addEventListener("pointercancel", endDrag);
    chrome.addEventListener("lostpointercapture", endDrag);
    chrome.addEventListener("dblclick", function (event) {
      if (!event.target.closest("button")) toggleMaximize(win);
    });
    win.addEventListener("pointerdown", function () { activateWindow(win); });
  }

  function wireWidgetDrag() {
    if (!widgetLayer) return;
    widgetLayer.querySelectorAll(".neo-widget").forEach(function (widget) {
      var drag = null;
      var id = widget.dataset.widget;
      widget.addEventListener("pointerdown", function (event) {
        if (settings.widgetLock || event.button !== 0 || event.target.closest("button, input, select, a") || isSmallScreen()) return;
        var saved = widgetLayout[id] || { x: 0, y: 0 };
        drag = { x: event.clientX, y: event.clientY, startX: saved.x || 0, startY: saved.y || 0 };
        widget.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      widget.addEventListener("pointermove", function (event) {
        if (!drag) return;
        var x = drag.startX + event.clientX - drag.x;
        var y = drag.startY + event.clientY - drag.y;
        widget.style.transform = "translate3d(" + x + "px," + y + "px,0)";
        widgetLayout[id] = { x: Math.round(x), y: Math.round(y) };
      });
      function finish(event) {
        if (!drag) return;
        drag = null;
        if (widget.hasPointerCapture(event.pointerId)) widget.releasePointerCapture(event.pointerId);
        writeJson(WIDGET_LAYOUT_KEY, widgetLayout);
      }
      widget.addEventListener("pointerup", finish);
      widget.addEventListener("pointercancel", finish);
    });
  }

  function applyWidgetLayout() {
    if (!widgetLayer) return;
    widgetLayer.querySelectorAll(".neo-widget").forEach(function (widget) {
      var saved = widgetLayout[widget.dataset.widget] || { x: 0, y: 0 };
      widget.style.transform = "translate3d(" + (saved.x || 0) + "px," + (saved.y || 0) + "px,0)";
    });
  }

  function resetLayout() {
    widgetLayout = {};
    windowStates = {};
    writeJson(WIDGET_LAYOUT_KEY, widgetLayout);
    writeJson(WINDOW_STATE_KEY, windowStates);
    applyWidgetLayout();
    openWindows.forEach(function (win) {
      win.classList.remove("is-maximized");
      win.style.left = "8%";
      win.style.top = "9%";
    });
    showToast("Layout reset", "Widgets and windows returned to their defaults.", "check");
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function boundedDistance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    var previous = new Array(b.length + 1);
    var current = new Array(b.length + 1);
    for (var j = 0; j <= b.length; j++) previous[j] = j;
    for (var i = 1; i <= a.length; i++) {
      current[0] = i;
      var rowMin = current[0];
      for (j = 1; j <= b.length; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
        rowMin = Math.min(rowMin, current[j]);
      }
      if (rowMin > limit) return limit + 1;
      var swap = previous;
      previous = current;
      current = swap;
    }
    return previous[b.length];
  }

  function scoreEntry(entry, query) {
    var name = entry.searchName;
    if (name === query) return 0;
    if (name.indexOf(query) === 0) return 1 + name.length / 10000;
    var position = name.indexOf(query);
    if (position !== -1) return 2 + position / 100 + name.length / 10000;
    if (query.length < 3) return Infinity;
    var limit = query.length >= 8 ? 2 : 1;
    var words = name.split(" ");
    var best = Infinity;
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      if (Math.abs(word.length - query.length) > limit) continue;
      var distance = boundedDistance(word, query, limit);
      if (distance <= limit) best = Math.min(best, 4 + distance + word.length / 1000);
    }
    return best;
  }

  function loadCatalog() {
    if (catalog) return Promise.resolve(catalog);
    if (catalogPromise) return catalogPromise;
    catalogPromise = fetch(projectAssetUrl("games/index.json"), { credentials: "omit", cache: "force-cache" })
      .then(function (response) {
        if (!response.ok) throw new Error("Catalog request failed");
        return response.json();
      })
      .then(function (entries) {
        catalog = Array.isArray(entries) ? entries.map(function (entry) {
          return {
            name: String(entry.name || entry.title || entry.slug || "Untitled game"),
            slug: String(entry.slug || ""),
            file: String(entry.file || ""),
            searchName: normalizeText(entry.name || entry.title || entry.slug)
          };
        }) : [];
        return catalog;
      })
      .catch(function (error) {
        catalogPromise = null;
        throw error;
      });
    return catalogPromise;
  }

  function loadCoverManifest() {
    if (coverManifestLoaded) return Promise.resolve(coverManifest);
    if (coverManifestPromise) return coverManifestPromise;
    coverManifestPromise = fetch(projectAssetUrl("games/covers.json?v=20260802-neo-v2"), { credentials: "omit", cache: "force-cache" })
      .then(function (response) {
        if (!response.ok) throw new Error("Cover manifest request failed");
        return response.json();
      })
      .then(function (entries) {
        coverManifest = entries && typeof entries === "object" && !Array.isArray(entries) ? entries : Object.create(null);
        coverManifestLoaded = true;
        return coverManifest;
      })
      .catch(function () {
        coverManifestPromise = null;
        return coverManifest;
      });
    return coverManifestPromise;
  }

  function wireSearchApp(body) {
    var input = body.querySelector("[data-zone-search]");
    var results = body.querySelector("[data-search-results]");
    var state = body.querySelector("[data-search-state]");
    var count = body.querySelector("[data-search-count]");
    var activeIndex = -1;
    if (!input || !results) return;

    function runSearch() {
      var query = normalizeText(input.value);
      activeIndex = -1;
      if (!query) {
        results.textContent = "";
        state.hidden = false;
        count.textContent = "Ready";
        return;
      }
      count.textContent = "Loading";
      Promise.all([loadCatalog(), loadCoverManifest()]).then(function (loaded) {
        var entries = loaded[0];
        var matches = [];
        for (var i = 0; i < entries.length; i++) {
          var score = scoreEntry(entries[i], query);
          if (Number.isFinite(score)) matches.push({ entry: entries[i], score: score });
        }
        matches.sort(function (a, b) { return a.score - b.score || a.entry.name.localeCompare(b.entry.name); });
        renderSearchResults(results, state, count, matches.slice(0, 24), query);
      }).catch(function () {
        results.textContent = "";
        state.hidden = false;
        state.querySelector("strong").textContent = "Catalog unavailable";
        state.querySelector("p").textContent = "Open the library directly or try again.";
        count.textContent = "Error";
      });
    }

    input.addEventListener("input", function () {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(runSearch, 80);
    });
    input.addEventListener("keydown", function (event) {
      var items = Array.from(results.querySelectorAll(".search-result"));
      if (!items.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        items[activeIndex].click();
        return;
      } else {
        return;
      }
      items.forEach(function (item, index) {
        item.setAttribute("aria-selected", index === activeIndex ? "true" : "false");
      });
      items[activeIndex].scrollIntoView({ block: "nearest" });
    });
    requestAnimationFrame(function () { input.focus(); });
  }

  function wireLibraryApp(body) {
    var input = body.querySelector("[data-library-search]");
    var grid = body.querySelector("[data-library-grid]");
    var state = body.querySelector("[data-library-state]");
    var count = body.querySelector("[data-library-count]");
    var visible = body.querySelector("[data-library-visible]");
    var more = body.querySelector("[data-library-more]");
    var pageSize = 48;
    var matches = [];
    var rendered = 0;
    var filterTimer = 0;
    if (!input || !grid || !state || !count || !visible || !more) return;

    function setState(title, copy, loading) {
      state.hidden = false;
      state.classList.toggle("is-loading", Boolean(loading));
      state.querySelector("strong").textContent = title;
      state.querySelector("p").textContent = copy;
    }

    function renderNextPage() {
      var end = Math.min(rendered + pageSize, matches.length);
      var fragment = document.createDocumentFragment();
      for (var i = rendered; i < end; i++) fragment.appendChild(createLibraryCard(matches[i]));
      grid.appendChild(fragment);
      rendered = end;
      visible.textContent = String(rendered);
      more.hidden = rendered >= matches.length;
      state.hidden = matches.length > 0;
    }

    function applyFilter(entries) {
      var query = normalizeText(input.value);
      grid.textContent = "";
      rendered = 0;
      matches = query ? entries.map(function (entry) {
        return { entry: entry, score: scoreEntry(entry, query) };
      }).filter(function (match) {
        return Number.isFinite(match.score);
      }).sort(function (a, b) {
        return a.score - b.score || a.entry.name.localeCompare(b.entry.name);
      }).map(function (match) {
        return match.entry;
      }) : entries;
      count.textContent = matches.length.toLocaleString() + " games";
      if (!matches.length) {
        visible.textContent = "0";
        more.hidden = true;
        setState("No HTML games found", "Try a shorter title or clear the search.", false);
        return;
      }
      renderNextPage();
    }

    Promise.all([loadCatalog(), loadCoverManifest()]).then(function (results) {
      var entries = results[0];
      applyFilter(entries);
      input.addEventListener("input", function () {
        window.clearTimeout(filterTimer);
        filterTimer = window.setTimeout(function () { applyFilter(entries); }, 80);
      });
      more.addEventListener("click", renderNextPage);
    }).catch(function () {
      count.textContent = "Unavailable";
      visible.textContent = "0";
      more.hidden = true;
      setState("HTML Games unavailable", "The local game catalog could not be read. Try reopening HTML Games.", false);
    });
  }

  function displayGameName(value) {
    return String(value || "");
  }

  function createLibraryCard(entry) {
    var displayName = displayGameName(entry.name);
    var button = document.createElement("button");
    button.className = "library-card";
    button.type = "button";
    button.setAttribute("aria-label", "Open " + displayName);
    var cover = document.createElement("span");
    cover.className = "library-cover";
    var image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 320;
    image.height = 180;
    var candidates = coverCandidates(entry.slug);
    image.dataset.candidates = JSON.stringify(candidates);
    image.dataset.candidateIndex = "0";
    image.dataset.fallbackClass = "library-cover-fallback";
    image.src = candidates[0];
    image.addEventListener("error", advanceCoverCandidate);
    cover.appendChild(image);
    var copy = document.createElement("span");
    copy.className = "library-card-copy";
    var title = document.createElement("strong");
    title.textContent = displayName;
    var meta = document.createElement("small");
    meta.textContent = "HTML game";
    copy.append(title, meta);
    var arrow = document.createElement("span");
    arrow.className = "library-card-arrow";
    arrow.innerHTML = iconMarkup("chevron");
    button.append(cover, copy, arrow);
    button.addEventListener("click", function () { openZone(entry); });
    return button;
  }

  function renderSearchResults(container, state, count, matches, query) {
    container.textContent = "";
    state.hidden = matches.length > 0;
    count.textContent = matches.length ? matches.length + "+" : "0";
    if (!matches.length) {
      state.querySelector("strong").textContent = "No HTML games found";
      state.querySelector("p").textContent = 'Try a shorter title than "' + query + '".';
      return;
    }
    var fragment = document.createDocumentFragment();
    matches.forEach(function (match) {
      var entry = match.entry;
      var displayName = displayGameName(entry.name);
      var button = document.createElement("button");
      button.className = "search-result";
      button.type = "button";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");
      var image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.width = 52;
      image.height = 52;
      var candidates = coverCandidates(entry.slug);
      image.dataset.candidates = JSON.stringify(candidates);
      image.dataset.candidateIndex = "0";
      image.src = candidates[0];
      image.addEventListener("error", advanceCoverCandidate);
      var text = document.createElement("span");
      var title = document.createElement("strong");
      var meta = document.createElement("small");
      title.textContent = displayName;
      meta.textContent = "HTML game";
      text.append(title, meta);
      var arrow = document.createElement("span");
      arrow.innerHTML = iconMarkup("chevron");
      button.append(image, text, arrow);
      button.addEventListener("click", function () { openZone(entry); });
      fragment.appendChild(button);
    });
    container.appendChild(fragment);
  }

  function coverCandidates(slug) {
    var safe = encodeURIComponent(slug);
    var candidates = [];
    var mapped = String(coverManifest[slug] || "").trim();
    if (/^\/games\/captured-covers\//i.test(mapped)) candidates.push(projectAssetUrl(mapped));
    else if (/^https:\/\//i.test(mapped)) candidates.push(mapped);
    [
      "games/captured-covers/" + safe + "-cover.webp",
      "games/captured-covers/" + safe + "-illustrated.webp",
      "games/captured-covers/" + safe + "-capture.webp",
      "games/captured-covers/" + safe + ".webp",
      "games/captured-covers/" + safe + ".jpg",
      "games/captured-covers/" + safe + ".jpeg",
      "games/captured-covers/" + safe + ".png"
    ].forEach(function (candidate) {
      candidate = projectAssetUrl(candidate);
      if (candidates.indexOf(candidate) === -1) candidates.push(candidate);
    });
    return candidates;
  }

  function advanceCoverCandidate(event) {
    var image = event.currentTarget;
    var candidates = [];
    try { candidates = JSON.parse(image.dataset.candidates || "[]"); } catch (error) {}
    var next = Number(image.dataset.candidateIndex || 0) + 1;
    if (next < candidates.length) {
      image.dataset.candidateIndex = String(next);
      image.src = candidates[next];
      return;
    }
    var fallback = document.createElement("span");
    fallback.className = image.dataset.fallbackClass || "search-result-fallback";
    fallback.innerHTML = iconMarkup("gamepad");
    image.replaceWith(fallback);
  }

  function openZone(entry) {
    var route = localGameRoute(entry);
    if (!route) {
      showToast("Game unavailable", "This catalog entry does not point to a local HTML game file.", "info");
      return;
    }
    var id = "zone-" + entry.slug;
    if (!apps[id]) {
      apps[id] = {
        id: id,
        title: displayGameName(entry.name),
        subtitle: "HTML game",
        icon: "gamepad",
        route: route,
        width: 1240,
        height: 790,
        launcher: false
      };
    }
    openApp(id);
  }

  function localGameRoute(entry) {
    var file = String(entry && entry.file || "").replace(/\\/g, "/");
    if (!/^games\/[A-Za-z0-9._()\[\] -]+\.html$/.test(file)) return "";
    return projectAssetUrl(file.split("/").map(encodeURIComponent).join("/"));
  }

  function projectAssetUrl(path) {
    var clean = String(path || "").replace(/^\/+/, "");
    return new URL("../" + clean, document.baseURI).href;
  }

  function openWallpaperDatabase() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      var request = indexedDB.open(WALLPAPER_DB, 1);
      request.onupgradeneeded = function () {
        if (!request.result.objectStoreNames.contains(WALLPAPER_STORE)) {
          request.result.createObjectStore(WALLPAPER_STORE);
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("Could not open wallpaper storage")); };
    });
  }

  function wallpaperStudios() {
    return Array.from(document.querySelectorAll("[data-wallpaper-studio]"));
  }

  function syncWallpaperCatalogControls(studio) {
    if (!studio) return;
    var source = studio.dataset.wallpaperSource || "installed";
    var remote = source === "discover" || source === "workshop";
    [studio.querySelector("[data-wallpaper-sort]"), studio.querySelector("[data-wallpaper-type-filter]")].forEach(function (select) {
      if (!select) return;
      Array.from(select.options).forEach(function (option) {
        var browserReadyTypeUnavailable = source === "discover"
          && select.hasAttribute("data-wallpaper-type-filter")
          && option.value !== ""
          && option.value !== "video";
        var unavailable = (remote && option.hasAttribute("data-installed-only"))
          || (!remote && option.hasAttribute("data-online-only"))
          || (source !== "workshop" && option.hasAttribute("data-workshop-only"))
          || browserReadyTypeUnavailable;
        option.hidden = unavailable;
        option.disabled = unavailable;
      });
      if (select.selectedOptions[0] && select.selectedOptions[0].disabled) {
        select.value = select.hasAttribute("data-wallpaper-sort") ? (source === "discover" ? "popular" : (remote ? "recent" : "featured")) : "";
      }
    });
    var recent = studio.querySelector("[data-recent-sort]");
    if (recent) recent.textContent = remote ? "Newest" : "Recently used";
    var search = studio.querySelector("[data-wallpaper-search]");
    if (search) {
      search.placeholder = source === "workshop"
        ? "Search all Workshop projects"
        : source === "discover" ? "Search downloadable wallpapers" : "Search installed";
    }
    var filterToggle = studio.querySelector("[data-we-filter-toggle]");
    var filterPanel = studio.querySelector("[data-we-filter-panel]");
    var filtersOpen = studio.dataset.onlineFilters !== "closed";
    if (filterToggle) {
      filterToggle.hidden = !remote;
      filterToggle.setAttribute("aria-expanded", remote && filtersOpen ? "true" : "false");
      filterToggle.classList.toggle("is-active", remote && filtersOpen);
    }
    if (filterPanel) filterPanel.hidden = !remote || !filtersOpen;
    var typeValue = studio.querySelector("[data-wallpaper-type-filter]");
    studio.querySelectorAll("[data-we-filter-type]").forEach(function (radio) {
      var browserReadyTypeUnavailable = source === "discover" && radio.value !== "" && radio.value !== "video";
      radio.disabled = browserReadyTypeUnavailable;
      var typeLabel = radio.closest("label");
      if (typeLabel) typeLabel.hidden = browserReadyTypeUnavailable;
      radio.checked = Boolean(typeValue) && radio.value === typeValue.value;
    });
    var ready = studio.querySelector("[data-we-filter-ready]");
    var readyRow = studio.querySelector("[data-we-filter-ready-row]");
    if (ready) {
      ready.checked = source === "discover";
      ready.disabled = source === "discover";
    }
    if (readyRow) readyRow.hidden = source !== "discover";
  }

  function loadOnlineWallpapers(studio, source, force, requestedPage) {
    if (!studio || source === "installed") return Promise.resolve({ items: [] });
    syncWallpaperCatalogControls(studio);
    var queryNode = studio.querySelector("[data-wallpaper-search]");
    var sortNode = studio.querySelector("[data-wallpaper-sort]");
    var typeNode = studio.querySelector("[data-wallpaper-type-filter]");
    var requestedQuery = queryNode ? queryNode.value.trim().replace(/\s+/g, " ") : "";
    var browserReadyOnly = source === "discover";
    var page = Math.min(1000, Math.max(1, Number.parseInt(requestedPage || studio.dataset.onlinePage, 10) || 1));
    var requestId = String(++onlineWallpaperRequestSerial);
    studio.dataset.onlineRequestId = requestId;
    studio.dataset.onlinePage = String(page);
    studio.dataset.onlineState = "loading";
    var grid = studio.querySelector("[data-wallpaper-grid]");
    if (grid) grid.setAttribute("aria-busy", "true");
    refreshWallpaperStudio(studio);
    if (!onlineWallpaperRuntimePromise) {
      onlineWallpaperRuntimePromise = new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = "./neo-wallpaper-online.js?v=20260827-exact-install-v1";
        script.async = true;
        script.onload = function () {
          if (window.NEO_WALLPAPER_ONLINE) resolve(window.NEO_WALLPAPER_ONLINE);
          else reject(new Error("The online wallpaper catalog did not start."));
        };
        script.onerror = function () { reject(new Error("The online wallpaper catalog could not be loaded.")); };
        document.head.appendChild(script);
      }).catch(function (error) { onlineWallpaperRuntimePromise = null; throw error; });
    }
    return onlineWallpaperRuntimePromise.then(function (runtime) {
      return runtime.load(studio, {
        source: source,
        query: requestedQuery,
        sort: sortNode ? sortNode.value : "featured",
        type: typeNode ? typeNode.value : "",
        catalog: browserReadyOnly ? "browser-ready" : "",
        page: page,
        force: Boolean(force),
        requestId: requestId
      }, function (item) {
        openBrowserTarget(item.url, item.title);
      });
    }).then(function (payload) {
      if (studio.dataset.onlineRequestId !== requestId || studio.dataset.wallpaperSource !== source) return payload;
      if (sortNode && payload.sort && Array.from(sortNode.options).some(function (option) { return option.value === payload.sort; })) {
        sortNode.value = payload.sort;
      }
      studio.dataset.onlinePage = String(payload.page || page);
      studio.dataset.onlineTotalPages = String(payload.totalPages || 0);
      studio.dataset.onlineTotal = String(payload.total || 0);
      studio.dataset.onlineExactCount = String(payload.exactCount == null ? payload.total || 0 : payload.exactCount);
      studio.dataset.onlineRelatedCount = String(payload.relatedCount || 0);
      studio.dataset.onlineCount = String(payload.count || payload.items.length || 0);
      studio.dataset.onlinePlayableCount = String(payload.playableCount || 0);
      studio.dataset.onlinePageSize = String(payload.pageSize || 30);
      studio.dataset.onlineQuery = requestedQuery;
      studio.dataset.onlineCatalogMode = String(payload.catalogMode || "");
      studio.dataset.onlineFallback = payload.fallback ? "true" : "false";
      studio.dataset.onlineRecovered = payload.recovered ? "true" : "false";
      studio.dataset.onlineRecoveryQuery = String(payload.recoveryQuery || "");
      studio.dataset.onlineTotalEstimate = payload.totalIsEstimate ? "true" : "false";
      studio.dataset.onlineStale = payload.stale ? "true" : "false";
      delete studio.dataset.onlineError;
      studio.dataset.onlineState = "ready";
      if (grid) grid.setAttribute("aria-busy", "false");
      wireWallpaperStudioCards(studio);
      refreshWallpaperStudio(studio);
      return payload;
    }).catch(function (error) {
      if (studio.dataset.onlineRequestId !== requestId || studio.dataset.wallpaperSource !== source) throw error;
      studio.dataset.onlineState = "error";
      studio.dataset.onlineError = error && error.message ? error.message : "Discover could not connect.";
      if (grid) grid.setAttribute("aria-busy", "false");
      refreshWallpaperStudio(studio);
      throw error;
    });
  }

  function wireWallpaperStudioCards(studio) {
    if (!studio || studio.dataset.wallpaperCardEventsReady === "true") return;
    studio.dataset.wallpaperCardEventsReady = "true";
    studio.addEventListener("click", function (event) {
      var target = event.target instanceof Element ? event.target : event.target && event.target.parentElement;
      if (!target) return;
      var favorite = target.closest("[data-wallpaper-favorite]");
      if (favorite && studio.contains(favorite)) {
        if (favorite.disabled) return;
        event.preventDefault();
        var favoriteId = favorite.getAttribute("data-wallpaper-favorite");
        var favorites = settings.wallpaperFavorites.slice();
        var index = favorites.indexOf(favoriteId);
        if (index === -1) favorites.push(favoriteId);
        else favorites.splice(index, 1);
        settings.wallpaperFavorites = favorites;
        writeJson(SETTINGS_KEY, settings);
        wallpaperStudios().forEach(refreshWallpaperStudio);
        return;
      }
      var option = target.closest("[data-wallpaper-option]");
      if (!option || !studio.contains(option)) return;
      if (option.disabled) return;
      studio.dataset.selectedWallpaper = option.getAttribute("data-wallpaper-option");
      studio.dataset.wallpaperSelectionRevision = String((Number.parseInt(studio.dataset.wallpaperSelectionRevision, 10) || 0) + 1);
      refreshWallpaperStudio(studio);
    });
  }

  function wireWallpaperStudio(scope) {
    var studio = scope.querySelector("[data-wallpaper-studio]");
    if (!studio || studio.dataset.ready === "true") return;
    studio.dataset.ready = "true";
    studio.dataset.selectedWallpaper = settings.wallpaper;
    studio.dataset.wallpaperSelectionRevision = "0";
    studio.dataset.wallpaperSource = "installed";
    studio.dataset.onlinePage = "1";
    syncWallpaperCatalogControls(studio);

    studio.addEventListener("neo-wallpaper-library-change", function (event) {
      var result = event.detail;
      var record = result && result.record;
      var studios = wallpaperStudios();
      var hydration = record && wallpaperEngine
        ? Promise.all(studios.filter(function (item) {
          return item.dataset.wallpaperSource === "installed";
        }).map(function (item) {
          return wallpaperEngine.hydrateStudio(item).then(function () { wireWallpaperStudioCards(item); });
        }))
        : Promise.resolve();
      hydration.catch(function () {}).then(function () {
        if (record && result.applyAfterInstall) {
          settings.wallpaper = record.id;
          settings.wallpaperFit = "cover";
          settings.wallpaperPaused = false;
          settings.wallpaperRecent = [record.id].concat(settings.wallpaperRecent.filter(function (id) { return id !== record.id; })).slice(0, 6);
          applySettings();
          studios.forEach(refreshWallpaperStudio);
          showToast("Wallpaper applied", record.name + " is now active.", "image");
          return;
        }
        studios.forEach(refreshWallpaperStudio);
        if (record) showToast(result.added ? "Added to Installed" : "Already installed", record.name + " is ready in your wallpaper library.", "image");
      });
    });
    studio.addEventListener("neo-wallpaper-install-state", function () {
      refreshWallpaperStudio(studio);
    });
    studio.addEventListener("neo-wallpaper-selection-change", function () {
      refreshWallpaperStudio(studio);
    });
    studio.addEventListener("neo-wallpaper-library-error", function (event) {
      var detail = event.detail || {};
      refreshWallpaperStudio(studio);
      showToast("Wallpaper not added", detail.message || "The wallpaper could not be saved on this device.", "info");
    });

    wireWallpaperStudioCards(studio);

    var onlineSearchTimer = 0;
    function invalidateOnlineRequest() {
      clearTimeout(onlineSearchTimer);
      studio.dataset.onlineRequestId = String(++onlineWallpaperRequestSerial);
      studio.dataset.onlineState = "idle";
      var grid = studio.querySelector("[data-wallpaper-grid]");
      if (grid) grid.setAttribute("aria-busy", "false");
    }
    function requestOnlinePage(page, force) {
      clearTimeout(onlineSearchTimer);
      var source = studio.dataset.wallpaperSource || "installed";
      if (source === "installed") {
        studio.dataset.onlineState = "idle";
        var grid = studio.querySelector("[data-wallpaper-grid]");
        if (grid) grid.setAttribute("aria-busy", "false");
        refreshWallpaperStudio(studio);
        return;
      }
      loadOnlineWallpapers(studio, source, Boolean(force), page).catch(function () {});
    }

    studio.querySelectorAll("[data-wallpaper-view-button]").forEach(function (button) {
      button.addEventListener("click", function () {
        studio.dataset.wallpaperView = button.getAttribute("data-wallpaper-view-button");
        refreshWallpaperStudio(studio);
      });
    });

    studio.querySelectorAll("[data-we-source]").forEach(function (button) {
      button.addEventListener("click", function () {
        var nextSource = button.getAttribute("data-we-source") || "installed";
        invalidateOnlineRequest();
        studio.dataset.wallpaperSource = nextSource;
        studio.dataset.wallpaperView = "installed";
        studio.dataset.onlinePage = "1";
        studio.dataset.onlineState = "idle";
        delete studio.dataset.onlineError;
        delete studio.dataset.onlineStale;
        var searchControl = studio.querySelector("[data-wallpaper-search]");
        if (searchControl) searchControl.value = "";
        var sortControl = studio.querySelector("[data-wallpaper-sort]");
        if (sortControl) sortControl.value = nextSource === "discover" ? "popular" : (nextSource === "workshop" ? "recent" : "featured");
        syncWallpaperCatalogControls(studio);
        refreshWallpaperStudio(studio);
        if (nextSource === "workshop" || nextSource === "discover") {
          requestOnlinePage(1, false);
        } else if (wallpaperEngine) {
          wallpaperEngine.hydrateStudio(studio).then(function () {
            wireWallpaperStudioCards(studio);
            refreshWallpaperStudio(studio);
          }).catch(function () {
            refreshWallpaperStudio(studio);
          });
        }
      });
    });
    var showInstalled = studio.querySelector("[data-we-show-installed]");
    if (showInstalled) showInstalled.addEventListener("click", function () {
      var installedTab = studio.querySelector('[data-we-source="installed"]');
      if (installedTab) installedTab.click();
    });
    var onlineRetry = studio.querySelector("[data-we-online-retry]");
    if (onlineRetry) onlineRetry.addEventListener("click", function () {
      requestOnlinePage(Number.parseInt(studio.dataset.onlinePage, 10) || 1, true);
    });

    var search = studio.querySelector("[data-wallpaper-search]");
    var searchClear = studio.querySelector("[data-wallpaper-search-clear]");
    var searchForm = studio.querySelector("[data-wallpaper-search-form]");
    function primeOnlineSearchSort() {
      if (!search) return;
      var nextQuery = search.value.trim().replace(/\s+/g, " ");
      if (nextQuery && nextQuery !== studio.dataset.lastOnlineSearchQuery) {
        var sortControl = studio.querySelector("[data-wallpaper-sort]");
        if (sortControl) sortControl.value = "relevance";
      } else if (!nextQuery && (studio.dataset.wallpaperSource || "installed") === "discover") {
        var discoverSort = studio.querySelector("[data-wallpaper-sort]");
        if (discoverSort) discoverSort.value = "popular";
      }
      studio.dataset.lastOnlineSearchQuery = nextQuery;
    }
    function submitWallpaperSearch() {
      clearTimeout(onlineSearchTimer);
      primeOnlineSearchSort();
      studio.dataset.onlinePage = "1";
      if ((studio.dataset.wallpaperSource || "installed") !== "installed") requestOnlinePage(1, false);
      else refreshWallpaperStudio(studio);
    }
    if (search) {
      search.addEventListener("input", function () {
        primeOnlineSearchSort();
        studio.dataset.onlinePage = "1";
        refreshWallpaperStudio(studio);
        if ((studio.dataset.wallpaperSource || "installed") === "installed") {
          return;
        }
        clearTimeout(onlineSearchTimer);
        studio.dataset.onlineState = "pending";
        refreshWallpaperStudio(studio);
        onlineSearchTimer = setTimeout(function () { requestOnlinePage(1, false); }, 240);
      });
      search.addEventListener("search", function () {
        submitWallpaperSearch();
      });
      search.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && search.value) {
          event.preventDefault();
          search.value = "";
          submitWallpaperSearch();
        }
      });
    }
    if (searchForm) searchForm.addEventListener("submit", function (event) {
      event.preventDefault();
      submitWallpaperSearch();
    });
    if (searchClear) searchClear.addEventListener("click", function () {
      if (!search) return;
      search.value = "";
      search.focus();
      submitWallpaperSearch();
    });
    var filterToggle = studio.querySelector("[data-we-filter-toggle]");
    if (filterToggle) filterToggle.addEventListener("click", function () {
      studio.dataset.onlineFilters = studio.dataset.onlineFilters === "closed" ? "open" : "closed";
      syncWallpaperCatalogControls(studio);
    });
    function resetOnlineFilters() {
      var type = studio.querySelector("[data-wallpaper-type-filter]");
      if (type) type.value = "";
      studio.querySelectorAll("[data-we-filter-type]").forEach(function (input) { input.checked = input.value === ""; });
      studio.querySelectorAll("[data-we-filter-quality]").forEach(function (input) { input.checked = input.value === ""; });
      studio.querySelectorAll("[data-we-tag-filter]").forEach(function (input) { input.checked = false; });
      var ready = studio.querySelector("[data-we-filter-ready]");
      var installed = studio.querySelector("[data-we-filter-installed]");
      if (ready) ready.checked = (studio.dataset.wallpaperSource || "installed") === "discover";
      if (installed) installed.checked = false;
    }
    studio.addEventListener("change", function (event) {
      var target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.matches("[data-we-filter-type]")) {
        var type = studio.querySelector("[data-wallpaper-type-filter]");
        if (type) type.value = target.value;
        studio.dataset.onlinePage = "1";
        requestOnlinePage(1, false);
        return;
      }
      if (target.matches("[data-we-filter-quality], [data-we-filter-ready], [data-we-filter-installed], [data-we-tag-filter]")) {
        refreshWallpaperStudio(studio);
      }
    });
    var filterReset = studio.querySelector("[data-we-filter-reset]");
    if (filterReset) filterReset.addEventListener("click", function () {
      resetOnlineFilters();
      studio.dataset.onlinePage = "1";
      if ((studio.dataset.wallpaperSource || "installed") === "installed") refreshWallpaperStudio(studio);
      else requestOnlinePage(1, false);
    });
    var emptyReset = studio.querySelector("[data-wallpaper-empty-reset]");
    if (emptyReset) emptyReset.addEventListener("click", function () {
      if (search) search.value = "";
      resetOnlineFilters();
      submitWallpaperSearch();
    });
    studio.querySelectorAll("[data-wallpaper-topic]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (!search) return;
        var topic = button.getAttribute("data-wallpaper-topic") || "";
        search.value = topic;
        if (!topic) {
          var sortControl = studio.querySelector("[data-wallpaper-sort]");
          if (sortControl) sortControl.value = "popular";
        }
        submitWallpaperSearch();
      });
    });
    var sort = studio.querySelector("[data-wallpaper-sort]");
    if (sort) sort.addEventListener("change", function () {
      if ((studio.dataset.wallpaperSource || "installed") !== "installed") requestOnlinePage(1, false);
      else refreshWallpaperStudio(studio);
    });
    var typeFilter = studio.querySelector("[data-wallpaper-type-filter]");
    if (typeFilter) typeFilter.addEventListener("change", function () {
      if ((studio.dataset.wallpaperSource || "installed") !== "installed") requestOnlinePage(1, false);
      else refreshWallpaperStudio(studio);
    });

    studio.querySelectorAll("[data-we-page-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var current = Number.parseInt(studio.dataset.onlinePage, 10) || 1;
        var total = Number.parseInt(studio.dataset.onlineTotalPages, 10) || 1;
        var next = button.getAttribute("data-we-page-action") === "next" ? current + 1 : current - 1;
        requestOnlinePage(Math.min(total, Math.max(1, next)), false);
      });
    });
    var pageInput = studio.querySelector("[data-we-page-input]");
    var pageGo = studio.querySelector("[data-we-page-go]");
    function goToEnteredPage() {
      if (!pageInput) return;
      var total = Number.parseInt(studio.dataset.onlineTotalPages, 10) || 1;
      requestOnlinePage(Math.min(total, Math.max(1, Number.parseInt(pageInput.value, 10) || 1)), false);
    }
    if (pageGo) pageGo.addEventListener("click", goToEnteredPage);
    if (pageInput) pageInput.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      goToEnteredPage();
    });

    studio.querySelectorAll("[data-we-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var action = button.getAttribute("data-we-action");
        if (action === "apply") {
          var applyButton = studio.querySelector("[data-wallpaper-apply]");
          if (applyButton && !applyButton.disabled) applyButton.click();
        }
        if (action === "recent") {
          studio.dataset.wallpaperView = "recent";
          studio.dataset.wallpaperSource = "installed";
          refreshWallpaperStudio(studio);
        }
        if (action === "favorite") {
          var selected = studio.dataset.selectedWallpaper;
          var favorite = studio.querySelector('[data-wallpaper-favorite="' + escapeSelector(selected) + '"]');
          if (favorite) favorite.click();
        }
        if (action === "configure") {
          var inspector = studio.querySelector(".studio-inspector");
          if (inspector) {
            inspector.setAttribute("tabindex", "-1");
            inspector.focus({ preventScroll: true });
            inspector.scrollTo({ top: 0, behavior: settings.reduceMotion ? "auto" : "smooth" });
          }
        }
      });
    });

    var apply = studio.querySelector("[data-wallpaper-apply]");
    if (apply) {
      apply.addEventListener("click", function () {
        var selected = studio.dataset.selectedWallpaper || settings.wallpaper;
        var selectedCard = studio.querySelector('[data-wallpaper-card="' + escapeSelector(selected) + '"]');
        var onlineSelection = Boolean(selectedCard && selectedCard.getAttribute("data-wallpaper-online") === "true");
        var installControl = selectedCard && selectedCard.querySelector("[data-wallpaper-install]");
        var installState = installControl ? installControl.dataset.wallpaperInstallState : "unavailable";
        var installedRecord = wallpaperEngine ? wallpaperEngine.getRecord(selected) : null;
        if (onlineSelection && !installedRecord) {
          if (installState === "downloading") {
            showToast("Download in progress", "This wallpaper is still being saved. It will apply automatically when ready.", "info");
          } else if (installState === "details" && installControl) {
            installControl.click();
          } else if (installControl && !installControl.disabled) {
            installControl.dataset.applyAfterInstall = "true";
            installControl.click();
          } else {
            var provider = selectedCard.getAttribute("data-wallpaper-provider");
            showToast(provider === "commons" ? "Download needs a refresh" : "Project unavailable", provider === "commons"
              ? "Refresh Discover to retrieve a new verified download source."
              : "No project page is available for this item.", "info");
          }
          return;
        }
        if (selected === "custom" && !customWallpaperUrl) {
          showToast("No imported wallpaper", "Add an image from Create first.", "info");
          return;
        }
        settings.wallpaper = selected;
        settings.wallpaperPaused = false;
        settings.wallpaperRecent = [selected].concat(settings.wallpaperRecent.filter(function (id) { return id !== selected; })).slice(0, 6);
        applySettings();
        wallpaperStudios().forEach(refreshWallpaperStudio);
        var card = studio.querySelector('[data-wallpaper-card="' + escapeSelector(selected) + '"]');
        var name = card ? card.getAttribute("data-wallpaper-name") : "Wallpaper";
        showToast("Wallpaper applied", name + " is now active.", "image");
      });
    }

    studio.querySelectorAll("[data-wallpaper-command]").forEach(function (button) {
      button.addEventListener("click", function () {
        var command = button.getAttribute("data-wallpaper-command");
        if (command === "toggle") {
          var playback = wallpaperEngine ? wallpaperEngine.getState().playback : "";
          var shouldResume = settings.wallpaperPaused || playback === "paused" || playback === "blocked";
          settings.wallpaperPaused = !shouldResume;
          if (shouldResume) Object.assign(settings, { motion: true, reduceMotion: false, batterySaver: false });
          applySettings();
        }
        if (command === "mute") {
          if (settings.wallpaperMuted && wallpaperEngine) wallpaperEngine.unlockAudio();
          setSetting("wallpaperMuted", !settings.wallpaperMuted);
        }
      });
    });

    var remove = studio.querySelector("[data-wallpaper-remove]");
    if (remove && wallpaperEngine) {
      remove.addEventListener("click", function () {
        var selected = studio.dataset.selectedWallpaper || settings.wallpaper;
        if (!wallpaperEngine.isLocal(selected)) return;
        remove.disabled = true;
        remove.textContent = "Removing...";
        wallpaperEngine.remove(selected).then(function () {
          settings.wallpaperFavorites = settings.wallpaperFavorites.filter(function (id) { return id !== selected; });
          settings.wallpaperRecent = settings.wallpaperRecent.filter(function (id) { return id !== selected; });
          if (settings.wallpaper === selected) settings.wallpaper = "we-steam-1403160205";
          studio.dataset.selectedWallpaper = settings.wallpaper;
          applySettings();
          return Promise.all(wallpaperStudios().map(function (item) { return wallpaperEngine.hydrateStudio(item); }));
        }).then(function () {
          wallpaperStudios().forEach(function (item) { wireWallpaperStudioCards(item); refreshWallpaperStudio(item); });
          showToast("Wallpaper removed", "The local media was deleted from this device.", "image");
        }).catch(function (error) {
          showToast("Could not remove wallpaper", error.message || "Local storage rejected the change.", "info");
        }).then(function () {
          remove.disabled = false;
          refreshWallpaperStudio(studio);
        });
      });
    }

    refreshWallpaperStudio(studio);
    if (wallpaperEngine) {
      wallpaperEngine.hydrateStudio(studio).then(function () {
        wireWallpaperStudioCards(studio);
        refreshWallpaperStudio(studio);
        if (studio.dataset.wallpaperSource !== "installed") loadOnlineWallpapers(studio, studio.dataset.wallpaperSource).catch(function () {});
      }).catch(function () {});
    }
  }

  function refreshWallpaperStudio(studio) {
    if (!studio) return;
    var selected = studio.dataset.selectedWallpaper || settings.wallpaper;
    var view = studio.dataset.wallpaperView || "installed";
    var source = studio.dataset.wallpaperSource || "installed";
    syncWallpaperCatalogControls(studio);
    var favorites = settings.wallpaperFavorites;
    var recent = settings.wallpaperRecent;
    var queryNode = studio.querySelector("[data-wallpaper-search]");
    var query = queryNode ? queryNode.value.trim().toLowerCase() : "";
    var searchClear = studio.querySelector("[data-wallpaper-search-clear]");
    if (searchClear) searchClear.hidden = !query;
    studio.querySelectorAll("[data-wallpaper-topic]").forEach(function (button) {
      var activeTopic = (button.getAttribute("data-wallpaper-topic") || "") === query;
      button.classList.toggle("is-active", activeTopic);
      button.setAttribute("aria-pressed", activeTopic ? "true" : "false");
    });
    var sortNode = studio.querySelector("[data-wallpaper-sort]");
    var sort = sortNode ? sortNode.value : "featured";
    var typeNode = studio.querySelector("[data-wallpaper-type-filter]");
    var typeFilter = typeNode ? typeNode.value : "";
    var readyOnly = source === "discover" || Boolean(studio.querySelector("[data-we-filter-ready]:checked"));
    var installedOnly = Boolean(studio.querySelector("[data-we-filter-installed]:checked"));
    var qualityNode = studio.querySelector("[data-we-filter-quality]:checked");
    var qualityFilter = qualityNode ? qualityNode.value : "";
    var tagFilters = Array.from(studio.querySelectorAll("[data-we-tag-filter]:checked")).map(function (input) {
      return input.value;
    });
    var onlineFilterActive = Boolean(typeFilter || qualityFilter || installedOnly || tagFilters.length || (source !== "discover" && readyOnly));
    var grid = studio.querySelector("[data-wallpaper-grid]");
    var create = studio.querySelector("[data-wallpaper-create]");
    var empty = studio.querySelector("[data-wallpaper-empty]");
    var online = studio.querySelector("[data-we-source-intro]");
    var visibleCount = 0;
    var cards = Array.from(studio.querySelectorAll("[data-wallpaper-card]"));
    var installedCount = studio.querySelector("[data-installed-count]");
    if (installedCount) {
      var engineState = wallpaperEngine ? wallpaperEngine.getState() : null;
      installedCount.textContent = String(engineState ? engineState.libraryCount : cards.filter(function (card) {
        var id = card.getAttribute("data-wallpaper-card");
        var available = id !== "custom" || Boolean(customWallpaperUrl);
        return available && card.getAttribute("data-wallpaper-online") !== "true";
      }).length);
    }

    studio.querySelectorAll("[data-wallpaper-view-button]").forEach(function (button) {
      var active = button.getAttribute("data-wallpaper-view-button") === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    studio.querySelectorAll("[data-we-source]").forEach(function (button) {
      var active = button.getAttribute("data-we-source") === source;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    var onlineTitle = studio.querySelector("[data-we-online-title]");
    if (onlineTitle) onlineTitle.textContent = source === "workshop" ? "Workshop" : "Discover";
    var onlineCopy = studio.querySelector("[data-we-source-copy]");
    var onlineState = studio.dataset.onlineState || "idle";
    var onlineCards = cards.filter(function (card) {
      return card.getAttribute("data-wallpaper-online-source") === source;
    });
    var onlinePage = Number.parseInt(studio.dataset.onlinePage, 10) || 1;
    var onlineTotalPages = Number.parseInt(studio.dataset.onlineTotalPages, 10) || 0;
    var onlineTotal = Number.parseInt(studio.dataset.onlineTotal, 10) || 0;
    var onlineExactCount = Number.parseInt(studio.dataset.onlineExactCount, 10) || 0;
    var onlineRelatedCount = Number.parseInt(studio.dataset.onlineRelatedCount, 10) || 0;
    var onlineCount = Number.parseInt(studio.dataset.onlineCount, 10) || onlineCards.length;
    var onlinePageSize = Number.parseInt(studio.dataset.onlinePageSize, 10) || 30;
    var onlineStart = onlineTotal && onlineCount ? ((onlinePage - 1) * onlinePageSize) + 1 : 0;
    var onlineEnd = onlineStart ? Math.min(onlineTotal, onlineStart + onlineCount - 1) : 0;
    if (onlineCopy) {
      if (onlineState === "loading") onlineCopy.textContent = source === "discover" ? "Finding web-compatible animated wallpapers..." : "Loading Workshop projects...";
      else if (onlineState === "pending") onlineCopy.textContent = "Filtering now; refreshing online results...";
      else if (onlineState === "error") onlineCopy.textContent = studio.dataset.onlineError || "Discover could not connect. Refresh to try again.";
      else if (onlineState === "ready" && studio.dataset.onlineFallback === "true") onlineCopy.textContent = studio.dataset.onlineCatalogMode === "browser-ready"
        ? "No exact browser-ready match for ‘" + query + "’. Showing downloadable 1080p+ alternatives."
        : "No exact matches for ‘" + query + "’. Showing popular Workshop alternatives instead.";
      else if (onlineState === "ready" && onlineTotal && onlineCount && source === "discover" && studio.dataset.onlineCatalogMode === "browser-ready") onlineCopy.textContent = onlineRelatedCount
        ? onlineCount.toLocaleString() + (onlineCount === 1 ? " playable animation" : " playable animations") + (onlinePage > 1 ? " on page " + onlinePage.toLocaleString() : "") + " · " + onlineExactCount.toLocaleString() + " matches + " + onlineRelatedCount.toLocaleString() + " related."
        : onlineCount.toLocaleString() + (onlineCount === 1 ? " playable animation" : " playable animations") + (onlinePage > 1 ? " on page " + onlinePage.toLocaleString() : "") + (onlineTotal > onlineCount ? " · " + onlineTotal.toLocaleString() + (query ? " title matches." : " source matches.") : ".") + (studio.dataset.onlineStale === "true" ? " Cached results." : "");
      else if (onlineState === "ready" && onlineTotal && onlineCount) onlineCopy.textContent = "Showing " + onlineStart.toLocaleString() + "-" + onlineEnd.toLocaleString() + " of " + onlineTotal.toLocaleString() + " Workshop projects." + (studio.dataset.onlineStale === "true" ? " Cached results." : "");
      else if (onlineState === "ready" && source === "discover") onlineCopy.textContent = "No results are available right now. Refresh to try the catalog again.";
      else if (onlineState === "ready") onlineCopy.textContent = "No Workshop projects are available right now. Refresh to try again.";
      else onlineCopy.textContent = source === "discover" ? "Every result downloads once and can be applied immediately." : "Browse the complete native Wallpaper Engine catalog.";
    }
    var onlineRetry = studio.querySelector("[data-we-online-retry]");
    if (onlineRetry) {
      onlineRetry.hidden = source === "installed";
      onlineRetry.disabled = onlineState === "loading";
      onlineRetry.textContent = onlineState === "loading" ? "Loading..." : "Refresh";
    }
    var onlinePager = studio.querySelector("[data-we-online-pager]");
    if (onlinePager) {
      onlinePager.hidden = source === "installed" || (onlineState !== "ready" && onlineTotalPages === 0);
      var pageInput = onlinePager.querySelector("[data-we-page-input]");
      var totalPagesNode = onlinePager.querySelector("[data-we-total-pages]");
      var resultCount = onlinePager.querySelector("[data-we-result-count]");
      if (pageInput) {
        pageInput.value = String(onlinePage);
        pageInput.max = String(Math.max(1, onlineTotalPages));
        pageInput.disabled = onlineState === "loading" || onlineTotalPages < 2;
      }
      if (totalPagesNode) totalPagesNode.textContent = Math.max(1, onlineTotalPages).toLocaleString();
      if (resultCount) resultCount.textContent = onlineTotal.toLocaleString() + (onlineTotal === 1 ? " result" : " results");
      onlinePager.querySelectorAll("[data-we-page-action], [data-we-page-go]").forEach(function (button) {
        var action = button.getAttribute("data-we-page-action");
        button.disabled = onlineState === "loading" || onlineTotalPages < 2 || (action === "previous" && onlinePage <= 1) || (action === "next" && onlinePage >= onlineTotalPages);
      });
    }
    var title = studio.querySelector("#wallpaper-library-title");
    if (title) title.textContent = source === "installed" ? view.charAt(0).toUpperCase() + view.slice(1) : (source === "workshop" ? "Workshop" : "Discover");
    var viewLabel = studio.querySelector("[data-wallpaper-view-label]");
    if (viewLabel) viewLabel.textContent = source === "installed" ? "LIBRARY" : "ONLINE LIBRARY";
    var favoriteCount = studio.querySelector("[data-favorite-count]");
    if (favoriteCount) favoriteCount.textContent = String(favorites.length);
    var recentCount = studio.querySelector("[data-recent-count]");
    if (recentCount) recentCount.textContent = String(recent.length);

    if (grid) grid.hidden = view === "create";
    if (create) create.hidden = source !== "installed" || view !== "create";
    if (online) online.hidden = source === "installed";

    if (source === "installed") {
      cards.sort(function (a, b) {
        var aId = a.getAttribute("data-wallpaper-card");
        var bId = b.getAttribute("data-wallpaper-card");
        if (sort === "name") return a.getAttribute("data-wallpaper-name").localeCompare(b.getAttribute("data-wallpaper-name"));
        if (sort === "recent") {
          var aIndex = recent.indexOf(aId);
          var bIndex = recent.indexOf(bId);
          return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
        }
        return 0;
      });
    }

    var visibleIds = [];
    cards.forEach(function (card) {
      var id = card.getAttribute("data-wallpaper-card");
      var name = card.getAttribute("data-wallpaper-name") || id;
      var sourceType = card.getAttribute("data-wallpaper-source-type") || card.getAttribute("data-wallpaper-type") || "";
      var onlineCard = card.getAttribute("data-wallpaper-online") === "true";
      var customUnavailable = id === "custom" && !customWallpaperUrl;
      var sourceMatch = source === "installed"
        ? !onlineCard
        : onlineCard && card.getAttribute("data-wallpaper-online-source") === source;
      var viewMatch = source !== "installed" || view === "installed" || (view === "favorites" && favorites.indexOf(id) !== -1) || (view === "recent" && recent.indexOf(id) !== -1);
      var searchable = card.getAttribute("data-wallpaper-search") || [name, card.getAttribute("data-wallpaper-copy"), card.getAttribute("data-wallpaper-author")].join(" ");
      var onlineMatcher = window.NEO_WALLPAPER_ONLINE && window.NEO_WALLPAPER_ONLINE.matchesSearch;
      var searchMatch = source !== "installed" || !query || (onlineMatcher ? onlineMatcher(searchable, query) : searchable.toLowerCase().indexOf(query) !== -1);
      var typeMatch = !typeFilter || sourceType === typeFilter || card.getAttribute("data-wallpaper-type") === typeFilter;
      var readyMatch = source === "installed" || !readyOnly || card.getAttribute("data-wallpaper-original-available") === "true";
      var installedMatch = source === "installed" || !installedOnly || Boolean(wallpaperEngine && wallpaperEngine.getRecord(id));
      var cardQuality = card.dataset.wallpaperQuality || "";
      var qualityMatch = source === "installed" || !qualityFilter
        || (qualityFilter === "4k" && cardQuality === "4k")
        || (qualityFilter === "1080p" && (cardQuality === "1080p" || cardQuality === "4k"))
        || (qualityFilter === "preview" && cardQuality === "preview");
      var cardTags = (card.dataset.wallpaperTags || "").split("|").filter(Boolean);
      var tagsMatch = source === "installed" || !tagFilters.length || tagFilters.some(function (tag) { return cardTags.indexOf(tag) !== -1; });
      var visible = view !== "create" && sourceMatch && !customUnavailable && viewMatch && searchMatch && typeMatch && readyMatch && installedMatch && qualityMatch && tagsMatch;
      card.hidden = !visible;
      if (visible) {
        visibleCount += 1;
        visibleIds.push(id);
      }
    });
    var searchStatus = studio.querySelector("[data-wallpaper-search-status]");
    if (searchStatus) searchStatus.textContent = visibleCount + (visibleCount === 1 ? " wallpaper shown" : " wallpapers shown");
    var usingShelves = Boolean(grid && source === "discover" && !query && grid.classList.contains("is-shelved"));
    if (grid && !usingShelves) {
      if (grid.classList.contains("is-shelved")) {
        cards.forEach(function (card) { grid.appendChild(card); });
        grid.querySelectorAll("[data-wallpaper-shelf]").forEach(function (shelf) { shelf.remove(); });
        grid.classList.remove("is-shelved");
      }
      var order = cards.map(function (card) { return card.dataset.wallpaperCard; }).join();
      if (studio.dataset.cardOrder !== order) {
        studio.dataset.cardOrder = order;
        cards.forEach(function (card) { grid.appendChild(card); });
      }
    } else if (usingShelves) {
      grid.querySelectorAll("[data-wallpaper-shelf]").forEach(function (shelf) {
        shelf.hidden = !shelf.querySelector("[data-wallpaper-card]:not([hidden])");
      });
    }
    var filterStatus = studio.querySelector("[data-we-filter-status]");
    if (filterStatus) {
      filterStatus.hidden = source === "installed";
      filterStatus.textContent = source === "installed" ? "" : visibleCount.toLocaleString() + " of " + onlineCards.length.toLocaleString() + " on this page";
    }

    if (visibleIds.length && visibleIds.indexOf(selected) === -1) {
      selected = visibleIds[0];
      studio.dataset.selectedWallpaper = selected;
      studio.dataset.wallpaperSelectionRevision = String((Number.parseInt(studio.dataset.wallpaperSelectionRevision, 10) || 0) + 1);
    }

    cards.forEach(function (card) {
      var id = card.getAttribute("data-wallpaper-card");
      card.classList.toggle("is-selected", id === selected);
      card.classList.toggle("is-active", id === settings.wallpaper);
      var select = card.querySelector("[data-wallpaper-option]");
      if (select) select.setAttribute("aria-pressed", id === selected ? "true" : "false");
      var favorite = card.querySelector("[data-wallpaper-favorite]");
      if (favorite) {
        var isFavorite = favorites.indexOf(id) !== -1;
        favorite.hidden = false;
        favorite.classList.toggle("is-active", isFavorite);
        favorite.setAttribute("aria-pressed", isFavorite ? "true" : "false");
        favorite.textContent = isFavorite ? "Saved" : "Save";
      }
    });
    if (window.NEO_WALLPAPER_ONLINE && typeof window.NEO_WALLPAPER_ONLINE.sync === "function") {
      window.NEO_WALLPAPER_ONLINE.sync(studio);
    }

    if (empty) {
      var emptyTitle = empty.querySelector("[data-wallpaper-empty-title]");
      var emptyCopy = empty.querySelector("[data-wallpaper-empty-copy]");
      var emptyReset = empty.querySelector("[data-wallpaper-empty-reset]");
      if (source === "installed") {
        if (emptyTitle) emptyTitle.textContent = "No wallpapers here yet";
        if (emptyCopy) emptyCopy.textContent = "Choose another section or add a local image.";
      } else {
        if (emptyTitle) emptyTitle.textContent = "No online wallpapers found";
        if (emptyCopy) emptyCopy.textContent = "Try another search, type, or sort option.";
      }
      if (emptyReset) emptyReset.hidden = !query && !onlineFilterActive;
      empty.hidden = view === "create" || visibleCount > 0 || onlineState === "loading" || onlineState === "pending";
    }
    var selectedCard = studio.querySelector('[data-wallpaper-card="' + escapeSelector(selected) + '"]:not([hidden])');
    var inspectorPreview = studio.querySelector("[data-inspector-preview]");
    var inspectorTitle = studio.querySelector("[data-inspector-title]");
    var inspectorCopy = studio.querySelector("[data-inspector-copy]");
    var inspectorAuthor = studio.querySelector("[data-inspector-author]");
    var inspectorType = studio.querySelector("[data-inspector-type]");
    var inspectorState = studio.querySelector("[data-inspector-state]");
    if (selectedCard) {
      if (inspectorPreview) {
        inspectorPreview.removeAttribute("style");
        inspectorPreview.removeAttribute("data-media-badge");
        var selectedOnlinePreview = selectedCard.getAttribute("data-wallpaper-preview");
        if (selectedOnlinePreview) {
          inspectorPreview.className = "inspector-preview local-wallpaper-preview";
          inspectorPreview.style.backgroundImage = 'url("' + selectedOnlinePreview.replace(/"/g, "%22") + '")';
          inspectorPreview.dataset.mediaBadge = "ONLINE";
        } else if (!wallpaperEngine || !wallpaperEngine.decoratePreview(inspectorPreview, selected)) {
          inspectorPreview.className = "inspector-preview " + selectedCard.getAttribute("data-wallpaper-card") + "-preview";
        }
      }
      if (inspectorTitle) inspectorTitle.textContent = selectedCard.getAttribute("data-wallpaper-name");
      if (inspectorCopy) inspectorCopy.textContent = selectedCard.getAttribute("data-wallpaper-copy");
      if (inspectorAuthor) inspectorAuthor.textContent = selectedCard.getAttribute("data-wallpaper-author") || "Local library";
      if (inspectorState) {
        var selectedRecord = wallpaperEngine ? wallpaperEngine.getRecord(selected) : null;
        var selectedOnline = selectedCard.getAttribute("data-wallpaper-online") === "true";
        var selectedInstallable = selectedCard.getAttribute("data-wallpaper-installable") === "true";
        var selectedOriginalAvailable = selectedCard.getAttribute("data-wallpaper-original-available") === "true";
        inspectorState.textContent = selectedOnline && !selectedRecord
          ? (selectedOriginalAvailable ? "Ready to download" : "Wallpaper Engine project")
          : selected === settings.wallpaper ? "Active" : "Installed";
      }
      if (inspectorType) {
        var selectedType = selectedCard.getAttribute("data-wallpaper-source-type") || selectedCard.getAttribute("data-wallpaper-type") || "image";
        inspectorType.textContent = selectedType.charAt(0).toUpperCase() + selectedType.slice(1);
      }
    }
    var apply = studio.querySelector("[data-wallpaper-apply]");
    if (apply) {
      var applied = selected === settings.wallpaper;
      var onlineSelection = Boolean(selectedCard && selectedCard.getAttribute("data-wallpaper-online") === "true");
      var selectedInstall = selectedCard && selectedCard.querySelector("[data-wallpaper-install]");
      var selectedInstallState = selectedInstall ? selectedInstall.dataset.wallpaperInstallState : "unavailable";
      var downloadingOnlineSelection = onlineSelection && selectedInstallState === "downloading";
      var installableOnlineSelection = Boolean(onlineSelection && selectedCard.getAttribute("data-wallpaper-installable") === "true" && selectedInstallState === "ready");
      var installedOnlineSelection = Boolean(onlineSelection && wallpaperEngine && wallpaperEngine.getRecord(selected));
      var projectDetailsSelection = Boolean(onlineSelection && !installedOnlineSelection && selectedInstallState === "details");
      apply.disabled = !selectedCard || downloadingOnlineSelection || (onlineSelection && !installedOnlineSelection && !installableOnlineSelection && !projectDetailsSelection) || ((!onlineSelection || installedOnlineSelection) && applied);
      apply.innerHTML = downloadingOnlineSelection
        ? iconMarkup("download") + " Downloading wallpaper..."
        : onlineSelection && !installedOnlineSelection && installableOnlineSelection
        ? iconMarkup("download") + " Download & use"
        : projectDetailsSelection
          ? iconMarkup("external") + " Get in Wallpaper Engine"
        : onlineSelection && !installedOnlineSelection
          ? iconMarkup("info") + " Project unavailable"
        : iconMarkup("check") + (applied ? " Applied" : " Apply wallpaper");
    }
    refreshWallpaperPlaybackControls(studio, selected);
  }

  function refreshWallpaperPlaybackControls(studio, selected) {
    var state = wallpaperEngine ? wallpaperEngine.getState() : null;
    var record = wallpaperEngine ? wallpaperEngine.getRecord(selected) : null;
    var isActive = Boolean(state && state.id === selected);
    var isBundled = Boolean(record && wallpaperEngine && wallpaperEngine.isBundled && wallpaperEngine.isBundled(selected));
    var isPreview = Boolean(record && record.previewFallback);
    var isCanvas = selected === "signal" || isPreview;
    var isVideo = Boolean(record && record.type === "video");
    var isWeb = Boolean(record && record.type === "web");
    var isAnimatedImage = Boolean(record && record.type === "animated-image");
    var selectedCard = studio.querySelector('[data-wallpaper-card="' + escapeSelector(selected) + '"]:not([hidden])');
    var isOnlineAnimation = Boolean(selectedCard
      && selectedCard.getAttribute("data-wallpaper-online") === "true"
      && selectedCard.getAttribute("data-wallpaper-installable") === "true");
    var isOnlinePreview = Boolean(isOnlineAnimation
      && selectedCard.getAttribute("data-wallpaper-original-available") !== "true"
      && selectedCard.getAttribute("data-wallpaper-preview-available") === "true");
    var canPause = isActive && (isCanvas || isVideo || isWeb || isAnimatedImage);
    var isPaused = Boolean(isActive && (state.playback === "paused" || state.playback === "blocked"));
    var kind = isVideo ? "Video" : isAnimatedImage ? "Animated image" : isPreview ? "High-DPI animation" : isCanvas ? "Canvas animation" : isWeb ? "Live animation" : record ? "Local image" : isOnlinePreview ? "Web animation" : isOnlineAnimation ? "1080p animation" : "Static wallpaper";
    var runtime = studio.querySelector("[data-wallpaper-runtime-state]");
    var toggle = studio.querySelector('[data-wallpaper-command="toggle"]');
    var mute = studio.querySelector('[data-wallpaper-command="mute"]');
    var playLabel = studio.querySelector("[data-wallpaper-play-label]");
    var muteLabel = studio.querySelector("[data-wallpaper-mute-label]");
    var remove = studio.querySelector("[data-wallpaper-remove]");
    if (runtime) {
      if (isActive && state.playback === "loading") runtime.textContent = "Loading " + kind.toLowerCase();
      else if (isActive && state.playback === "error") runtime.textContent = kind + " could not play";
      else runtime.textContent = kind + (canPause ? (isPaused ? " paused" : " playing") : " ready");
    }
    if (toggle) {
      toggle.disabled = !canPause;
      toggle.setAttribute("aria-label", isPaused ? "Resume wallpaper" : "Pause wallpaper");
      toggle.setAttribute("aria-pressed", isPaused ? "true" : "false");
      var playIcon = toggle.querySelector("use");
      if (playIcon) playIcon.setAttribute("href", isPaused ? "#i-play" : "#i-pause");
    }
    if (mute) mute.disabled = !isActive || !isVideo;
    if (playLabel) playLabel.textContent = isPaused ? "Resume" : "Pause";
    if (muteLabel) muteLabel.textContent = settings.wallpaperMuted ? "Muted" : "Sound on";
    studio.querySelectorAll('[data-setting="wallpaperVolume"], [data-setting="wallpaperSpeed"], [data-setting="wallpaperLoop"]').forEach(function (control) {
      control.disabled = !isActive || !isVideo;
    });
    if (remove) remove.hidden = !record || isBundled || (studio.dataset.wallpaperSource || "installed") !== "installed";
  }

  function storeCustomWallpaper(file) {
    return openWallpaperDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(WALLPAPER_STORE, "readwrite");
        transaction.objectStore(WALLPAPER_STORE).put(file, "custom");
        transaction.oncomplete = function () { db.close(); resolve(); };
        transaction.onerror = function () { db.close(); reject(transaction.error); };
      });
    });
  }

  function deleteCustomWallpaper() {
    return openWallpaperDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(WALLPAPER_STORE, "readwrite");
        transaction.objectStore(WALLPAPER_STORE).delete("custom");
        transaction.oncomplete = function () { db.close(); resolve(); };
        transaction.onerror = function () { db.close(); reject(transaction.error); };
      });
    });
  }

  function applyCustomWallpaper(blob) {
    if (customWallpaperUrl) URL.revokeObjectURL(customWallpaperUrl);
    customWallpaperUrl = blob ? URL.createObjectURL(blob) : "";
    if (customWallpaperUrl) root.style.setProperty("--custom-wallpaper", 'url("' + customWallpaperUrl + '")');
    else root.style.removeProperty("--custom-wallpaper");
    applySettings({ persist: false });
  }

  function handleWallpaperUpload(input) {
    var files = Array.from(input.files || []);
    var file = files[0];
    if (!file) return;
    if (wallpaperEngine) {
      input.disabled = true;
      var note = input.closest("[data-wallpaper-create]") && input.closest("[data-wallpaper-create]").querySelector("[data-upload-note]");
      if (note) note.textContent = "Importing " + files.length + (files.length === 1 ? " wallpaper..." : " wallpapers...");
      var imported = [];
      files.reduce(function (chain, nextFile) {
        return chain.then(function () { return wallpaperEngine.importFile(nextFile); }).then(function (record) { imported.push(record); });
      }, Promise.resolve()).then(function () {
        var selected = imported[imported.length - 1];
        if (!selected) return;
        settings.wallpaper = selected.id;
        settings.wallpaperPaused = false;
        settings.wallpaperRecent = [selected.id].concat(settings.wallpaperRecent.filter(function (id) { return id !== selected.id; })).slice(0, 12);
        applySettings();
        return Promise.all(wallpaperStudios().map(function (studio) {
          studio.dataset.selectedWallpaper = selected.id;
          studio.dataset.wallpaperView = "installed";
          return wallpaperEngine.hydrateStudio(studio);
        })).then(function () {
          wallpaperStudios().forEach(function (studio) { wireWallpaperStudioCards(studio); refreshWallpaperStudio(studio); });
          showToast(imported.length === 1 ? "Wallpaper imported" : "Wallpapers imported", imported.length + (imported.length === 1 ? " item is" : " items are") + " stored only on this device.", "image");
        });
      }).catch(function (error) {
        showToast("Could not import wallpaper", error.message || "This device rejected the media file.", "info");
      }).then(function () {
        input.disabled = false;
        input.value = "";
        if (note) note.textContent = "Images, GIFs, MP4, or WebM up to 160 MB each";
      });
      return;
    }
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 12 * 1024 * 1024) {
      input.value = "";
      showToast("Image not accepted", "Choose a PNG, JPG, or WebP under 12 MB.", "info");
      return;
    }
    storeCustomWallpaper(file).then(function () {
      applyCustomWallpaper(file);
      settings.wallpaper = "custom";
      settings.wallpaperRecent = ["custom"].concat(settings.wallpaperRecent.filter(function (id) { return id !== "custom"; })).slice(0, 6);
      applySettings();
      wallpaperStudios().forEach(function (studio) {
        studio.dataset.selectedWallpaper = "custom";
        studio.dataset.wallpaperView = "installed";
        refreshWallpaperStudio(studio);
      });
      showToast("Wallpaper applied", "Stored only on this device.", "image");
      input.value = "";
    }).catch(function () {
      input.value = "";
      showToast("Could not store wallpaper", "Local asset storage may be blocked.", "info");
    });
  }

  function resetCustomWallpaper() {
    deleteCustomWallpaper().catch(function () {}).then(function () {
      applyCustomWallpaper(null);
      settings.wallpaper = "we-steam-1403160205";
      settings.wallpaperFavorites = settings.wallpaperFavorites.filter(function (id) { return id !== "custom"; });
      settings.wallpaperRecent = settings.wallpaperRecent.filter(function (id) { return id !== "custom"; });
      applySettings();
      wallpaperStudios().forEach(function (studio) {
        studio.dataset.selectedWallpaper = "we-steam-1403160205";
        refreshWallpaperStudio(studio);
      });
      showToast("Custom wallpaper removed", "Rainy Day is active again.", "image");
    });
  }

  function setupWeatherCanvas() {
    var canvas = document.getElementById("weather-canvas");
    if (!canvas) return;
    if (window.ResizeObserver) {
      weatherResizeObserver = new ResizeObserver(function () { sizeWeatherCanvas(canvas); });
      weatherResizeObserver.observe(canvas);
    } else {
      window.addEventListener("resize", function () { sizeWeatherCanvas(canvas); }, { passive: true });
    }
    sizeWeatherCanvas(canvas);
  }

  function sizeWeatherCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var width = Math.max(1, canvas.clientWidth);
    var height = Math.max(1, canvas.clientHeight);
    var nextWidth = Math.round(width * dpr);
    var nextHeight = Math.round(height * dpr);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      canvas.dataset.dpr = String(dpr);
    }
  }

  function updateWeatherEngine() {
    cancelAnimationFrame(weatherFrame);
    weatherFrame = 0;
    var canvas = document.getElementById("weather-canvas");
    if (!canvas || document.hidden || root.dataset.weather === "false" || root.dataset.performance === "low") return;
    if (root.dataset.wallpaper !== "moonfall") {
      var clear = canvas.getContext("2d");
      clear.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    startRain(canvas);
  }

  function startRain(canvas) {
    var context = canvas.getContext("2d", { alpha: true });
    var drops = [];
    var last = 0;
    var dpr = Number(canvas.dataset.dpr || 1);
    var count = Math.min(72, Math.max(28, Math.round(canvas.clientWidth / 24)));
    for (var i = 0; i < count; i++) {
      drops.push({
        x: Math.random() * canvas.clientWidth,
        y: Math.random() * canvas.clientHeight,
        length: 7 + Math.random() * 13,
        speed: 70 + Math.random() * 100,
        alpha: 0.08 + Math.random() * 0.13
      });
    }
    function frame(time) {
      if (document.hidden || root.dataset.weather === "false" || root.dataset.performance === "low" || root.dataset.wallpaper !== "moonfall") {
        context.clearRect(0, 0, canvas.width, canvas.height);
        weatherFrame = 0;
        return;
      }
      if (time - last < 34) {
        weatherFrame = requestAnimationFrame(frame);
        return;
      }
      var delta = Math.min(0.06, (time - last || 34) / 1000);
      last = time;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.scale(dpr, dpr);
      context.lineWidth = 0.7;
      drops.forEach(function (drop) {
        drop.y += drop.speed * delta;
        drop.x -= drop.speed * delta * 0.12;
        if (drop.y > canvas.clientHeight + 20 || drop.x < -20) {
          drop.y = -20;
          drop.x = Math.random() * (canvas.clientWidth + 80);
        }
        context.strokeStyle = "rgba(225,238,244," + drop.alpha + ")";
        context.beginPath();
        context.moveTo(drop.x, drop.y);
        context.lineTo(drop.x - 2, drop.y + drop.length);
        context.stroke();
      });
      context.restore();
      weatherFrame = requestAnimationFrame(frame);
    }
    weatherFrame = requestAnimationFrame(frame);
  }

  function performBoot() {
    var image = new Image();
    image.src = "./assets/neo-logo.svg";
    var ready = typeof image.decode === "function" ? image.decode().catch(function () {}) : Promise.resolve();
    var timeout = new Promise(function (resolve) { window.setTimeout(resolve, 650); });
    Promise.race([ready, timeout]).then(function () {
      requestAnimationFrame(function () {
        root.dataset.boot = "complete";
        try { sessionStorage.setItem(BOOT_SESSION_KEY, "1"); } catch (error) {}
      });
    });
  }

  function initAccountGate() {
    var gate = document.getElementById("neo-login-gate");
    var mount = gate && gate.querySelector("[data-neo-login-auth]");
    var guest = gate && gate.querySelector("[data-neo-login-guest]");
    var clock = gate && gate.querySelector("[data-neo-login-clock]");
    var date = gate && gate.querySelector("[data-neo-login-date]");
    if (!gate || !mount || !guest) return;

    var hasSession = false;
    try {
      var token = localStorage.getItem("ugp_token") || "";
      var user = JSON.parse(localStorage.getItem("ugp_session") || "null");
      hasSession = Boolean(token && user && user.username);
      if (!hasSession && sessionStorage.getItem(GUEST_SESSION_KEY) === "1") return;
    } catch (error) {}
    if (hasSession) return;

    function updateGateTime() {
      var now = new Date();
      if (clock) clock.textContent = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(now);
      if (date) date.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now);
    }

    function dismissGate() {
      gate.hidden = true;
      gate.setAttribute("aria-hidden", "true");
      window.clearInterval(gate._neoClockTimer);
      document.getElementById("neo-desktop").focus({ preventScroll: true });
    }

    gate.hidden = false;
    gate.removeAttribute("aria-hidden");
    updateGateTime();
    gate._neoClockTimer = window.setInterval(updateGateTime, 1000);
    guest.addEventListener("click", function () {
      try { sessionStorage.setItem(GUEST_SESSION_KEY, "1"); } catch (error) {}
      dismissGate();
      showToast("Chat skipped", "Choose a name later from the account button.", "check");
    }, { once: true });

    import("./neo-account-signin.js?v=5").then(function (runtime) {
      if (gate.hidden) return;
      gate._neoAuthCleanup = runtime.mountAccountSignIn(mount, function () {}, function (payload) {
        try { sessionStorage.removeItem(GUEST_SESSION_KEY); } catch (error) {}
        window.dispatchEvent(new CustomEvent("neo-auth-changed", { detail: { user: payload.user } }));
        dismissGate();
        showToast("Chat ready", "You are now " + payload.user.username + ".", "check");
      }, {
        title: "Choose your name",
        copy: "This is how you will appear in Global Chat.",
        success: "Name saved. Opening your workspace..."
      });
    }).catch(function () {
      mount.innerHTML = '<div class="neo-login-load-error" role="alert"><strong>Name service unavailable</strong><p>Continue without chat, then try again from the account button.</p></div>';
    });
  }

  function restartShell() {
    try { sessionStorage.removeItem(BOOT_SESSION_KEY); } catch (error) {}
    window.location.reload();
  }

  function createFileItem(kind) {
    var win = openApp("files");
    if (!win) return Promise.resolve(false);
    return loadFilesRuntime().then(function (runtime) {
      return typeof runtime.openCreate === "function" ? runtime.openCreate(kind) : false;
    });
  }

  function handleWindowAction(button) {
    var win = button.closest(".neo-window");
    var action = button.getAttribute("data-window-action");
    if (action === "close") closeWindow(win);
    if (action === "minimize") minimizeWindow(win);
    if (action === "maximize") toggleMaximize(win);
  }

  function bindGlobalEvents() {
    window.addEventListener("neo-media-state", function (event) {
      var detail = event.detail || {};
      var source = "play:" + String(detail.source || "media");
      var isPlayingVideo = detail.active !== false && detail.playing === true && detail.kind === "video";
      if (isPlayingVideo) pauseMusicForVideoFocus();
      var shouldPrioritize = detail.active !== false
        && detail.playing === true
        && (detail.kind === "video" || detail.pauseWallpaper === true);
      if (shouldPrioritize) mediaPrioritySources.add(source);
      else mediaPrioritySources.delete(source);
      if (window.NEOWallpaperEngine && window.NEOWallpaperEngine.setMediaPriority) {
        window.NEOWallpaperEngine.setMediaPriority(mediaPrioritySources.size > 0);
      }
      if (detail.appId === "stream" && detail.playing === true && mediaPrioritySources.size > 0 && pauseMusicForVideoFocus()) return;
      renderNowPlaying(detail);
    });
    window.addEventListener("neo-media-priority", function (event) {
      var detail = event.detail || {};
      var source = "intent:" + String(detail.source || "media");
      var shouldPrioritize = detail.active === true
        && (detail.kind === "video" || detail.pauseWallpaper === true);
      if (shouldPrioritize) mediaPrioritySources.add(source);
      else mediaPrioritySources.delete(source);
      if (window.NEOWallpaperEngine && window.NEOWallpaperEngine.setMediaPriority) {
        window.NEOWallpaperEngine.setMediaPriority(mediaPrioritySources.size > 0);
      }
    });
    window.addEventListener("neo-media-levels", function (event) {
      renderNowPlayingLevels(event.detail || {});
    });

    if (launcherDismissLayer) launcherDismissLayer.addEventListener("click", function (event) {
      event.preventDefault();
      setLauncherOpen(false);
    });

    if (launcher) launcher.addEventListener("click", function (event) {
      if (event.target.closest("[data-app], input, button, a, label, select, textarea, [role='button'], [role='option']")) return;
      setLauncherOpen(false);
    });

    if (launcher && launcherScroll) launcher.addEventListener("wheel", function (event) {
      if (event.ctrlKey || event.target.closest(".launcher-scroll-region")) return;
      var scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? launcherScroll.clientHeight : 1;
      var before = launcherScroll.scrollTop;
      launcherScroll.scrollTop += event.deltaY * scale;
      if (launcherScroll.scrollTop !== before) event.preventDefault();
    }, { passive: false });

    document.addEventListener("click", function (event) {
      if (!launcher.hidden && !event.target.closest("#app-launcher, [data-open-launcher]")) setLauncherOpen(false);
      var volumeTrigger = event.target.closest("[data-now-playing-volume-trigger]");
      if (volumeTrigger) {
        event.preventDefault();
        var opening = !nowPlayingWidget.classList.contains("is-volume-open");
        nowPlayingWidget.classList.toggle("is-volume-open", opening);
        volumeTrigger.setAttribute("aria-expanded", String(opening));
        return;
      }
      if (nowPlayingWidget && nowPlayingWidget.classList.contains("is-volume-open") && !event.target.closest(".now-playing-widget")) closeNowPlayingVolume();
      var notificationToggle = event.target.closest("[data-notification-toggle]");
      if (notificationToggle) {
        event.preventDefault();
        loadFeatureRuntime().then(function (runtime) { runtime.toggleNotifications(notificationToggle); });
        return;
      }
      var nowPlaying = event.target.closest("[data-now-playing-action]");
      if (nowPlaying) {
        event.preventDefault();
        if (!nowPlayingWidget || nowPlayingWidget.querySelector(".now-playing-controls").hidden) return;
        if (nowPlayingState && nowPlayingState.source === "audiobooks") {
          window.dispatchEvent(new CustomEvent("neo-media-transport-request", {
            detail: { source: nowPlayingState.source, action: nowPlaying.dataset.nowPlayingAction }
          }));
        } else {
          loadFeatureRuntime().then(function (runtime) { runtime.transport(nowPlaying.dataset.nowPlayingAction); });
        }
        return;
      }
      var accountButton = event.target.closest("[data-topbar-account]");
      if (accountButton) {
        event.preventDefault();
        if (nativeChatSession().id) openApp("chat");
        else openBrowserPage("sign-in", "Choose a name");
        return;
      }
      var chatSection = event.target.closest("[data-open-chat-section]");
      if (chatSection) {
        event.preventDefault();
        var chatWindow = openApp("chat");
        if (chatWindow) requestAnimationFrame(function () {
          chatWindow.dispatchEvent(new CustomEvent("neo-chat-open-section", { detail: { section: chatSection.dataset.openChatSection } }));
        });
        return;
      }
      if (event.target.closest("[data-shell-refresh]")) {
        restartShell();
        return;
      }
      var appButton = event.target.closest("[data-app]");
      if (appButton) {
        event.preventDefault();
        openApp(appButton.getAttribute("data-app"));
        return;
      }
      var launcherButton = event.target.closest("[data-open-launcher]");
      if (launcherButton) {
        setLauncherOpen(launcher.hidden, launcherButton);
        return;
      }
      var launcherToggle = event.target.closest("[data-launcher-toggle-all]");
      if (launcherToggle) {
        launcherShowAll = !launcherShowAll;
        renderLauncher();
        return;
      }
      if (event.target.closest("[data-close-launcher]")) {
        setLauncherOpen(false);
        return;
      }
      var windowAction = event.target.closest("[data-window-action]");
      if (windowAction) {
        handleWindowAction(windowAction);
        return;
      }
      var taskbarMaterial = event.target.closest("[data-taskbar-material]");
      if (taskbarMaterial) {
        var material = taskbarMaterial.getAttribute("data-taskbar-material");
        var preset = { clear: [0, 0], transparent: [28, 0], blur: [55, 18], acrylic: [78, 28], opaque: [100, 0] }[material];
        settings.taskbarMaterial = material;
        settings.taskbarOpacity = preset[0];
        settings.taskbarBlur = preset[1];
        applySettings();
        return;
      }
      var wallpaper = event.target.closest("[data-wallpaper-option]");
      if (wallpaper && !wallpaper.closest("[data-wallpaper-studio]")) {
        setSetting("wallpaper", wallpaper.getAttribute("data-wallpaper-option"));
        showToast("Wallpaper changed", wallpaper.querySelector("strong").textContent + " is active.", "image");
        return;
      }
      if (event.target.closest("[data-wallpaper-reset]")) {
        resetCustomWallpaper();
        return;
      }
      if (event.target.closest("[data-reset-layout]")) {
        resetLayout();
        return;
      }
      var direct = event.target.closest("[data-frame-direct]");
      if (direct) {
        var route = direct.getAttribute("data-frame-direct");
        if (window.NEOFrameLoader) {
          window.NEOFrameLoader.open(route).catch(function () {
            showToast("Could not open app", "Please try again.", "apps");
          });
        } else {
          window.open(route, "_blank", "noopener,noreferrer");
        }
        return;
      }
    });

    document.addEventListener("input", function (event) {
      var input = event.target;
      if (input.matches && input.matches("[data-now-playing-volume]")) {
        setNowPlayingVolume(Number(input.value) / 100);
        return;
      }
      if (input === launcherSearch) {
        launcherSelectedIndex = 0;
        filterLauncher(input.value);
        return;
      }
      var settingName = input.getAttribute && input.getAttribute("data-setting");
      if (!settingName || input.type === "checkbox" || input.tagName === "SELECT") return;
      var value = input.type === "range" ? Number(input.value) : input.value;
      setSetting(settingName, value);
    });

    document.addEventListener("change", function (event) {
      var input = event.target;
      if (input.matches("[data-wallpaper-upload]")) {
        handleWallpaperUpload(input);
        return;
      }
      var settingName = input.getAttribute && input.getAttribute("data-setting");
      if (!settingName) return;
      var value = input.type === "checkbox" ? input.checked : input.value;
      setSetting(settingName, value);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Control") {
        if (!event.repeat && !event.altKey && !event.metaKey && !event.shiftKey) ctrlTapCandidate = true;
        return;
      }
      if (ctrlTapCandidate) ctrlTapCandidate = false;
      if (event.key === "Escape" && nowPlayingWidget && nowPlayingWidget.classList.contains("is-volume-open")) {
        closeNowPlayingVolume();
        return;
      }
      if (event.key === "Escape" && !launcher.hidden) {
        event.preventDefault();
        setLauncherOpen(false);
        return;
      }
      if (event.key === "Escape" && window.NEO_FEATURES && !event.target.closest("#desktop-context-menu")) window.NEO_FEATURES.closeOverlays();
      if ((event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) && !event.target.closest("input, textarea, select, iframe")) {
        event.preventDefault();
        var anchor = document.activeElement && document.activeElement.getBoundingClientRect ? document.activeElement.getBoundingClientRect() : null;
        var menuX = anchor && anchor.width ? anchor.left + Math.min(anchor.width, 24) : window.innerWidth / 2;
        var menuY = anchor && anchor.height ? anchor.top + Math.min(anchor.height, 24) : window.innerHeight / 2;
        loadFeatureRuntime().then(function (runtime) { runtime.openDesktopMenu(menuX, menuY); });
        return;
      }
      if (!launcher.hidden && event.target === launcherSearch && event.key === "ArrowDown") {
        event.preventDefault();
        moveLauncherSelection(1);
        return;
      }
      if (!launcher.hidden && event.target === launcherSearch && event.key === "ArrowUp") {
        event.preventDefault();
        moveLauncherSelection(-1);
        return;
      }
      if (!launcher.hidden && event.target === launcherSearch && event.key === "Enter") {
        var selectedResult = launcherResultList.querySelector('.search-result[aria-selected="true"]');
        if (selectedResult) {
          event.preventDefault();
          openApp(selectedResult.dataset.app);
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.code === "Space" && !event.target.closest("iframe, input, textarea, select")) {
        event.preventDefault();
        setLauncherOpen(launcher.hidden, document.activeElement);
      }
      if (!launcher.hidden && event.key === "Tab") trapLauncherFocus(event);
    });

    document.addEventListener("keyup", function (event) {
      if (event.key !== "Control") return;
      if (ctrlTapCandidate) {
        event.preventDefault();
        setLauncherOpen(launcher.hidden, document.activeElement);
      }
      ctrlTapCandidate = false;
    });

    document.addEventListener("pointerdown", function () { ctrlTapCandidate = false; }, { passive: true });
    document.addEventListener("pointerover", function (event) {
      var result = event.target.closest("[data-launcher-result-index]");
      if (!result) return;
      launcherSelectedIndex = Number(result.dataset.launcherResultIndex) || 0;
      moveLauncherSelection(0);
    }, { passive: true });
    window.addEventListener("blur", function () { ctrlTapCandidate = false; });

    document.addEventListener("contextmenu", function (event) {
      if (!event.target.closest("#neo-desktop") || event.target.closest(".neo-window, .taskbar, .app-launcher, button, input, textarea, select")) return;
      event.preventDefault();
      loadFeatureRuntime().then(function (runtime) { runtime.openDesktopMenu(event.clientX, event.clientY); });
    });

    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    window.addEventListener("resize", function () {
      fitDockToViewport(document.getElementById("neo-dock"));
      if (isSmallScreen()) {
        openWindows.forEach(function (win) { win.classList.remove("is-maximized"); });
      }
    }, { passive: true });
    document.addEventListener("visibilitychange", updateWeatherEngine);
    document.addEventListener("fullscreenchange", updateFullscreenState);
    document.addEventListener("webkitfullscreenchange", updateFullscreenState);
  }

  function updateFullscreenState() {
    root.dataset.fullscreen = document.fullscreenElement || document.webkitFullscreenElement ? "true" : "false";
  }

  function trapLauncherFocus(event) {
    var focusable = Array.from(launcher.querySelectorAll('button:not([hidden]):not([disabled]), input:not([hidden]):not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(function (node) { return node.offsetParent !== null; });
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function initCustomWallpaper() {
    deleteCustomWallpaper().catch(function () {}).then(function () {
      settings.wallpaperFavorites = settings.wallpaperFavorites.filter(function (id) { return id !== "custom"; });
      settings.wallpaperRecent = settings.wallpaperRecent.filter(function (id) { return id !== "custom"; });
      if (settings.wallpaper === "custom") settings.wallpaper = "we-steam-1403160205";
      applySettings();
    });
  }

  function init() {
    shellApi = {
      openApp: openApp,
      openWallpaperSource: openWallpaperSource,
      notify: showToast,
      icon: iconMarkup,
      getApps: function () {
        return launcherApps().map(function (app) {
          return { id: app.id, title: app.title, subtitle: app.subtitle, icon: app.icon, category: app.category, pinned: Boolean(app.pinned), installed: true, core: Boolean(app.core), hideName: Boolean(app.hideName), accessibleName: app.accessibleName || app.title };
        });
      },
      getStoreApps: function () {
        return storeApps().map(function (app) {
          return { id: app.id, title: app.title, subtitle: app.subtitle, icon: app.icon, category: app.category, pinned: Boolean(app.pinned), installed: Boolean(app.installed), core: Boolean(app.core), hideName: Boolean(app.hideName), accessibleName: app.accessibleName || app.title };
        });
      },
      setPinned: setAppPinned,
      setInstalled: setAppInstalled,
      isInstalled: function (id) { return Boolean(apps[id] && apps[id].installed); },
      getSetting: function (name) { return settings[name]; },
      setSetting: setSetting,
      resetLayout: resetLayout,
      refresh: restartShell,
      createFileItem: createFileItem,
      saveToFiles: function (name, blob, options) {
        return loadFilesRuntime().then(function (runtime) { return runtime.saveBlob(name, blob, options); });
      },
      isReducedMotion: effectiveReducedMotion
    };
    window.NEO_SHELL = shellApi;
    if (wallpaperEngine) {
      wallpaperEngine.init(document.querySelector(".wallpaper")).catch(function () {});
      wallpaperEngine.subscribe(function (state) {
        if (state && (state.reason === "fallback" || state.reason === "alias") && state.id && settings.wallpaper !== state.id) {
          settings.wallpaper = state.id;
          settings.wallpaperPaused = false;
          root.dataset.wallpaper = state.id;
          writeJson(SETTINGS_KEY, settings);
          syncSettingControls();
        }
        wallpaperStudios().forEach(refreshWallpaperStudio);
      });
    }
    renderDock();
    enableDockReordering();
    if (window.NEO_TASKBAR_PREVIEW) window.NEO_TASKBAR_PREVIEW.start(document.getElementById("neo-dock"), openWindows, apps, openApp, closeWindow);
    renderLauncher();
    applySettings();
    updateClock();
    updateConnection();
    updateTopbarAccount();
    initBatteryStatus();
    updateFullscreenState();
    setupWeatherCanvas();
    wireWidgetDrag();
    bindGlobalEvents();
    window.addEventListener("neo-auth-changed", updateTopbarAccount);
    initCustomWallpaper();
    initAccountGate();
    performBoot();
    scheduleBrowsePrewarm();
  }

  init();
})();
