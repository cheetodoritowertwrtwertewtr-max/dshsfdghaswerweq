(() => {
  "use strict";

  const pageBase = new URL("./", document.baseURI);
  const serviceWorkerUrl = new URL("sw.js?v=20260827-jet-v2", pageBase);
  const serviceWorkerScope = pageBase.pathname;
  const proxyBase = new URL("~/", pageBase).pathname;
  const relayCacheKey = "neo:jet:last-relay:v1";
  const relayHosts = [
    "cdn.northstreetumc.org",
    "cdn.vipersfootball.com",
    "cdn.pcesc.org",
    "cdn.kcchallengevbc.com",
    "cdn.slcbmooc.org",
    "wss://girlspreples.org/wi/",
  ];

  let initializePromise = null;
  let serviceWorkerPromise = null;
  let controller = null;
  let proxyFrame = null;
  let attachedFrame = null;
  let active = false;
  let lastVisibleUrl = "";

  function supports(value) {
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") &&
        url.origin !== location.origin;
    } catch {
      return false;
    }
  }

  function isProxyUrl(value) {
    // While Jet owns the frame, transient about:blank/original-looking URLs must
    // not be handed back to NEO's legacy renderer.
    if (active) return true;
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin && url.pathname.startsWith(proxyBase);
    } catch {
      return false;
    }
  }

  function normalizeRelay(value) {
    const relay = String(value || "").trim();
    if (!relay) return "";
    if (/^wss?:\/\//i.test(relay)) return relay.endsWith("/") ? relay : `${relay}/`;
    return `wss://${relay}/adblock/`;
  }

  function relayCandidates() {
    const values = [];
    try {
      values.push(localStorage.getItem("neo:wisp:last-working:v1"));
      values.push(localStorage.getItem("neo:wisp:v1"));
      values.push(localStorage.getItem(relayCacheKey));
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.endsWith(":neo:wisp:v1")) values.push(localStorage.getItem(key));
      }
    } catch {
      // The bundled relay list remains available when storage is unavailable.
    }
    values.push(...relayHosts);
    return [...new Set(values.map(normalizeRelay).filter(Boolean))];
  }

  function probeRelay(url) {
    return new Promise((resolve) => {
      let socket;
      let finished = false;
      const startedAt = performance.now();

      const finish = (latency = null) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        try { socket?.close(); } catch {}
        resolve(latency === null ? null : { url, latency });
      };

      const timer = window.setTimeout(() => finish(), 2500);
      try {
        socket = new WebSocket(url);
      } catch {
        finish();
        return;
      }

      socket.onopen = () => finish(Math.max(1, Math.round(performance.now() - startedAt)));
      socket.onerror = () => finish();
      socket.onclose = () => finish();
    });
  }

  async function selectRelay() {
    let healthy;
    try {
      healthy = await Promise.any(relayCandidates().map(async (url) => {
        const result = await probeRelay(url);
        if (!result) throw new Error(`Relay unavailable: ${url}`);
        return result;
      }));
    } catch {
      throw new Error("No compatible relay is currently reachable.");
    }
    try { localStorage.setItem(relayCacheKey, healthy.url); } catch {}
    return healthy.url;
  }

  function waitForWorkerState(worker, expectedState) {
    if (!worker || worker.state === expectedState) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("The compatibility service timed out.")), 8000);
      const onStateChange = () => {
        if (worker.state !== expectedState && worker.state !== "redundant") return;
        window.clearTimeout(timer);
        worker.removeEventListener("statechange", onStateChange);
        worker.state === expectedState ? resolve() : reject(new Error("The compatibility service was replaced."));
      };
      worker.addEventListener("statechange", onStateChange);
    });
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) throw new Error("This browser does not support service workers.");
    if (location.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(location.hostname)) {
      throw new Error("Secure browsing compatibility requires HTTPS.");
    }

    const registration = await navigator.serviceWorker.register(serviceWorkerUrl.href, {
      scope: serviceWorkerScope,
    });
    await registration.update();
    if (registration.installing) await waitForWorkerState(registration.installing, "activated");
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "neo:jet:activate" });
      await waitForWorkerState(registration.waiting, "activated");
    }
    await navigator.serviceWorker.ready;

    const current = navigator.serviceWorker.controller;
    if (current && current.scriptURL === serviceWorkerUrl.href) return current;

    // A page cannot safely swap an already-active proxy worker mid-request.
    // Reload once so every tab is routed by this exact, versioned worker.
    location.reload();
    return new Promise(() => {});
  }

  function ensureServiceWorker() {
    if (!serviceWorkerPromise) serviceWorkerPromise = registerServiceWorker();
    return serviceWorkerPromise;
  }

  async function initializeTransport(instance) {
    for (let attempt = 0; attempt < 28; attempt += 1) {
      try {
        await instance.init();
        return;
      } catch (error) {
        if (!String(error).includes("wasm not loaded")) throw error;
        await new Promise((resolve) => window.setTimeout(resolve, 95));
      }
    }
    throw new Error("The network transport did not initialize in time.");
  }

  async function initialize() {
    if (initializePromise) return initializePromise;
    initializePromise = (async () => {
      if (!globalThis.$scramjetController?.Controller) throw new Error("The Jet runtime did not load.");
      await ensureServiceWorker();

      const relay = await selectRelay();
      const transportModule = await import(new URL("curl/index.mjs", pageBase).href);
      const transport = new transportModule.default({ wisp: relay });
      await initializeTransport(transport);

      controller = new globalThis.$scramjetController.Controller({
        serviceworker: navigator.serviceWorker.controller,
        transport,
        config: {
          scramjetPath: new URL("jet/jet.core.js", pageBase).href,
          wasmPath: new URL("jet/jet.wasm", pageBase).href,
          injectPath: new URL("jet/jet.inject.js", pageBase).href,
          virtualWasmPath: "jet.wasm.js",
          codec: {
            encode: (value) => value ? encodeURIComponent(value) : value,
            decode: (value) => value ? decodeURIComponent(value) : value,
          },
          prefix: proxyBase,
        },
        scramjetConfig: {
          maskedfiles: ["jet.inject.js", "jet.wasm.js"],
        },
      });
      await controller.wait();
      return controller;
    })().catch((error) => {
      initializePromise = null;
      throw error;
    });
    return initializePromise;
  }

  function originalUrl() {
    if (!proxyFrame || !attachedFrame) return "";
    try {
      const current = new URL(attachedFrame.contentWindow?.location?.href || attachedFrame.src);
      if (!current.pathname.startsWith(proxyFrame.prefix)) return "";
      return decodeURIComponent(current.pathname.slice(proxyFrame.prefix.length));
    } catch {
      return "";
    }
  }

  function emitUrl(url) {
    if (!url || url === lastVisibleUrl) return;
    lastVisibleUrl = url;
    window.dispatchEvent(new CustomEvent("neo:scramjet:urlchange", { detail: { url } }));
  }

  function attachFrame(frameElement) {
    if (proxyFrame && attachedFrame === frameElement) return proxyFrame;
    proxyFrame = controller.createFrame(frameElement);
    attachedFrame = frameElement;
    frameElement.addEventListener("load", () => {
      if (!active || !isProxyUrl(frameElement.src)) return;
      emitUrl(originalUrl());
      let title = "";
      try { title = frameElement.contentDocument?.title || ""; } catch {}
      window.dispatchEvent(new CustomEvent("neo:scramjet:ready", { detail: { title } }));
    });
    return proxyFrame;
  }

  async function go(url, frameElement) {
    await initialize();
    const frame = attachFrame(frameElement);
    active = true;
    lastVisibleUrl = String(url);
    frameElement.dataset.neoScramjet = "true";
    frameElement.removeAttribute("srcdoc");
    frameElement.style.opacity = "1";
    frame.go(url);
  }

  function deactivate() {
    active = false;
    if (attachedFrame) delete attachedFrame.dataset.neoScramjet;
  }

  window.setInterval(() => {
    if (active) emitUrl(originalUrl());
  }, 500);

  globalThis.NeoScramjet = Object.freeze({
    supports,
    isProxyUrl,
    go,
    deactivate,
    get active() { return active; },
  });

  // Install and claim the transport before the first address-bar submission.
  ensureServiceWorker().catch(() => {});
})();
