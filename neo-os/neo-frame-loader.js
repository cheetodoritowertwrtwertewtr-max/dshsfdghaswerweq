(function () {
  "use strict";

  var activeLoads = new WeakMap();
  var LARGE_DOCUMENT_BYTES = 4 * 1024 * 1024;

  function isRunner() {
    return Boolean(document.querySelector('meta[name="neo-runner"]'));
  }

  function resolveUrl(route) {
    return new URL(String(route || ""), document.baseURI).href;
  }

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function prepareDocument(source, sourceUrl) {
    var baseUrl = new URL("./", sourceUrl).href;
    var html = String(source || "");
    html = html.replace(/<script\b(?=[^>]*\bsrc\s*=\s*["']\/ad-cleanup\.js(?:[?#][^"']*)?["'])[^>]*>\s*<\/script>/gi, "");
    var hasAssetBase = /<base\b[^>]*\bhref\s*=/i.test(html);
    var injection = (hasAssetBase ? "" : '<base href="' + escapeAttribute(baseUrl) + '" target="_self">') +
      '<meta name="neo-runner" content="nested">';
    if (/<head(?:\s[^>]*)?>/i.test(html)) {
      return html.replace(/<head(?:\s[^>]*)?>/i, function (head) {
        return head + injection;
      });
    }
    if (/<html(?:\s[^>]*)?>/i.test(html)) {
      return html.replace(/<html(?:\s[^>]*)?>/i, function (root) {
        return root + "<head>" + injection + "</head>";
      });
    }
    return "<!doctype html><html><head>" + injection + "</head><body>" + html + "</body></html>";
  }

  function documentCandidates(sourceUrl) {
    var candidates = [sourceUrl];
    try {
      var parsed = new URL(sourceUrl);
      var match = parsed.pathname.match(/^\/gh\/([^/]+)\/([^/@]+)@([^/]+)\/(.+)$/);
      if (/\.jsdelivr\.net$/i.test(parsed.hostname) && match) {
        var rawUrl = "https://raw.githubusercontent.com/" + match.slice(1).join("/");
        candidates.push(rawUrl);
      }
    } catch (_error) {}
    return candidates;
  }

  function fetchDocument(sourceUrl, options, signal) {
    var candidates = documentCandidates(sourceUrl);
    var lastError = null;

    function attempt(index) {
      if (index >= candidates.length) return Promise.reject(lastError || new Error("The app could not be loaded."));
      var candidate = candidates[index];
      return fetch(candidate, {
        cache: options.cache || "force-cache",
        credentials: "omit",
        signal: signal
      }).then(function (response) {
        if (!response.ok) throw new Error("HTML request failed with status " + response.status + ".");
        return response.text();
      }).then(function (html) {
        return { html: html, fetchedUrl: candidate };
      }).catch(function (error) {
        if (error && error.name === "AbortError") throw error;
        lastError = error;
        return attempt(index + 1);
      });
    }

    return attempt(0);
  }

  function cancel(frame) {
    var previous = activeLoads.get(frame);
    if (previous && previous.controller) previous.controller.abort();
    if (previous && previous.objectUrl) URL.revokeObjectURL(previous.objectUrl);
    activeLoads.delete(frame);
  }

  function load(frame, route, options) {
    options = options || {};
    var sourceUrl = resolveUrl(route);
    cancel(frame);

    if (!isRunner() && options.forceFetch !== true) {
      frame.removeAttribute("srcdoc");
      frame.src = sourceUrl;
      return Promise.resolve({ mode: "url", url: sourceUrl });
    }

    var state = { controller: new AbortController(), objectUrl: "" };
    activeLoads.set(frame, state);
    return fetchDocument(sourceUrl, options, state.controller.signal).then(function (result) {
      var html = result.html;
      if (activeLoads.get(frame) !== state) throw new DOMException("Frame load replaced.", "AbortError");
      if (!/<(?:!doctype|html|head|body)\b/i.test(html)) throw new Error("The requested file is not an HTML document.");
      var prepared = prepareDocument(html, sourceUrl);
      state.controller = null;
      if (prepared.length >= LARGE_DOCUMENT_BYTES && typeof Blob === "function" && URL.createObjectURL) {
        state.objectUrl = URL.createObjectURL(new Blob([prepared], { type: "text/html;charset=utf-8" }));
        frame.removeAttribute("srcdoc");
        frame.src = state.objectUrl;
        return { mode: "blob", url: sourceUrl, fetchedUrl: result.fetchedUrl };
      }
      activeLoads.delete(frame);
      frame.removeAttribute("src");
      frame.srcdoc = prepared;
      return { mode: "srcdoc", url: sourceUrl, fetchedUrl: result.fetchedUrl };
    }).catch(function (error) {
      if (activeLoads.get(frame) === state) activeLoads.delete(frame);
      throw error;
    });
  }

  function openDocument(route) {
    var sourceUrl = resolveUrl(route);
    if (!isRunner()) {
      window.open(sourceUrl, "_blank", "noopener,noreferrer");
      return Promise.resolve();
    }

    var popup = window.open("about:blank", "_blank");
    if (!popup) return Promise.reject(new Error("Pop-ups are blocked."));
    popup.document.open();
    popup.document.write("<!doctype html><title>Opening...</title><style>html,body{height:100%;margin:0;background:#000;color:#fff;font:14px system-ui;display:grid;place-items:center}</style><p>Opening...</p>");
    popup.document.close();
    return fetchDocument(sourceUrl, { cache: "force-cache" }).then(function (result) {
      popup.document.open();
      popup.document.write(prepareDocument(result.html, sourceUrl));
      popup.document.close();
      popup.focus();
    }).catch(function (error) {
      try {
        popup.document.body.textContent = "This app could not be opened. Please try again.";
      } catch (_error) {}
      throw error;
    });
  }

  window.NEOFrameLoader = {
    cancel: cancel,
    isRunner: isRunner,
    load: load,
    open: openDocument,
    prepare: prepareDocument,
    resolve: resolveUrl
  };
})();
