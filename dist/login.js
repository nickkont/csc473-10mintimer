"use strict";
/**
 * Eventra — Login page script
 */
(() => {
    const form = document.getElementById("login-form");
    const btn = document.getElementById("login-btn");
    const msg = document.getElementById("login-message");
    if (!form || !btn || !msg)
        return;
    function showMessage(text, type) {
        if (!msg)
            return;
        msg.textContent = text;
        msg.className = "auth-message show " + (type !== null && type !== void 0 ? type : "error");
    }
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;
        if (!email || !password) {
            showMessage("Please enter email and password.");
            return;
        }
        btn.disabled = true;
        msg.className = "auth-message";
        window.EventraAuth.signIn(email, password)
            .then(() => {
            showMessage("Signed in. Redirecting\u2026", "success");
            window.location.href = "account.html";
        })
            .catch((err) => {
            const code = err.code;
            if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
                showMessage("Incorrect email or password.");
            }
            else if (code === "auth/too-many-requests") {
                showMessage("Too many failed attempts. Please try again later.");
            }
            else if (code === "auth/user-disabled") {
                showMessage("This account has been disabled.");
            }
            else if (code === "auth/configuration-not-found") {
                showMessage("Auth not configured. Enable Email/Password in Firebase Console \u2192 Authentication.");
            }
            else {
                showMessage(err.message || "Login failed.");
            }
            btn.disabled = false;
        });
    });
})();
