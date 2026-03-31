/**
 * Eventra — Login page script
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
        const code = (err as any).code as string | undefined;
        if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
          showMessage("Incorrect email or password.");
        } else if (code === "auth/too-many-requests") {
          showMessage("Too many failed attempts. Please try again later.");
        } else if (code === "auth/user-disabled") {
          showMessage("This account has been disabled.");
        } else if (code === "auth/configuration-not-found") {
          showMessage("Auth not configured. Enable Email/Password in Firebase Console \u2192 Authentication.");
        } else {
          showMessage(err.message || "Login failed.");
        }
        btn.disabled = false;
      });
  });
})();
