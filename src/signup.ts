/**
 * Eventra — Sign-up page script
 * Creates Firebase Auth user and initial Firestore user document (with wallet).
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

    const db = firebase.firestore();

    window.EventraAuth.signUp(email, password, displayName)
      .then((result: AuthResult): Promise<void> => {
        const uid = result.user.uid;
        return db.collection("users").doc(uid).set({
          email: result.user.email,
          displayName: displayName || "",
          firstName: "",
          lastName: "",
          username: "",
          phone: "",
          dob: "",
          timezone: "ET",
          language: "en",
          bio: "",
          walletBalance: 100,
          role: "user",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      })
      .then((): void => {
        showMessage("Account created. Redirecting\u2026", "success");
        window.location.href = "account.html";
      })
      .catch((err: Error & { code?: string }): void => {
        const code = (err as any).code as string | undefined;
        if (code === "auth/email-already-in-use") {
          showMessage("An account with this email already exists.");
        } else if (code === "auth/weak-password") {
          showMessage("Password is too weak. Use at least 6 characters.");
        } else if (code === "auth/invalid-email") {
          showMessage("Please enter a valid email address.");
        } else if (code === "auth/configuration-not-found") {
          showMessage("Auth not configured. Enable Email/Password in Firebase Console \u2192 Authentication.");
        } else {
          showMessage(err.message || "Sign up failed.");
        }
        btn.disabled = false;
      });
  });
})();
