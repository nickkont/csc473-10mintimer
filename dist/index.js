"use strict";
/**
 * Eventra — Homepage script
 * Toggles nav auth state based on whether a user is signed in.
 */
(() => {
    if (typeof window.EventraAuth === "undefined")
        return;
    const signedIn = document.getElementById("nav-auth-signed-in");
    const signedOut = document.getElementById("nav-auth");
    window.EventraAuth.onAuthStateChanged((user) => {
        if (user && signedIn && signedOut) {
            signedIn.style.display = "";
            signedOut.style.display = "none";
        }
        else if (signedIn && signedOut) {
            signedIn.style.display = "none";
            signedOut.style.display = "";
        }
    });
})();
