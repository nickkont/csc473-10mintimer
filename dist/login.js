"use strict";
/**
 * Eventra — Login page script
 * Handles form submission and delegates to EventraAuth.signIn.
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
            if (err.code === "auth/configuration-not-found") {
                showMessage("Auth not set up. In Firebase Console: Build \u2192 Authentication \u2192 Get started, then enable Email/Password under Sign-in method.");
            }
            else {
                showMessage(err.message || "Login failed.");
            }
            btn.disabled = false;
        });
    });
})();
