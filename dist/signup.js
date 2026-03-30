"use strict";
/**
 * Eventra — Sign-up page script
 * Handles form submission and delegates to EventraAuth.signUp.
 */
(() => {
    const form = document.getElementById("signup-form");
    const btn = document.getElementById("signup-btn");
    const msg = document.getElementById("signup-message");
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
        const email = document.getElementById("signup-email").value.trim();
        const password = document.getElementById("signup-password").value;
        const displayName = document.getElementById("signup-name").value.trim() || null;
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
            .then(() => {
            showMessage("Account created. Redirecting\u2026", "success");
            window.location.href = "account.html";
        })
            .catch((err) => {
            if (err.code === "auth/configuration-not-found") {
                showMessage("Auth not set up. In Firebase Console: Build \u2192 Authentication \u2192 Get started, then enable Email/Password under Sign-in method.");
            }
            else {
                showMessage(err.message || "Sign up failed.");
            }
            btn.disabled = false;
        });
    });
})();
