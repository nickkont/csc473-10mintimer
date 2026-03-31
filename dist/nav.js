"use strict";
/**
 * Eventra — Shared nav script
 * Watches Firebase Auth, fetches role + wallet balance, updates the nav chip
 * and reveals the Admin link for admin users.
 */
(() => {
    "use strict";
    if (typeof window.EventraAuth === "undefined")
        return;
    const auth = window.EventraAuth;
    const db = firebase.firestore();
    function getEl(id) {
        return document.getElementById(id);
    }
    function setInitials(el, user) {
        if (!el)
            return;
        if (user.displayName) {
            el.textContent = user.displayName
                .trim().split(/\s+/)
                .map((s) => s[0])
                .join("").slice(0, 2).toUpperCase();
        }
        else if (user.email) {
            el.textContent = user.email[0].toUpperCase();
        }
        else {
            el.textContent = "?";
        }
    }
    function updateNav(user) {
        const navAuth = getEl("nav-auth");
        const navUser = getEl("nav-user");
        const navAvatar = getEl("nav-avatar");
        const navBalance = getEl("nav-balance");
        const navName = getEl("nav-display-name");
        const navAdmin = getEl("nav-admin-link");
        if (!user) {
            if (navAuth)
                navAuth.style.display = "";
            if (navUser)
                navUser.style.display = "none";
            if (navAdmin)
                navAdmin.style.display = "none";
            return;
        }
        if (navAuth)
            navAuth.style.display = "none";
        if (navUser)
            navUser.style.display = "";
        setInitials(navAvatar, user);
        if (navName) {
            navName.textContent = user.displayName
                || (user.email ? user.email.split("@")[0] : "");
        }
        db.collection("users").doc(user.uid).get()
            .then((doc) => {
            const data = doc.exists ? doc.data() : {};
            const balance = data.walletBalance || 0;
            if (navBalance)
                navBalance.textContent = "$" + balance.toFixed(2);
            const role = data.role || "user";
            if (navAdmin) {
                navAdmin.style.display = role === "admin" ? "" : "none";
            }
        })
            .catch(() => { });
    }
    auth.onAuthStateChanged((user) => {
        updateNav(user);
    });
})();
