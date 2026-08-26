export function mountAccountSignIn(container, show, onSuccess, options) {
  var copyOptions = options || {};
  var template = document.getElementById("neo-account-sign-in-template");
  if (!template) throw new Error("missing_sign_in_template");
  var destroyed = false;
  var controller = null;
  var timeout = 0;
  container.replaceChildren(template.content.cloneNode(true));
  show();

  var form = container.querySelector("[data-neo-sign-in-form]");
  var title = container.querySelector("#neo-browser-sign-in-title");
  var copy = container.querySelector("[data-neo-auth-copy]");
  var modeButtons = Array.from(container.querySelectorAll("[data-neo-auth-mode]"));
  var usernameInput = form.querySelector('input[name="username"]');
  var passwordInput = form.querySelector('input[name="password"]');
  var submitButton = form.querySelector("[data-neo-sign-in-submit]");
  var feedback = form.querySelector("[data-neo-sign-in-feedback]");
  var mode = "login";

  function accountEndpoint(requestMode) {
    var functionName = requestMode === "register" ? "account-register" : "account-login";
    var functionPath = "/.netlify/functions/" + functionName;
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

  function setMode(nextMode, focusForm) {
    mode = nextMode === "register" ? "register" : "login";
    var registering = mode === "register";
    title.textContent = registering
      ? (copyOptions.registerTitle || "Create a Messages account")
      : (copyOptions.loginTitle || "Sign in to Messages");
    copy.textContent = registering
      ? (copyOptions.registerCopy || "Choose a unique username and a password with at least 8 characters.")
      : (copyOptions.loginCopy || "Use your NEO username and password to continue.");
    submitButton.textContent = registering ? "Create account" : "Sign in";
    passwordInput.autocomplete = registering ? "new-password" : "current-password";
    usernameInput.minLength = registering ? 3 : 2;
    usernameInput.maxLength = registering ? 24 : 32;
    feedback.textContent = "";
    feedback.classList.remove("is-error", "is-success");
    modeButtons.forEach(function (button) {
      var selected = button.dataset.neoAuthMode === mode;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.tabIndex = selected ? 0 : -1;
    });
    if (focusForm) usernameInput.focus({ preventScroll: true });
  }

  modeButtons.forEach(function (button, index) {
    button.addEventListener("click", function () { setMode(button.dataset.neoAuthMode, true); });
    button.addEventListener("keydown", function (event) {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      var targetIndex = event.key === "Home" ? 0 : event.key === "End" ? modeButtons.length - 1 :
        (index + (event.key === "ArrowRight" ? 1 : -1) + modeButtons.length) % modeButtons.length;
      modeButtons[targetIndex].focus();
      setMode(modeButtons[targetIndex].dataset.neoAuthMode, false);
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var username = usernameInput.value.trim();
    var password = passwordInput.value;
    feedback.classList.remove("is-error", "is-success");
    if (!username || !password) {
      feedback.textContent = "Enter your username and password.";
      feedback.classList.add("is-error");
      (username ? passwordInput : usernameInput).focus();
      return;
    }
    if (mode === "register" && !/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      feedback.textContent = "Use 3-24 letters, numbers, or underscores.";
      feedback.classList.add("is-error");
      usernameInput.focus();
      return;
    }
    if (mode === "register" && password.length < 8) {
      feedback.textContent = "Password must be at least 8 characters.";
      feedback.classList.add("is-error");
      passwordInput.focus();
      return;
    }

    stopRequest();
    var requestMode = mode;
    controller = new AbortController();
    var activeController = controller;
    timeout = window.setTimeout(function () { activeController.abort(); }, 6500);
    submitButton.disabled = true;
    modeButtons.forEach(function (button) { button.disabled = true; });
    submitButton.textContent = requestMode === "register" ? "Creating account..." : "Signing in...";
    feedback.textContent = requestMode === "register" ? "Securing your new account..." : "Checking your NEO account...";

    fetch(accountEndpoint(requestMode), {
      method: "POST",
      credentials: window.location.protocol === "file:" ? "omit" : "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, password: password }),
      signal: activeController.signal
    }).then(function (response) {
      var contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error("Sign in is unavailable in this preview.");
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok) throw new Error(payload.detail || (requestMode === "register" ? "Could not create account." : "Could not sign in."));
        if (!payload.token || !payload.user) throw new Error("The sign-in response was incomplete.");
        return payload;
      });
    }).then(function (payload) {
      if (destroyed) return;
      localStorage.setItem("ugp_token", payload.token);
      localStorage.setItem("ugp_session", JSON.stringify(payload.user));
      passwordInput.value = "";
      feedback.textContent = requestMode === "register"
        ? (copyOptions.registerSuccess || "Account created. Opening Messages...")
        : (copyOptions.loginSuccess || "Signed in. Opening Messages...");
      feedback.classList.add("is-success");
      submitButton.textContent = requestMode === "register" ? "Account created" : "Signed in";
      onSuccess(payload);
    }).catch(function (error) {
      if (destroyed) return;
      var localServerUnavailable = window.location.protocol === "file:" && error && error.name === "TypeError";
      feedback.textContent = localServerUnavailable
        ? "Account server is not running. Open NEO OS at http://127.0.0.1:4195/neo-os/."
        : error && error.name === "AbortError"
        ? (requestMode === "register" ? "Registration took too long. Try again." : "Sign in took too long. Try again.")
        : (error && error.message ? error.message : (requestMode === "register" ? "Could not create account." : "Could not sign in."));
      feedback.classList.add("is-error");
      submitButton.disabled = false;
      submitButton.textContent = mode === "register" ? "Create account" : "Sign in";
      modeButtons.forEach(function (button) { button.disabled = false; });
      passwordInput.select();
    }).finally(function () {
      if (controller === activeController) stopRequest();
    });
  });

  setMode("login", false);
  requestAnimationFrame(function () { if (!destroyed) usernameInput.focus({ preventScroll: true }); });
  return function () {
    destroyed = true;
    stopRequest();
  };
}
