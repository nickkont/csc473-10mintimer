/**
 * Eventra — Front‑end only demo auth (no backend)
 *
 * This file provides a tiny in‑browser \"auth\" layer that behaves
 * like Firebase Auth from the UI's point of view but stores everything
 * in localStorage. It is **only for demos** and safe to commit to
 * public repositories because it never talks to a real backend.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "eventra_demo_user";

  function readUser() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeUser(user) {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    }
  }

  var currentUser = readUser();

  function getAuth() {
    // Kept for compatibility with earlier code paths.
    return null;
  }

  function getCurrentUser() {
    return currentUser;
  }

  function onAuthStateChanged(callback) {
    if (typeof callback !== "function") return function () {};
    callback(currentUser);
    function handler() {
      currentUser = readUser();
      callback(currentUser);
    }
    window.addEventListener("storage", handler);
    return function () {
      window.removeEventListener("storage", handler);
    };
  }

  function signUp(email, password, displayName) {
    return new Promise(function (resolve, reject) {
      if (!email || !password) {
        reject(new Error("Please provide email and password."));
        return;
      }
      var user = {
        uid: "demo-" + email,
        email: email,
        password: password,
        displayName: displayName || "",
      };
      currentUser = user;
      writeUser(user);
      resolve({ user: user });
    });
  }

  function signIn(email, password) {
    return new Promise(function (resolve, reject) {
      if (!email || !password) {
        reject(new Error("Please provide email and password."));
        return;
      }
      var stored = readUser();
      if (!stored || stored.email !== email || stored.password !== password) {
        reject(new Error("Demo: email or password do not match the last created account."));
        return;
      }
      currentUser = stored;
      writeUser(stored);
      resolve({ user: stored });
    });
  }

  function signOut() {
    return new Promise(function (resolve) {
      currentUser = null;
      writeUser(null);
      resolve();
    });
  }

  function deleteAccount() {
    return new Promise(function (resolve, reject) {
      if (!currentUser) {
        reject(new Error("No user signed in."));
        return;
      }
      currentUser = null;
      writeUser(null);
      resolve();
    });
  }

  function reauthenticate(password) {
    return new Promise(function (resolve, reject) {
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
    getAuth: getAuth,
    getCurrentUser: getCurrentUser,
    onAuthStateChanged: onAuthStateChanged,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    deleteAccount: deleteAccount,
    reauthenticate: reauthenticate,
  };
})();
