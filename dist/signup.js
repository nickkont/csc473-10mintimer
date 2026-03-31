"use strict";
/**
 * Eventra — Sign-up page script
 * Creates Firebase Auth user and initial Firestore user document (with wallet).
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
        const db = firebase.firestore();
        window.EventraAuth.signUp(email, password, displayName)
            .then((result) => {
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
            .then(() => {
            showMessage("Account created. Redirecting\u2026", "success");
            window.location.href = "react-dist/index.html#/account";
        })
            .catch((err) => {
            const code = err.code;
            if (code === "auth/email-already-in-use") {
                showMessage("An account with this email already exists.");
            }
            else if (code === "auth/weak-password") {
                showMessage("Password is too weak. Use at least 6 characters.");
            }
            else if (code === "auth/invalid-email") {
                showMessage("Please enter a valid email address.");
            }
            else if (code === "auth/configuration-not-found") {
                showMessage("Auth not configured. Enable Email/Password in Firebase Console \u2192 Authentication.");
            }
            else {
                showMessage(err.message || "Sign up failed.");
            }
            btn.disabled = false;
        });
    });
})();
