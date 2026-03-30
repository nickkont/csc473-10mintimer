/**
 * Eventra — Sign-up page script
 * Handles form submission and delegates to EventraAuth.signUp.
 */
((): void => {
  const form = document.getElementById("signup-form") as HTMLFormElement | null;
  const btn = document.getElementById("signup-btn") as HTMLButtonElement | null;
  const msg = document.getElementById("signup-message") as HTMLElement | null;

  if (!form || !btn || !msg) return;

  function showMessage(text: string, type?: string): void {
    if (!msg) return;
    msg.textContent = text;
    msg.className = "auth-message show " + (type ?? "error");
  }

  form.addEventListener("submit", (e: Event): void => {
    e.preventDefault();
    const email = (document.getElementById("signup-email") as HTMLInputElement).value.trim();
    const password = (document.getElementById("signup-password") as HTMLInputElement).value;
    const displayName = (document.getElementById("signup-name") as HTMLInputElement).value.trim() || null;

    if (!email || !password) {
      showMessage("Please enter email and password (min 6 characters).");
      return;
    }
    if (password.length < 6) {
      showMessage("Password must be at least 6 characters.");
      return;
    }

    btn.disabled = true;
    msg.className = "auth-message";

    window.EventraAuth.signUp(email, password, displayName)
      .then((): void => {
        showMessage("Account created. Redirecting\u2026", "success");
        window.location.href = "account.html";
      })
      .catch((err: Error & { code?: string }): void => {
        if (err.code === "auth/configuration-not-found") {
          showMessage(
            "Auth not set up. In Firebase Console: Build \u2192 Authentication \u2192 Get started, then enable Email/Password under Sign-in method."
          );
        } else {
          showMessage(err.message || "Sign up failed.");
        }
        btn.disabled = false;
      });
  });
})();
