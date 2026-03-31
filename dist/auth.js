"use strict";
/**
 * Eventra — Firebase Auth wrapper
 * Replaces the localStorage demo layer with real Firebase Authentication.
 * Exposes the same window.EventraAuth API so all other scripts are unaffected.
 */
(() => {
    "use strict";
    const auth = firebase.auth();
    function getAuth() {
        return auth;
    }
    function getCurrentUser() {
        return auth.currentUser;
    }
    function onAuthStateChanged(callback) {
        return auth.onAuthStateChanged(callback);
    }
    function signUp(email, password, displayName) {
        return auth.createUserWithEmailAndPassword(email, password)
            .then((result) => {
            if (displayName) {
                return result.user.updateProfile({ displayName })
                    .then(() => ({ user: result.user }));
            }
            return Promise.resolve({ user: result.user });
        });
    }
    function signIn(email, password) {
        return auth.signInWithEmailAndPassword(email, password)
            .then((result) => ({ user: result.user }));
    }
    function signOut() {
        return auth.signOut();
    }
    function deleteAccount() {
        const user = auth.currentUser;
        if (!user)
            return Promise.reject(new Error("No user signed in."));
        return user.delete();
    }
    function reauthenticate(password) {
        const user = auth.currentUser;
        if (!user || !user.email)
            return Promise.reject(new Error("No user signed in."));
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
