/**
 * Eventra — Front-end only demo auth (no backend)
 *
 * Provides a tiny in-browser "auth" layer that behaves like Firebase Auth
 * from the UI's point of view but stores everything in localStorage.
 * For demos only — safe to commit to public repositories.
 */
((): void => {
  "use strict";

  const STORAGE_KEY = "eventra_demo_user";

  function readUser(): DemoUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as DemoUser) : null;
    } catch {
      return null;
    }
  }

  function writeUser(user: DemoUser | null): void {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    }
  }

  let currentUser: DemoUser | null = readUser();

  function getAuth(): null {
    // Kept for compatibility with earlier code paths.
    return null;
  }

  function getCurrentUser(): DemoUser | null {
    return currentUser;
  }

  function onAuthStateChanged(callback: (user: DemoUser | null) => void): () => void {
    if (typeof callback !== "function") return (): void => {};
    callback(currentUser);
    function handler(): void {
      currentUser = readUser();
      callback(currentUser);
    }
    window.addEventListener("storage", handler);
    return (): void => {
      window.removeEventListener("storage", handler);
    };
  }

  function signUp(email: string, password: string, displayName?: string | null): Promise<AuthResult> {
    return new Promise<AuthResult>((resolve, reject) => {
      if (!email || !password) {
        reject(new Error("Please provide email and password."));
        return;
      }
      const user: DemoUser = {
        uid: "demo-" + email,
        email,
        password,
        displayName: displayName || "",
      };
      currentUser = user;
      writeUser(user);
      resolve({ user });
    });
  }

  function signIn(email: string, password: string): Promise<AuthResult> {
    return new Promise<AuthResult>((resolve, reject) => {
      if (!email || !password) {
        reject(new Error("Please provide email and password."));
        return;
      }
      const stored = readUser();
      if (!stored || stored.email !== email || stored.password !== password) {
        reject(new Error("Demo: email or password do not match the last created account."));
        return;
      }
      currentUser = stored;
      writeUser(stored);
      resolve({ user: stored });
    });
  }

  function signOut(): Promise<void> {
    return new Promise<void>((resolve) => {
      currentUser = null;
      writeUser(null);
      resolve();
    });
  }

  function deleteAccount(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!currentUser) {
        reject(new Error("No user signed in."));
        return;
      }
      currentUser = null;
      writeUser(null);
      resolve();
    });
  }

  function reauthenticate(password: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!currentUser) {
        reject(new Error("No user signed in."));
        return;
      }
      if (!password || password !== currentUser.password) {
        reject(new Error("Password does not match the demo account."));
        return;
      }
      resolve();
    });
  }

  window.EventraAuth = {
    getAuth,
    getCurrentUser,
    onAuthStateChanged,
    signUp,
    signIn,
    signOut,
    deleteAccount,
    reauthenticate,
  };
})();
