/**
 * Eventra — Account settings page script
 * Profile and wallet backed by Firestore.
 */

// ── Main account logic ───────────────────────────────────────────────────────
((): void => {
  "use strict";

  const auth = window.EventraAuth;
  if (!auth) return;

  const db = firebase.firestore();
  let currentUser: FirebaseUser | null = null;
  let lastProfileSnapshot: ProfileData | null = null;

  function redirectLogin(): void {
    window.location.href =
      "login.html?redirect=" + encodeURIComponent(window.location.pathname);
  }

  function setUser(user: FirebaseUser | null): void {
    const emailEl  = document.getElementById("profile-email")    as HTMLInputElement | null;
    const navEmail = document.getElementById("nav-user-email")   as HTMLElement | null;
    const avatar   = document.getElementById("nav-avatar")       as HTMLElement | null;

    if (emailEl)  emailEl.value        = user ? (user.email || "") : "";
    if (navEmail) navEmail.textContent = user ? (user.email || "") : "";
    if (avatar) {
      if (user && user.displayName) {
        avatar.textContent = user.displayName
          .trim().split(/\s+/)
          .map((s: string): string => s[0])
          .join("").slice(0, 2).toUpperCase();
      } else if (user && user.email) {
        avatar.textContent = user.email[0].toUpperCase();
      } else {
        avatar.textContent = "?";
      }
    }
  }

  function applyProfile(data: ProfileData | null): void {
    const ids: Record<string, string> = {
      "profile-first":    data ? data.firstName : "",
      "profile-last":     data ? data.lastName  : "",
      "profile-username": data ? data.username  : "",
      "profile-phone":    data ? data.phone     : "",
      "profile-dob":      data ? data.dob       : "",
    };
    Object.keys(ids).forEach((id: string): void => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = ids[id];
    });
    const tz   = document.getElementById("profile-timezone") as HTMLSelectElement | null;
    const lang = document.getElementById("profile-language") as HTMLSelectElement | null;
    const bio  = document.getElementById("profile-bio")      as HTMLTextAreaElement | null;
    if (tz)   tz.value   = (data && data.timezone) ? data.timezone : "ET";
    if (lang) lang.value = (data && data.language) ? data.language : "en";
    if (bio)  bio.value  = data ? data.bio : "";
  }

  function loadProfile(user: FirebaseUser): void {
    db.collection("users").doc(user.uid).get()
      .then((doc: any): void => {
        const data: ProfileData | null = doc.exists ? (doc.data() as ProfileData) : null;
        lastProfileSnapshot = data;
        applyProfile(data);
        loadWallet(user.uid);
      })
      .catch((): void => {
        lastProfileSnapshot = null;
        applyProfile(null);
        loadWallet(user.uid);
      });
  }

  // ── Wallet ─────────────────────────────────────────────────────────────────
  function loadWallet(uid: string): void {
    const balanceEl = document.getElementById("wallet-balance")      as HTMLElement | null;
    const txList    = document.getElementById("wallet-transactions") as HTMLElement | null;

    db.collection("users").doc(uid).get()
      .then((doc: any): void => {
        const data = doc.exists ? doc.data() : {};
        const balance: number = data.walletBalance || 0;
        const formatted = "$" + balance.toFixed(2);
        if (balanceEl) balanceEl.textContent = formatted;
        const navBal = document.getElementById("nav-balance") as HTMLElement | null;
        if (navBal) navBal.textContent = formatted;
        const adminLink = document.getElementById("nav-admin-link") as HTMLElement | null;
        if (adminLink) adminLink.style.display = data.role === "admin" ? "" : "none";
      });

    if (!txList) return;
    txList.innerHTML = '<p class="tx-empty">Loading\u2026</p>';

    db.collection("users").doc(uid)
      .collection("transactions")
      .orderBy("timestamp", "desc")
      .limit(10)
      .get()
      .then((snap: any): void => {
        if (snap.empty) {
          txList.innerHTML = '<p class="tx-empty">No transactions yet.</p>';
          return;
        }
        txList.innerHTML = snap.docs.map((d: any): string => {
          const tx = d.data();
          const sign  = tx.amount >= 0 ? "+" : "";
          const cls   = tx.amount >= 0 ? "tx-credit" : "tx-debit";
          const date  = tx.timestamp
            ? new Date(tx.timestamp.seconds * 1000).toLocaleDateString()
            : "\u2014";
          return (
            '<div class="tx-row">' +
              '<div class="tx-left">' +
                '<div class="tx-desc">' + tx.description + "</div>" +
                '<div class="tx-date">' + date + "</div>" +
              "</div>" +
              '<div class="tx-amount ' + cls + '">' +
                sign + "$" + Math.abs(tx.amount).toFixed(2) +
              "</div>" +
            "</div>"
          );
        }).join("");
      })
      .catch((): void => {
        if (txList) txList.innerHTML = '<p class="tx-empty">Could not load transactions.</p>';
      });
  }

  const btnAddFunds = document.getElementById("btn-add-funds") as HTMLButtonElement | null;
  if (btnAddFunds) {
    btnAddFunds.addEventListener("click", (): void => {
      if (!currentUser) return;
      const uid      = currentUser.uid;
      const amount   = 10;
      const userRef  = db.collection("users").doc(uid);
      btnAddFunds.disabled = true;

      userRef.get()
        .then((doc: any): Promise<number> => {
          const current: number = doc.exists ? (doc.data().walletBalance || 0) : 0;
          const newBalance = current + amount;
          const batch = db.batch();
          batch.update(userRef, { walletBalance: newBalance });
          const txRef = userRef.collection("transactions").doc();
          batch.set(txRef, {
            type:        "deposit",
            amount,
            description: "Demo deposit",
            balance:     newBalance,
            timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
          });
          return batch.commit().then((): number => newBalance);
        })
        .then((newBalance: number): void => {
          const formatted = "$" + newBalance.toFixed(2);
          const balanceEl = document.getElementById("wallet-balance") as HTMLElement | null;
          if (balanceEl) balanceEl.textContent = formatted;
          const navBal = document.getElementById("nav-balance") as HTMLElement | null;
          if (navBal) navBal.textContent = formatted;
          loadWallet(uid);
          btnAddFunds.disabled = false;
        })
        .catch((): void => { btnAddFunds.disabled = false; });
    });
  }

  // ── Auth state ─────────────────────────────────────────────────────────────
  auth.onAuthStateChanged((user: FirebaseUser | null): void => {
    if (!user) { redirectLogin(); return; }
    currentUser = user;
    setUser(user);
    loadProfile(user);
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  const btnLogout = document.getElementById("btn-logout") as HTMLButtonElement | null;
  if (btnLogout) {
    btnLogout.addEventListener("click", (): void => {
      auth.signOut().then((): void => { window.location.href = "index.html"; });
    });
  }

  // ── Profile save / cancel ──────────────────────────────────────────────────
  const btnProfileSave   = document.getElementById("btn-profile-save")   as HTMLButtonElement | null;
  const btnProfileCancel = document.getElementById("btn-profile-cancel") as HTMLButtonElement | null;
  const profileMessage   = document.getElementById("profile-message")    as HTMLElement | null;

  function showProfileMessage(text: string, isError: boolean): void {
    if (!profileMessage) return;
    profileMessage.textContent = text;
    profileMessage.className = "auth-message-inline show " + (isError ? "error" : "success");
  }

  if (btnProfileSave) {
    btnProfileSave.addEventListener("click", (): void => {
      if (!currentUser) { showProfileMessage("You must be signed in.", true); return; }

      const payload: ProfileData = {
        firstName: (document.getElementById("profile-first")    as HTMLInputElement).value.trim(),
        lastName:  (document.getElementById("profile-last")     as HTMLInputElement).value.trim(),
        username:  (document.getElementById("profile-username") as HTMLInputElement).value.trim(),
        phone:     (document.getElementById("profile-phone")    as HTMLInputElement).value.trim(),
        dob:       (document.getElementById("profile-dob")      as HTMLInputElement).value,
        timezone:  (document.getElementById("profile-timezone") as HTMLSelectElement).value,
        language:  (document.getElementById("profile-language") as HTMLSelectElement).value,
        bio:       (document.getElementById("profile-bio")      as HTMLTextAreaElement).value.trim(),
      };

      btnProfileSave.disabled = true;
      showProfileMessage("Saving\u2026", false);

      db.collection("users").doc(currentUser.uid).set(payload, { merge: true })
        .then((): void => {
          lastProfileSnapshot = payload;
          showProfileMessage("Profile saved.", false);
          btnProfileSave.disabled = false;
        })
        .catch((err: Error): void => {
          showProfileMessage(err.message || "Could not save profile.", true);
          btnProfileSave.disabled = false;
        });
    });
  }

  if (btnProfileCancel) {
    btnProfileCancel.addEventListener("click", (): void => {
      applyProfile(lastProfileSnapshot);
      if (profileMessage) profileMessage.className = "auth-message-inline";
    });
  }

  // ── Delete account ─────────────────────────────────────────────────────────
  const btnDelete        = document.getElementById("btn-delete-account") as HTMLButtonElement | null;
  const deleteReauthWrap = document.getElementById("delete-reauth-wrap") as HTMLElement | null;
  const deletePassword   = document.getElementById("delete-password")    as HTMLInputElement | null;
  const btnDeleteCancel  = document.getElementById("btn-delete-cancel")  as HTMLButtonElement | null;
  const deleteMessage    = document.getElementById("delete-message")     as HTMLElement | null;

  function showDeleteMessage(text: string, isError: boolean): void {
    if (!deleteMessage) return;
    deleteMessage.textContent = text;
    deleteMessage.className = "auth-message-inline show " + (isError ? "error" : "success");
  }

  if (btnDelete) {
    btnDelete.addEventListener("click", (): void => {
      if (!deleteReauthWrap || !deletePassword || !btnDeleteCancel || !deleteMessage) return;

      if (deleteReauthWrap.style.display === "none") {
        deleteReauthWrap.style.display = "block";
        btnDeleteCancel.style.display  = "inline-block";
        btnDelete.textContent = "Confirm delete";
        deleteMessage.className = "auth-message-inline";
        deletePassword.value = "";
        return;
      }

      const pwd = deletePassword.value;
      if (!pwd) { showDeleteMessage("Enter your password to confirm.", true); return; }

      btnDelete.disabled = true;
      const uid = currentUser ? currentUser.uid : null;

      auth.reauthenticate(pwd)
        .then((): Promise<void> => {
          if (uid) {
            return db.collection("users").doc(uid).delete()
              .then((): Promise<void> => auth.deleteAccount());
          }
          return auth.deleteAccount();
        })
        .then((): void => {
          showDeleteMessage("Account deleted. Redirecting\u2026", false);
          window.location.href = "index.html";
        })
        .catch((err: Error): void => {
          showDeleteMessage(err.message || "Could not delete account.", true);
          btnDelete.disabled = false;
        });
    });
  }

  if (btnDeleteCancel) {
    btnDeleteCancel.addEventListener("click", (): void => {
      if (!deleteReauthWrap || !deleteMessage || !btnDelete) return;
      deleteReauthWrap.style.display = "none";
      btnDeleteCancel.style.display  = "none";
      btnDelete.textContent = "Delete my account";
      btnDelete.disabled = false;
      deleteMessage.className = "auth-message-inline";
    });
  }
})();

// ── Password-strength meter ──────────────────────────────────────────────────
window.strength = function (val: string): void {
  const segs = ["s1", "s2", "s3", "s4"].map(
    (id: string): HTMLElement => document.getElementById(id) as HTMLElement
  );
  const hint = document.getElementById("s-hint") as HTMLElement | null;

  segs.forEach((s: HTMLElement): void => { if (s) s.className = "seg"; });

  if (!val) {
    if (hint) hint.textContent = "\u2014";
    return;
  }

  let score = 0;
  if (val.length >= 8)        score++;
  if (/[A-Z]/.test(val))      score++;
  if (/[0-9]/.test(val))      score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const cls    = score <= 1 ? "weak" : score <= 2 ? "medium" : "strong";
  const labels = ["", "Weak", "Fair", "Strong", "Very Strong"];

  for (let i = 0; i < score; i++) {
    if (segs[i]) segs[i].classList.add(cls);
  }
  if (hint) hint.textContent = labels[score];
};
