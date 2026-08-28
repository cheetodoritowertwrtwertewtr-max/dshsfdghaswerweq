(() => {
  "use strict";

  // The current NEO transport owns all remote navigation. Keep the small
  // legacy API surface so older browser-shell code can start immediately
  // without loading a second WebAssembly network stack.
  class LegacySession {
    set_connections() {}

    fetch() {
      return Promise.reject(new Error("The legacy transport is disabled."));
    }

    close() {}
  }

  globalThis.libcurl = {
    load_wasm: () => Promise.resolve(),
    set_websocket: () => {},
    HTTPSession: LegacySession,
  };

  queueMicrotask(() => document.dispatchEvent(new Event("libcurl_load")));
})();
