/**
 * Eventra — Shared nav script
 * Watches Firebase Auth, fetches role + wallet balance, updates the nav chip
 * and reveals the Admin link for admin users.
 */
((): void => {
  "use strict";

  if (typeof window.EventraAuth === "undefined") return;

  const auth = window.EventraAuth;
  const db   = firebase.firestore();

  function getEl(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  function setInitials(el: HTMLElement | null, user: FirebaseUser): void {
    if (!el) return;
    if (user.displayName) {
      el.textContent = user.displayName
        .trim().split(/\s+/)
        .map((s: string): string => s[0])
        .join("").slice(0, 2).toUpperCase();
    } else if (user.email) {
      el.textContent = user.email[0].toUpperCase();
    } else {
      el.textContent = "?";
    }
  }

  function updateNav(user: FirebaseUser | null): void {
    const navAuth    = getEl("nav-auth");
    const navUser    = getEl("nav-user");
    const navAvatar  = getEl("nav-avatar");
    const navBalance = getEl("nav-balance");
    const navName    = getEl("nav-display-name");
    const navAdmin   = getEl("nav-admin-link");
    const navAccountLink = getEl("nav-account-link") as HTMLAnchorElement | null;

    if (!user) {
      if (navAuth)  navAuth.style.display  = "";
      if (navUser)  navUser.style.display  = "none";
      if (navAdmin) navAdmin.style.display = "none";
      if (navAccountLink) {
        navAccountLink.href =
          "login.html?redirect=" + encodeURIComponent("react-dist/index.html#/account");
      }
      return;
    }

    if (navAuth) navAuth.style.display = "none";
    if (navUser) navUser.style.display = "";
    if (navAccountLink) navAccountLink.href = "react-dist/index.html#/account";

    setInitials(navAvatar, user);

    if (navName) {
      navName.textContent = user.displayName
        || (user.email ? user.email.split("@")[0] : "");
    }

    db.collection("users").doc(user.uid).get()
      .then((doc: any): void => {
        const data = doc.exists ? doc.data() : {};

        const balance: number = data.walletBalance || 0;
        if (navBalance) navBalance.textContent = "$" + balance.toFixed(2);

        const role: string = data.role || "user";
        if (navAdmin) {
          navAdmin.style.display = role === "admin" ? "" : "none";
        }
      })
      .catch((): void => { /* leave as defaults */ });
  }

  auth.onAuthStateChanged((user: FirebaseUser | null): void => {
    updateNav(user);
  });
})();
