/**
 * Eventra — Account settings page script
 * Handles auth guard, profile load/save, account deletion,
 * and password-strength meter.
 */

// ── Auth / profile logic ────────────────────────────────────────────────────
((): void => {
  const auth = window.EventraAuth;
  if (!auth) return;

  let currentUser: DemoUser | null = null;
  let lastProfileSnapshot: ProfileData | null = null;

  function redirectLogin(): void {
    window.location.href =
      "login.html?redirect=" +
      encodeURIComponent(window.location.pathname + window.location.search);
  }

  function setUser(user: DemoUser | null): void {
    const emailEl = document.getElementById("profile-email") as HTMLInputElement | null;
    const navEmail = document.getElementById("nav-user-email") as HTMLElement | null;
    const avatar = document.getElementById("nav-avatar") as HTMLElement | null;

    if (emailEl) emailEl.value = user ? user.email : "";
    if (navEmail) navEmail.textContent = user ? user.email : "";
    if (avatar) {
      if (user && user.displayName) {
        avatar.textContent = (
          user.displayName
            .trim()
            .split(/\s+/)
            .map((s: string) => s[0])
            .join("")
            .slice(0, 2) || user.email[0]
        ).toUpperCase();
      } else if (user && user.email) {
        avatar.textContent = user.email[0].toUpperCase();
      } else {
        avatar.textContent = "?";
      }
    }
  }

  function applyProfile(data: ProfileData | null): void {
    const first = document.getElementById("profile-first") as HTMLInputElement | null;
    const last = document.getElementById("profile-last") as HTMLInputElement | null;
    const username = document.getElementById("profile-username") as HTMLInputElement | null;
    const phone = document.getElementById("profile-phone") as HTMLInputElement | null;
    const dob = document.getElementById("profile-dob") as HTMLInputElement | null;
    const tz = document.getElementById("profile-timezone") as HTMLSelectElement | null;
    const lang = document.getElementById("profile-language") as HTMLSelectElement | null;
    const bio = document.getElementById("profile-bio") as HTMLTextAreaElement | null;

    if (!data) {
      if (first) first.value = "";
      if (last) last.value = "";
      if (username) username.value = "";
      if (phone) phone.value = "";
      if (dob) dob.value = "";
      if (tz) tz.value = "ET";
      if (lang) lang.value = "en";
      if (bio) bio.value = "";
      return;
    }

    if (first) first.value = data.firstName || "";
    if (last) last.value = data.lastName || "";
    if (username) username.value = data.username || "";
    if (phone) phone.value = data.phone || "";
    if (dob) dob.value = data.dob || "";
    if (tz && data.timezone) tz.value = data.timezone;
    if (lang && data.language) lang.value = data.language;
    if (bio) bio.value = data.bio || "";
  }

  function loadProfile(user: DemoUser | null): void {
    if (!user) {
      applyProfile(null);
      return;
    }
    try {
      const raw = localStorage.getItem("eventra_profile_" + user.email);
      const data: ProfileData | null = raw ? (JSON.parse(raw) as ProfileData) : null;
      lastProfileSnapshot = data;
      applyProfile(data);
    } catch {
      lastProfileSnapshot = null;
      applyProfile(null);
    }
  }

  auth.onAuthStateChanged((user: DemoUser | null): void => {
    if (!user) {
      redirectLogin();
      return;
    }
    currentUser = user;
    setUser(user);
    loadProfile(user);
  });

  const btnLogout = document.getElementById("btn-logout") as HTMLButtonElement | null;
  if (btnLogout) {
    btnLogout.addEventListener("click", (): void => {
      auth.signOut().then((): void => {
        window.location.href = "index.html";
      });
    });
  }

  const btnProfileSave = document.getElementById("btn-profile-save") as HTMLButtonElement | null;
  const btnProfileCancel = document.getElementById("btn-profile-cancel") as HTMLButtonElement | null;
  const profileMessage = document.getElementById("profile-message") as HTMLElement | null;

  function showProfileMessage(text: string, isError: boolean): void {
    if (!profileMessage) return;
    profileMessage.textContent = text;
    profileMessage.className = "auth-message-inline show " + (isError ? "error" : "success");
  }

  if (btnProfileSave) {
    btnProfileSave.addEventListener("click", (): void => {
      if (!currentUser) {
        showProfileMessage("You must be signed in to save your profile.", true);
        return;
      }

      const payload: ProfileData = {
        firstName: (document.getElementById("profile-first") as HTMLInputElement).value.trim(),
        lastName: (document.getElementById("profile-last") as HTMLInputElement).value.trim(),
        username: (document.getElementById("profile-username") as HTMLInputElement).value.trim(),
        phone: (document.getElementById("profile-phone") as HTMLInputElement).value.trim(),
        dob: (document.getElementById("profile-dob") as HTMLInputElement).value,
        timezone: (document.getElementById("profile-timezone") as HTMLSelectElement).value,
        language: (document.getElementById("profile-language") as HTMLSelectElement).value,
        bio: (document.getElementById("profile-bio") as HTMLTextAreaElement).value.trim(),
      };

      btnProfileSave.disabled = true;
      showProfileMessage("Saving profile\u2026", false);

      try {
        localStorage.setItem("eventra_profile_" + currentUser.email, JSON.stringify(payload));
        lastProfileSnapshot = payload;
        showProfileMessage("Profile saved (demo only, stored in this browser).", false);
      } catch {
        showProfileMessage("Could not save profile in this browser.", true);
      } finally {
        btnProfileSave.disabled = false;
      }
    });
  }

  if (btnProfileCancel) {
    btnProfileCancel.addEventListener("click", (): void => {
      applyProfile(lastProfileSnapshot);
      if (profileMessage) profileMessage.className = "auth-message-inline";
    });
  }

  // ── Delete account ──────────────────────────────────────────────────────
  const btnDelete = document.getElementById("btn-delete-account") as HTMLButtonElement | null;
  const deleteReauthWrap = document.getElementById("delete-reauth-wrap") as HTMLElement | null;
  const deletePassword = document.getElementById("delete-password") as HTMLInputElement | null;
  const btnDeleteCancel = document.getElementById("btn-delete-cancel") as HTMLButtonElement | null;
  const deleteMessage = document.getElementById("delete-message") as HTMLElement | null;

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
        .then((): Promise<void> => auth.deleteAccount())
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
      btnDeleteCancel.style.display = "none";
      btnDelete.textContent = "Delete my account";
      btnDelete.disabled = false;
      deleteMessage.className = "auth-message-inline";
    });
  }
})();

// ── Password-strength meter ─────────────────────────────────────────────────
window.strength = function (val: string): void {
  const segs = ["s1", "s2", "s3", "s4"].map(
    (id) => document.getElementById(id) as HTMLElement
  );
  const hint = document.getElementById("s-hint") as HTMLElement | null;

  segs.forEach((s) => { if (s) s.className = "seg"; });

  if (!val) {
    if (hint) hint.textContent = "\u2014";
    return;
  }

  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const cls = score <= 1 ? "weak" : score <= 2 ? "medium" : "strong";
  const labels = ["", "Weak", "Fair", "Strong", "Very Strong"];

  for (let i = 0; i < score; i++) {
    if (segs[i]) segs[i].classList.add(cls);
  }
  if (hint) hint.textContent = labels[score];
};
