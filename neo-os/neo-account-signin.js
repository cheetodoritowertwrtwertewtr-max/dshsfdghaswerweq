export function mountAccountSignIn(container, show, onSuccess, options) {
  var copyOptions = options || {};
  var template = document.getElementById("neo-account-sign-in-template");
  if (!template) throw new Error("missing_name_template");
  var destroyed = false;
  var controller = null;
  var timeout = 0;
  container.replaceChildren(template.content.cloneNode(true));
  show();

  var form = container.querySelector("[data-neo-sign-in-form]");
  var title = container.querySelector("#neo-browser-sign-in-title");
  var copy = container.querySelector("[data-neo-auth-copy]");
  var usernameInput = form.querySelector('input[name="username"]');
  var submitButton = form.querySelector("[data-neo-sign-in-submit]");
  var feedback = form.querySelector("[data-neo-sign-in-feedback]");

  title.textContent = copyOptions.title || "Choose your name";
  copy.textContent = copyOptions.copy || "Pick the name people will see in Global Chat.";

  function accountEndpoint() {
    var functionPath = "/.netlify/functions/account-name";
    return window.location.protocol === "file:"
      ? "http://127.0.0.1:4195" + functionPath
      : functionPath;
  }

  function stopRequest() {
    window.clearTimeout(timeout);
    timeout = 0;
    if (controller) controller.abort();
    controller = null;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var username = usernameInput.value.trim();
    feedback.classList.remove("is-error", "is-success");
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      feedback.textContent = "Use 3-24 letters, numbers, or underscores.";
      feedback.classList.add("is-error");
      usernameInput.focus();
      return;
    }

    stopRequest();
    controller = new AbortController();
    var activeController = controller;
    timeout = window.setTimeout(function () { activeController.abort(); }, 6500);
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
    feedback.textContent = "Saving your chat name...";

    fetch(accountEndpoint(), {
      method: "POST",
      credentials: window.location.protocol === "file:" ? "omit" : "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username }),
      signal: activeController.signal
    }).then(function (response) {
      var contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error("The name service is unavailable.");
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok) throw new Error(payload.detail || "Your name could not be saved.");
        if (!payload.token || !payload.user) throw new Error("The name service returned an incomplete response.");
        return payload;
      });
    }).then(function (payload) {
      if (destroyed) return;
      localStorage.setItem("ugp_token", payload.token);
      localStorage.setItem("ugp_session", JSON.stringify(payload.user));
      feedback.textContent = copyOptions.success || "Name saved. Opening Global Chat...";
      feedback.classList.add("is-success");
      submitButton.textContent = "Ready";
      onSuccess(payload);
    }).catch(function (error) {
      if (destroyed) return;
      var localServerUnavailable = window.location.protocol === "file:" && error && error.name === "TypeError";
      feedback.textContent = localServerUnavailable
        ? "The name service is not running. Open NEO OS from its local address."
        : error && error.name === "AbortError"
          ? "Saving your name took too long. Try again."
          : (error && error.message ? error.message : "Your name could not be saved.");
      feedback.classList.add("is-error");
      submitButton.disabled = false;
      submitButton.textContent = "Continue";
      usernameInput.select();
    }).finally(function () {
      if (controller === activeController) stopRequest();
    });
  });

  requestAnimationFrame(function () { if (!destroyed) usernameInput.focus({ preventScroll: true }); });
  return function () {
    destroyed = true;
    stopRequest();
  };
}
