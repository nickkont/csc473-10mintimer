/**
 * Eventra — Demo configuration (no real backend)
 *
 * This file intentionally contains **no real Firebase keys**.
 * The current demo build of Eventra does not talk to any backend
 * service; all \"account\" behaviour is front-end only so it is
 * safe to share on GitHub.
 *
 * If you later decide to wire up a backend (Firebase or otherwise),
 * replace this file with environment-based config that is **not**
 * committed to a public repository.
 */

const firebaseConfig = {
  apiKey: "AIzaSyDaJbo5MxHGGGa6iRdn6XLiRKQPxvws5N4",
  authDomain: "eventra-101da.firebaseapp.com",
  projectId: "eventra-101da",
  storageBucket: "eventra-101da.firebasestorage.app",
  messagingSenderId: "44095127960",
  appId: "1:44095127960:web:facdde0cc508a75e766bed",
  measurementId: "G-BYNPFVFVMC"
};

firebase.initializeApp(firebaseConfig);
