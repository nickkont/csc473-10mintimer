"use strict";
/**
 * Eventra — Admin dashboard script
 * Role-guarded: redirects non-admins immediately.
 * Admins can create markets and resolve outcomes.
 */
(() => {
    "use strict";
    const auth = window.EventraAuth;
    if (!auth)
        return;
    const db = firebase.firestore();
    // ── Role guard ───────────────────────────────────────────────────────────────
    auth.onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }
        db.collection("users").doc(user.uid).get()
            .then((doc) => {
            const role = doc.exists ? (doc.data().role || "user") : "user";
            if (role !== "admin") {
                window.location.href = "index.html";
                return;
            }
            showAdmin();
            loadAdminMarkets();
        });
    });
    function showAdmin() {
        const loading = document.getElementById("admin-loading");
        const content = document.getElementById("admin-content");
        if (loading)
            loading.style.display = "none";
        if (content)
            content.style.display = "";
    }
    // ── Create market ────────────────────────────────────────────────────────────
    const createForm = document.getElementById("create-market-form");
    const createMsg = document.getElementById("create-msg");
    if (createForm) {
        createForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const title = document.getElementById("market-title").value.trim();
            const category = document.getElementById("market-category").value;
            const closesAt = document.getElementById("market-closes").value;
            const yesPrice = parseFloat(document.getElementById("market-yes-price").value);
            const noPrice = parseFloat((1 - yesPrice).toFixed(2));
            if (!title || !closesAt || isNaN(yesPrice) || yesPrice <= 0 || yesPrice >= 1) {
                showCreateMsg("Fill all fields. YES price must be between 0 and 1.", true);
                return;
            }
            const submitBtn = createForm.querySelector("button[type=submit]");
            if (submitBtn)
                submitBtn.disabled = true;
            const user = auth.getCurrentUser();
            db.collection("markets").add({
                title,
                category,
                closesAt: firebase.firestore.Timestamp.fromDate(new Date(closesAt)),
                status: "open",
                outcome: null,
                yesPrice,
                noPrice,
                totalTrades: 0,
                createdBy: user ? user.uid : "admin",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            })
                .then(() => {
                showCreateMsg("Market created!", false);
                createForm.reset();
                if (submitBtn)
                    submitBtn.disabled = false;
                loadAdminMarkets();
            })
                .catch((err) => {
                showCreateMsg(err.message || "Failed to create market.", true);
                if (submitBtn)
                    submitBtn.disabled = false;
            });
        });
    }
    function showCreateMsg(text, isError) {
        if (!createMsg)
            return;
        createMsg.textContent = text;
        createMsg.className = "admin-msg " + (isError ? "error" : "success");
    }
    // ── Load markets list ────────────────────────────────────────────────────────
    function loadAdminMarkets() {
        const list = document.getElementById("admin-markets-list");
        if (!list)
            return;
        list.innerHTML = '<p class="admin-loading">Loading\u2026</p>';
        db.collection("markets").orderBy("createdAt", "desc").get()
            .then((snap) => {
            if (snap.empty) {
                list.innerHTML = '<p class="admin-loading">No markets yet.</p>';
                return;
            }
            list.innerHTML = snap.docs.map((d) => {
                const m = Object.assign({ id: d.id }, d.data());
                const resolved = m.status === "resolved";
                const closesDate = m.closesAt
                    ? new Date(m.closesAt.seconds * 1000).toLocaleDateString()
                    : "—";
                return ('<div class="admin-market-row" id="mrow-' + m.id + '">' +
                    '<div class="admin-market-info">' +
                    '<div class="admin-market-title">' + m.title + "</div>" +
                    '<div class="admin-market-meta">' +
                    m.category + " · " + m.totalTrades + " trades · Closes " + closesDate +
                    (resolved ? ' · <span class="resolved-label ' + m.outcome + '">' + m.outcome.toUpperCase() + " resolved</span>" : "") +
                    "</div>" +
                    "</div>" +
                    (!resolved
                        ? '<div class="admin-resolve-btns">' +
                            '<button class="resolve-btn yes" onclick="resolveMarket(\'' + m.id + '\',\'yes\')">Resolve YES</button>' +
                            '<button class="resolve-btn no"  onclick="resolveMarket(\'' + m.id + '\',\'no\')">Resolve NO</button>' +
                            "</div>"
                        : '<span class="resolved-chip">Resolved</span>') +
                    "</div>");
            }).join("");
        });
    }
    // ── Resolve market ───────────────────────────────────────────────────────────
    window.resolveMarket = function (marketId, outcome) {
        if (!confirm('Resolve this market as "' + outcome.toUpperCase() + '"? This cannot be undone.'))
            return;
        db.collection("markets").doc(marketId).update({
            status: "resolved",
            outcome,
            resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
            .then(() => {
            loadAdminMarkets();
        })
            .catch((err) => { alert(err.message || "Failed to resolve market."); });
    };
})();
