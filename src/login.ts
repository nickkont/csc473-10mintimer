/**
 * Eventra — Login page script
 * Handles form submission and delegates to EventraAuth.signIn.
 */
((): void => {
  const form = document.getElementById("login-form") as HTMLFormElement | null;
  const btn = document.getElementById("login-btn") as HTMLButtonElement | null;
  const msg = document.getElementById("login-message") as HTMLElement | null;

  if (!form || !btn || !msg) return;

  function showMessage(text: string, type?: string): void {
    if (!msg) return;
    msg.textContent = text;
    msg.className = "auth-message show " + (type ?? "error");
  }

  form.addEventListener("submit", (e: Event): void => {
    e.preventDefault();
    const email = (document.getElementById("login-email") as HTMLInputElement).value.trim();
    const password = (document.getElementById("login-password") as HTMLInputElement).value;

    if (!email || !password) {
      showMessage("Please enter email and password.");
      return;
    }

    btn.disabled = true;
    msg.className = "auth-message";

    window.EventraAuth.signIn(email, password)
      .then((): void => {
        showMessage("Signed in. Redirecting\u2026", "success");
        window.location.href = "account.html";
      })
      .catch((err: Error & { code?: string }): void => {
        if (err.code === "auth/configuration-not-found") {
          showMessage(
            "Auth not set up. In Firebase Console: Build \u2192 Authentication \u2192 Get started, then enable Email/Password under Sign-in method."
          );
        } else {
          showMessage(err.message || "Login failed.");
        }
        btn.disabled = false;
      });
  });
})();
