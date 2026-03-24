"use strict";
/**
 * Eventra — Account settings page script
 * Handles auth guard, profile load/save, account deletion,
 * and password-strength meter.
 */
// ── Auth / profile logic ────────────────────────────────────────────────────
(() => {
    const auth = window.EventraAuth;
    if (!auth)
        return;
    let currentUser = null;
    let lastProfileSnapshot = null;
    function redirectLogin() {
        window.location.href =
            "login.html?redirect=" +
                encodeURIComponent(window.location.pathname + window.location.search);
    }
    function setUser(user) {
        const emailEl = document.getElementById("profile-email");
        const navEmail = document.getElementById("nav-user-email");
        const avatar = document.getElementById("nav-avatar");
        if (emailEl)
            emailEl.value = user ? user.email : "";
        if (navEmail)
            navEmail.textContent = user ? user.email : "";
        if (avatar) {
            if (user && user.displayName) {
                avatar.textContent = (user.displayName
                    .trim()
                    .split(/\s+/)
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2) || user.email[0]).toUpperCase();
            }
            else if (user && user.email) {
                avatar.textContent = user.email[0].toUpperCase();
            }
            else {
                avatar.textContent = "?";
            }
        }
    }
    function applyProfile(data) {
        const first = document.getElementById("profile-first");
        const last = document.getElementById("profile-last");
        const username = document.getElementById("profile-username");
        const phone = document.getElementById("profile-phone");
        const dob = document.getElementById("profile-dob");
        const tz = document.getElementById("profile-timezone");
        const lang = document.getElementById("profile-language");
        const bio = document.getElementById("profile-bio");
        if (!data) {
            if (first)
                first.value = "";
            if (last)
                last.value = "";
            if (username)
                username.value = "";
            if (phone)
                phone.value = "";
            if (dob)
                dob.value = "";
            if (tz)
                tz.value = "ET";
            if (lang)
                lang.value = "en";
            if (bio)
                bio.value = "";
            return;
        }
        if (first)
            first.value = data.firstName || "";
        if (last)
            last.value = data.lastName || "";
        if (username)
            username.value = data.username || "";
        if (phone)
            phone.value = data.phone || "";
        if (dob)
            dob.value = data.dob || "";
        if (tz && data.timezone)
            tz.value = data.timezone;
        if (lang && data.language)
            lang.value = data.language;
        if (bio)
            bio.value = data.bio || "";
    }
    function loadProfile(user) {
        if (!user) {
            applyProfile(null);
            return;
        }
        try {
            const raw = localStorage.getItem("eventra_profile_" + user.email);
            const data = raw ? JSON.parse(raw) : null;
            lastProfileSnapshot = data;
            applyProfile(data);
        }
        catch (_a) {
            lastProfileSnapshot = null;
            applyProfile(null);
        }
    }
    auth.onAuthStateChanged((user) => {
        if (!user) {
            redirectLogin();
            return;
        }
        currentUser = user;
        setUser(user);
        loadProfile(user);
    });
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            auth.signOut().then(() => {
                window.location.href = "index.html";
            });
        });
    }
    const btnProfileSave = document.getElementById("btn-profile-save");
    const btnProfileCancel = document.getElementById("btn-profile-cancel");
    const profileMessage = document.getElementById("profile-message");
    function showProfileMessage(text, isError) {
        if (!profileMessage)
            return;
        profileMessage.textContent = text;
        profileMessage.className = "auth-message-inline show " + (isError ? "error" : "success");
    }
    if (btnProfileSave) {
        btnProfileSave.addEventListener("click", () => {
            if (!currentUser) {
                showProfileMessage("You must be signed in to save your profile.", true);
                return;
            }
            const payload = {
                firstName: document.getElementById("profile-first").value.trim(),
                lastName: document.getElementById("profile-last").value.trim(),
                username: document.getElementById("profile-username").value.trim(),
                phone: document.getElementById("profile-phone").value.trim(),
                dob: document.getElementById("profile-dob").value,
                timezone: document.getElementById("profile-timezone").value,
                language: document.getElementById("profile-language").value,
                bio: document.getElementById("profile-bio").value.trim(),
            };
            btnProfileSave.disabled = true;
            showProfileMessage("Saving profile\u2026", false);
            try {
                localStorage.setItem("eventra_profile_" + currentUser.email, JSON.stringify(payload));
                lastProfileSnapshot = payload;
                showProfileMessage("Profile saved (demo only, stored in this browser).", false);
            }
            catch (_a) {
                showProfileMessage("Could not save profile in this browser.", true);
            }
            finally {
                btnProfileSave.disabled = false;
            }
        });
    }
    if (btnProfileCancel) {
        btnProfileCancel.addEventListener("click", () => {
            applyProfile(lastProfileSnapshot);
            if (profileMessage)
                profileMessage.className = "auth-message-inline";
        });
    }
    // ── Delete account ──────────────────────────────────────────────────────
    const btnDelete = document.getElementById("btn-delete-account");
    const deleteReauthWrap = document.getElementById("delete-reauth-wrap");
    const deletePassword = document.getElementById("delete-password");
    const btnDeleteCancel = document.getElementById("btn-delete-cancel");
    const deleteMessage = document.getElementById("delete-message");
    function showDeleteMessage(text, isError) {
        if (!deleteMessage)
            return;
        deleteMessage.textContent = text;
        deleteMessage.className = "auth-message-inline show " + (isError ? "error" : "success");
    }
    if (btnDelete) {
        btnDelete.addEventListener("click", () => {
            if (!deleteReauthWrap || !deletePassword || !btnDeleteCancel || !deleteMessage)
                return;
            if (deleteReauthWrap.style.display === "none") {
                deleteReauthWrap.style.display = "block";
                btnDeleteCancel.style.display = "inline-block";
                btnDelete.textContent = "Confirm delete";
                deleteMessage.className = "auth-message-inline";
                deletePassword.value = "";
                return;
            }
            const pwd = deletePassword.value;
            if (!pwd) {
                showDeleteMessage("Enter your password to confirm.", true);
                return;
            }
            btnDelete.disabled = true;
            auth
                .reauthenticate(pwd)
                .then(() => auth.deleteAccount())
                .then(() => {
                showDeleteMessage("Account deleted. Redirecting\u2026", false);
                window.location.href = "index.html";
            })
                .catch((err) => {
                showDeleteMessage(err.message || "Could not delete account.", true);
                btnDelete.disabled = false;
            });
        });
    }
    if (btnDeleteCancel) {
        btnDeleteCancel.addEventListener("click", () => {
            if (!deleteReauthWrap || !deleteMessage || !btnDelete)
                return;
            deleteReauthWrap.style.display = "none";
            btnDeleteCancel.style.display = "none";
            btnDelete.textContent = "Delete my account";
            btnDelete.disabled = false;
            deleteMessage.className = "auth-message-inline";
        });
    }
})();
// ── Password-strength meter ─────────────────────────────────────────────────
window.strength = function (val) {
    const segs = ["s1", "s2", "s3", "s4"].map((id) => document.getElementById(id));
    const hint = document.getElementById("s-hint");
    segs.forEach((s) => { if (s)
        s.className = "seg"; });
    if (!val) {
        if (hint)
            hint.textContent = "\u2014";
        return;
    }
    let score = 0;
    if (val.length >= 8)
        score++;
    if (/[A-Z]/.test(val))
        score++;
    if (/[0-9]/.test(val))
        score++;
    if (/[^A-Za-z0-9]/.test(val))
        score++;
    const cls = score <= 1 ? "weak" : score <= 2 ? "medium" : "strong";
    const labels = ["", "Weak", "Fair", "Strong", "Very Strong"];
    for (let i = 0; i < score; i++) {
        if (segs[i])
            segs[i].classList.add(cls);
    }
    if (hint)
        hint.textContent = labels[score];
};
