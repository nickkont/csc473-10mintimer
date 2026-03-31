/**
 * Eventra — Firebase Auth wrapper
 * Replaces the localStorage demo layer with real Firebase Authentication.
 * Exposes the same window.EventraAuth API so all other scripts are unaffected.
 */
((): void => {
  "use strict";

  const auth = firebase.auth();

  function getAuth(): any {
    return auth;
  }

  function getCurrentUser(): FirebaseUser | null {
    return auth.currentUser as FirebaseUser | null;
  }

  function onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    return auth.onAuthStateChanged(callback);
  }

  function signUp(email: string, password: string, displayName?: string | null): Promise<AuthResult> {
    return auth.createUserWithEmailAndPassword(email, password)
      .then((result: any): Promise<AuthResult> => {
        if (displayName) {
          return result.user.updateProfile({ displayName })
            .then((): AuthResult => ({ user: result.user as FirebaseUser }));
        }
        return Promise.resolve({ user: result.user as FirebaseUser });
      });
  }

  function signIn(email: string, password: string): Promise<AuthResult> {
    return auth.signInWithEmailAndPassword(email, password)
      .then((result: any): AuthResult => ({ user: result.user as FirebaseUser }));
  }

  function signOut(): Promise<void> {
    return auth.signOut();
  }

  function deleteAccount(): Promise<void> {
    const user = auth.currentUser;
    if (!user) return Promise.reject(new Error("No user signed in."));
    return user.delete();
  }

  function reauthenticate(password: string): Promise<void> {
    const user = auth.currentUser;
    if (!user || !user.email) return Promise.reject(new Error("No user signed in."));
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
    return user.reauthenticateWithCredential(credential);
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
