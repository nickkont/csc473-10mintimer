"use strict";
/**
 * Eventra — Events / Markets page script
 * - Loads markets from Firestore
 * - Renders cards dynamically (replaces static HTML)
 * - Handles YES/NO buying via Firestore transaction
 * - Shows user's open positions
 * - Allows claiming payouts on resolved markets
 */
(() => {
    "use strict";
    const db = firebase.firestore();
    const auth = window.EventraAuth;
    let currentUser = null;
    let currentUserBalance = 0;
    let activeMarkets = [];
    // ── DOM refs ────────────────────────────────────────────────────────────────
    const feed = document.getElementById("markets-feed");
    const posSection = document.getElementById("positions-section");
    const posList = document.getElementById("positions-list");
    const tradeModal = document.getElementById("trade-modal");
    const modalTitle = document.getElementById("modal-market-title");
    const modalBalance = document.getElementById("modal-user-balance");
    const modalSide = document.getElementById("modal-side");
    const modalPrice = document.getElementById("modal-price");
    const modalShares = document.getElementById("modal-shares");
    const modalCost = document.getElementById("modal-cost");
    const modalBuyBtn = document.getElementById("modal-buy-btn");
    const modalCloseBtn = document.getElementById("modal-close-btn");
    const modalMsg = document.getElementById("modal-msg");
    let pendingMarketId = "";
    let pendingSide = "yes";
    let pendingPrice = 0;
    // ── Category filter ─────────────────────────────────────────────────────────
    window.filterCat = function (cat, catTabEl, sidebarEl) {
        document.querySelectorAll(".cat-tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".sidebar-link").forEach((t) => t.classList.remove("active"));
        const idx = ["all", "ccny", "sports", "politics"].indexOf(cat);
        const tabs = document.querySelectorAll(".cat-tab");
        const links = document.querySelectorAll(".sidebar-link");
        if (tabs[idx])
            tabs[idx].classList.add("active");
        if (links[idx])
            links[idx].classList.add("active");
        document.querySelectorAll(".feed-section").forEach((s) => {
            s.style.display = (cat === "all" || s.dataset.cat === cat) ? "" : "none";
        });
    };
    // ── Auth state ───────────────────────────────────────────────────────────────
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        if (user) {
            db.collection("users").doc(user.uid).get().then((doc) => {
                currentUserBalance = doc.exists ? (doc.data().walletBalance || 0) : 0;
            });
        }
        loadMarkets();
    });
    // ── Load markets from Firestore ─────────────────────────────────────────────
    function loadMarkets() {
        if (!feed)
            return;
        feed.innerHTML = '<p class="markets-loading">Loading markets\u2026</p>';
        db.collection("markets").orderBy("createdAt", "desc").get()
            .then((snap) => {
            const markets = snap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
            activeMarkets = markets;
            if (markets.length === 0) {
                feed.innerHTML = '<p class="markets-loading">No markets yet. Check back soon.</p>';
                return;
            }
            renderMarkets(markets);
            if (currentUser) {
                loadPositions(currentUser.uid, markets);
            }
        })
            .catch(() => {
            if (feed)
                feed.innerHTML = '<p class="markets-loading">Failed to load markets.</p>';
        });
    }
    // ── Render market cards ──────────────────────────────────────────────────────
    function renderMarkets(markets) {
        if (!feed)
            return;
        const categories = ["ccny", "sports", "politics"];
        const byCategory = { ccny: [], sports: [], politics: [], other: [] };
        markets.forEach((m) => {
            const cat = categories.includes(m.category) ? m.category : "other";
            byCategory[cat].push(m);
        });
        const sections = [...categories];
        if (byCategory.other.length > 0)
            sections.push("other");
        feed.innerHTML = sections.map((cat) => {
            const ms = byCategory[cat];
            if (ms.length === 0)
                return "";
            return ('<div class="feed-section" data-cat="' + cat + '">' +
                '<div class="feed-section-title">' + capitalize(cat) + "</div>" +
                ms.map(cardHTML).join("") +
                "</div>");
        }).join("");
    }
    function capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    function cardHTML(m) {
        const resolved = m.status === "resolved";
        const closesDate = m.closesAt
            ? new Date(m.closesAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "—";
        const tagClass = m.category;
        const resolvedBadge = resolved
            ? '<span class="outcome-badge ' + m.outcome + '">' + (m.outcome === "yes" ? "YES wins" : "NO wins") + "</span>"
            : "";
        return ('<div class="event-card" data-id="' + m.id + '">' +
            '<div class="event-card-top">' +
            '<span class="event-tag ' + tagClass + '">' + capitalize(m.category) + "</span>" +
            resolvedBadge +
            "</div>" +
            '<div class="event-question">' + m.title + "</div>" +
            '<div class="event-bottom">' +
            '<span class="event-meta">' + m.totalTrades + " trades · Closes " + closesDate + "</span>" +
            '<div class="event-prices">' +
            (resolved
                ? '<span class="resolved-label">Market closed</span>'
                : '<button class="trade-btn yes-btn" onclick="openTrade(\'' + m.id + '\',\'yes\')">' +
                    'YES <span class="trade-price">$' + m.yesPrice.toFixed(2) + "</span>" +
                    "</button>" +
                    '<button class="trade-btn no-btn" onclick="openTrade(\'' + m.id + '\',\'no\')">' +
                    'NO <span class="trade-price">$' + m.noPrice.toFixed(2) + "</span>" +
                    "</button>") +
            "</div>" +
            "</div>" +
            "</div>");
    }
    // ── Open trade modal ─────────────────────────────────────────────────────────
    window.openTrade = function (marketId, side) {
        if (!currentUser) {
            window.location.href = "login.html?redirect=events.html";
            return;
        }
        const market = activeMarkets.find((m) => m.id === marketId);
        if (!market || market.status === "resolved")
            return;
        pendingMarketId = marketId;
        pendingSide = side;
        pendingPrice = side === "yes" ? market.yesPrice : market.noPrice;
        if (modalTitle)
            modalTitle.textContent = market.title;
        if (modalSide)
            modalSide.textContent = side.toUpperCase();
        if (modalSide)
            modalSide.className = "modal-side-badge " + side;
        if (modalPrice)
            modalPrice.textContent = "$" + pendingPrice.toFixed(2) + " per share";
        if (modalBalance)
            modalBalance.textContent = "$" + currentUserBalance.toFixed(2);
        if (modalShares)
            modalShares.value = "1";
        if (modalCost)
            modalCost.textContent = "$" + pendingPrice.toFixed(2);
        if (modalMsg)
            modalMsg.textContent = "";
        if (tradeModal)
            tradeModal.style.display = "flex";
    };
    if (modalShares) {
        modalShares.addEventListener("input", () => {
            const n = Math.max(1, parseInt(modalShares.value) || 1);
            if (modalCost)
                modalCost.textContent = "$" + (pendingPrice * n).toFixed(2);
        });
    }
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener("click", closeTrade);
    }
    if (tradeModal) {
        tradeModal.addEventListener("click", (e) => {
            if (e.target === tradeModal)
                closeTrade();
        });
    }
    function closeTrade() {
        if (tradeModal)
            tradeModal.style.display = "none";
    }
    // ── Execute trade ────────────────────────────────────────────────────────────
    if (modalBuyBtn) {
        modalBuyBtn.addEventListener("click", () => {
            if (!currentUser || !pendingMarketId)
                return;
            const shares = Math.max(1, parseInt(modalShares ? modalShares.value : "1") || 1);
            const totalCost = parseFloat((pendingPrice * shares).toFixed(2));
            if (totalCost > currentUserBalance) {
                if (modalMsg) {
                    modalMsg.textContent = "Insufficient balance.";
                    modalMsg.className = "modal-msg error";
                }
                return;
            }
            modalBuyBtn.disabled = true;
            if (modalMsg) {
                modalMsg.textContent = "Processing\u2026";
                modalMsg.className = "modal-msg";
            }
            const uid = currentUser.uid;
            const userRef = db.collection("users").doc(uid);
            const marketRef = db.collection("markets").doc(pendingMarketId);
            const posRef = db.collection("users").doc(uid).collection("positions").doc(pendingMarketId);
            const txRef = db.collection("users").doc(uid).collection("transactions").doc();
            const side = pendingSide;
            const marketId = pendingMarketId;
            db.runTransaction((t) => {
                return Promise.all([userRef.get(), posRef.get(), marketRef.get()])
                    .then(([userSnap, posSnap, marketSnap]) => {
                    const balance = userSnap.exists ? (userSnap.data().walletBalance || 0) : 0;
                    if (totalCost > balance)
                        throw new Error("Insufficient balance.");
                    const newBalance = parseFloat((balance - totalCost).toFixed(2));
                    const posData = posSnap.exists ? posSnap.data() : { yesShares: 0, noShares: 0 };
                    const newYes = (posData.yesShares || 0) + (side === "yes" ? shares : 0);
                    const newNo = (posData.noShares || 0) + (side === "no" ? shares : 0);
                    const trades = marketSnap.exists ? ((marketSnap.data().totalTrades || 0) + 1) : 1;
                    t.update(userRef, { walletBalance: newBalance });
                    t.set(posRef, { marketId, yesShares: newYes, noShares: newNo, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
                    t.set(txRef, {
                        type: "trade",
                        amount: -totalCost,
                        description: "Bought " + shares + " " + side.toUpperCase() + " on: " + (marketSnap.exists ? marketSnap.data().title : marketId),
                        balance: newBalance,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    });
                    t.update(marketRef, { totalTrades: trades });
                    return newBalance;
                });
            })
                .then((newBalance) => {
                currentUserBalance = newBalance;
                const navBal = document.getElementById("nav-balance");
                if (navBal)
                    navBal.textContent = "$" + newBalance.toFixed(2);
                if (modalBalance)
                    modalBalance.textContent = "$" + newBalance.toFixed(2);
                if (modalMsg) {
                    modalMsg.textContent = "Trade placed!";
                    modalMsg.className = "modal-msg success";
                }
                modalBuyBtn.disabled = false;
                loadPositions(uid, activeMarkets);
                // refresh trade count on card
                loadMarkets();
            })
                .catch((err) => {
                if (modalMsg) {
                    modalMsg.textContent = err.message || "Trade failed.";
                    modalMsg.className = "modal-msg error";
                }
                modalBuyBtn.disabled = false;
            });
        });
    }
    // ── Load & render positions ──────────────────────────────────────────────────
    function loadPositions(uid, markets) {
        if (!posSection || !posList)
            return;
        db.collection("users").doc(uid).collection("positions").get()
            .then((snap) => {
            if (snap.empty) {
                posSection.style.display = "none";
                return;
            }
            const rows = snap.docs.map((d) => {
                const pos = d.data();
                const market = markets.find((m) => m.id === pos.marketId);
                const title = market ? market.title : pos.marketId;
                const resolved = market ? market.status === "resolved" : false;
                const outcome = market ? market.outcome : null;
                let claimBtn = "";
                if (resolved && outcome) {
                    const winShares = outcome === "yes" ? (pos.yesShares || 0) : (pos.noShares || 0);
                    if (winShares > 0) {
                        claimBtn = '<button class="claim-btn" onclick="claimPayout(\'' + pos.marketId + '\',$' + winShares + ')">Claim $' + winShares.toFixed(2) + "</button>";
                    }
                }
                return ('<div class="position-row">' +
                    '<div class="pos-title">' + title + "</div>" +
                    '<div class="pos-shares">' +
                    (pos.yesShares > 0 ? '<span class="pos-yes">YES ×' + pos.yesShares + "</span>" : "") +
                    (pos.noShares > 0 ? '<span class="pos-no">NO ×' + pos.noShares + "</span>" : "") +
                    "</div>" +
                    claimBtn +
                    "</div>");
            }).filter((s) => s !== "");
            if (rows.length === 0) {
                posSection.style.display = "none";
                return;
            }
            posSection.style.display = "";
            posList.innerHTML = rows.join("");
        });
    }
    // ── Claim payout ─────────────────────────────────────────────────────────────
    window.claimPayout = function (marketId, winShares) {
        if (!currentUser)
            return;
        const uid = currentUser.uid;
        const userRef = db.collection("users").doc(uid);
        const posRef = db.collection("users").doc(uid).collection("positions").doc(marketId);
        const txRef = db.collection("users").doc(uid).collection("transactions").doc();
        const market = activeMarkets.find((m) => m.id === marketId);
        const payout = parseFloat(winShares.toFixed(2));
        db.runTransaction((t) => {
            return Promise.all([userRef.get(), posRef.get()])
                .then(([userSnap, posSnap]) => {
                if (!posSnap.exists)
                    throw new Error("Position not found.");
                const balance = userSnap.exists ? (userSnap.data().walletBalance || 0) : 0;
                const newBalance = parseFloat((balance + payout).toFixed(2));
                t.update(userRef, { walletBalance: newBalance });
                t.delete(posRef);
                t.set(txRef, {
                    type: "payout",
                    amount: payout,
                    description: "Payout from: " + (market ? market.title : marketId),
                    balance: newBalance,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                });
                return newBalance;
            });
        })
            .then((newBalance) => {
            currentUserBalance = newBalance;
            const navBal = document.getElementById("nav-balance");
            if (navBal)
                navBal.textContent = "$" + newBalance.toFixed(2);
            loadMarkets();
        })
            .catch((err) => { alert(err.message || "Claim failed."); });
    };
})();
