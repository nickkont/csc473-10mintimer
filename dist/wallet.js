"use strict";
/**
 * Eventra — Wallet page (balance, deposit/withdraw, activity)
 */
(() => {
    "use strict";
    const auth = window.EventraAuth;
    if (!auth)
        return;
    const db = firebase.firestore();
    let currentUser = null;
    let cashBalance = 0;
    let investedValue = 0;
    let allTransactions = [];
    let activeFilter = "all";
    function redirectLogin() {
        window.location.href =
            "login.html?redirect=" + encodeURIComponent("wallet.html");
    }
    function parseAmount(raw) {
        const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ""));
        return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
    }
    function formatMoney(n) {
        return "$" + n.toFixed(2);
    }
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el)
            el.textContent = text;
    }
    function showFundMsg(text, ok) {
        const el = document.getElementById("fund-message");
        if (!el)
            return;
        el.textContent = text;
        el.className = "wallet-inline-msg" + (text ? (ok ? " success" : "") : "");
        if (text && ok)
            el.classList.add("success");
    }
    async function loadInvested(uid) {
        const posSnap = await db.collection("users").doc(uid).collection("positions").get();
        if (posSnap.empty)
            return 0;
        let sum = 0;
        for (const doc of posSnap.docs) {
            const pos = doc.data();
            const mSnap = await db.collection("markets").doc(pos.marketId || doc.id).get();
            if (!mSnap.exists)
                continue;
            const m = mSnap.data();
            const y = pos.yesShares || 0;
            const n = pos.noShares || 0;
            sum += y * (m.yesPrice || 0) + n * (m.noPrice || 0);
        }
        return Math.round(sum * 100) / 100;
    }
    function todayNetChange(transactions) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        let net = 0;
        for (const { data: tx } of transactions) {
            const ts = tx.timestamp;
            if (!ts || typeof ts.seconds !== "number")
                continue;
            const d = new Date(ts.seconds * 1000);
            if (d >= start) {
                net += Number(tx.amount) || 0;
            }
        }
        return Math.round(net * 100) / 100;
    }
    function categorize(tx) {
        const t = String(tx.type || "").toLowerCase();
        if (t === "deposit")
            return "deposits";
        if (t === "withdrawal")
            return "withdrawals";
        if (t === "trade" || t === "payout")
            return "trades";
        return "other";
    }
    function passesFilter(tx) {
        if (activeFilter === "all")
            return true;
        return categorize(tx) === activeFilter;
    }
    function txTypeLabel(tx) {
        const t = String(tx.type || "").toLowerCase();
        if (t === "deposit")
            return "Deposit";
        if (t === "withdrawal")
            return "Withdrawal";
        if (t === "trade")
            return "Trade";
        if (t === "payout")
            return "Payout";
        return "Other";
    }
    function iconClass(tx) {
        const t = String(tx.type || "").toLowerCase();
        if (t === "deposit")
            return "wallet-tx-icon-dep";
        if (t === "withdrawal")
            return "wallet-tx-icon-wd";
        if (t === "payout")
            return "wallet-tx-icon-pay";
        return "wallet-tx-icon-trade";
    }
    function iconGlyph(tx) {
        const t = String(tx.type || "").toLowerCase();
        if (t === "deposit")
            return "+";
        if (t === "withdrawal")
            return "−";
        if (t === "payout")
            return "◆";
        return "T";
    }
    function renderTransactions() {
        const tbody = document.getElementById("wallet-tx-body");
        if (!tbody)
            return;
        const rows = allTransactions.filter((x) => passesFilter(x.data));
        if (rows.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="4" class="wallet-tx-empty">No transactions yet.</td></tr>';
            return;
        }
        tbody.innerHTML = rows
            .map(({ id, data: tx }) => {
            const amount = Number(tx.amount) || 0;
            const sign = amount >= 0 ? "+" : "";
            const amtClass = amount >= 0 ? "wallet-tx-amt-pos" : "wallet-tx-amt-neg";
            const ts = tx.timestamp;
            const dateStr = ts && typeof ts.seconds === "number"
                ? new Date(ts.seconds * 1000).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                })
                : "—";
            const desc = String(tx.description || "Transaction");
            const short = desc.length > 42 ? desc.slice(0, 40) + "…" : desc;
            return ('<tr>' +
                '<td><div class="wallet-tx-cell">' +
                '<span class="wallet-tx-icon ' +
                iconClass(tx) +
                '">' +
                iconGlyph(tx) +
                "</span>" +
                '<div><div class="wallet-tx-name">' +
                short +
                '</div><div class="wallet-tx-sub">' +
                "</div></div></div></td>" +
                '<td class="wallet-tx-type">' +
                txTypeLabel(tx) +
                "</td>" +
                '<td class="wallet-tx-date">' +
                dateStr +
                "</td>" +
                '<td class="wallet-tx-amt ' +
                amtClass +
                '">' +
                sign +
                "$" +
                Math.abs(amount).toFixed(2) +
                "</td>" +
                "</tr>");
        })
            .join("");
    }
    async function refresh() {
        if (!currentUser)
            return;
        const uid = currentUser.uid;
        const userSnap = await db.collection("users").doc(uid).get();
        const udata = userSnap.exists ? userSnap.data() : {};
        cashBalance = typeof udata.walletBalance === "number" ? udata.walletBalance : 0;
        investedValue = await loadInvested(uid);
        const total = Math.round((cashBalance + investedValue) * 100) / 100;
        setText("stat-total", formatMoney(total));
        setText("stat-invested", formatMoney(investedValue));
        setText("stat-cash", formatMoney(cashBalance));
        setText("stat-pending", "$0.00");
        const txSnap = await db
            .collection("users")
            .doc(uid)
            .collection("transactions")
            .orderBy("timestamp", "desc")
            .limit(80)
            .get();
        allTransactions = txSnap.docs.map((d) => ({
            id: d.id,
            data: d.data(),
        }));
        const today = todayNetChange(allTransactions);
        const badge = document.getElementById("stat-today");
        if (badge) {
            if (today !== 0) {
                badge.hidden = false;
                const sign = today >= 0 ? "+" : "";
                badge.textContent = sign + formatMoney(Math.abs(today)) + " today";
                badge.style.color = today >= 0 ? "#4ade80" : "#f87171";
            }
            else {
                badge.hidden = true;
            }
        }
        renderTransactions();
    }
    function wireFilters() {
        document.querySelectorAll("#tx-filters [data-filter]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const f = btn.getAttribute("data-filter");
                if (!f)
                    return;
                activeFilter = f;
                document.querySelectorAll("#tx-filters .wallet-filter-pill").forEach((p) => {
                    p.classList.toggle("wallet-filter-active", p === btn);
                });
                renderTransactions();
            });
        });
    }
    function wireTabs() {
        const tabDep = document.getElementById("tab-deposit");
        const tabWd = document.getElementById("tab-withdraw");
        const panelDep = document.getElementById("panel-deposit");
        const panelWd = document.getElementById("panel-withdraw");
        function showDeposit() {
            tabDep === null || tabDep === void 0 ? void 0 : tabDep.classList.add("wallet-tab-active");
            tabWd === null || tabWd === void 0 ? void 0 : tabWd.classList.remove("wallet-tab-active");
            if (tabDep)
                tabDep.setAttribute("aria-selected", "true");
            if (tabWd)
                tabWd.setAttribute("aria-selected", "false");
            panelDep === null || panelDep === void 0 ? void 0 : panelDep.classList.remove("is-hidden");
            if (panelDep)
                panelDep.hidden = false;
            panelWd === null || panelWd === void 0 ? void 0 : panelWd.classList.add("is-hidden");
            if (panelWd)
                panelWd.hidden = true;
        }
        function showWithdraw() {
            tabWd === null || tabWd === void 0 ? void 0 : tabWd.classList.add("wallet-tab-active");
            tabDep === null || tabDep === void 0 ? void 0 : tabDep.classList.remove("wallet-tab-active");
            if (tabWd)
                tabWd.setAttribute("aria-selected", "true");
            if (tabDep)
                tabDep.setAttribute("aria-selected", "false");
            panelWd === null || panelWd === void 0 ? void 0 : panelWd.classList.remove("is-hidden");
            if (panelWd)
                panelWd.hidden = false;
            panelDep === null || panelDep === void 0 ? void 0 : panelDep.classList.add("is-hidden");
            if (panelDep)
                panelDep.hidden = true;
        }
        tabDep === null || tabDep === void 0 ? void 0 : tabDep.addEventListener("click", showDeposit);
        tabWd === null || tabWd === void 0 ? void 0 : tabWd.addEventListener("click", showWithdraw);
        document.querySelectorAll("[data-open-tab]").forEach((el) => {
            el.addEventListener("click", (e) => {
                var _a;
                const tab = e.currentTarget.getAttribute("data-open-tab");
                if (tab === "withdraw") {
                    showWithdraw();
                    (_a = document.getElementById("fund-panel")) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: "smooth" });
                }
            });
        });
    }
    function wireChips() {
        const input = document.getElementById("amount-input");
        document.querySelectorAll("#amount-chips .wallet-chip").forEach((chip) => {
            chip.addEventListener("click", () => {
                document.querySelectorAll("#amount-chips .wallet-chip").forEach((c) => {
                    c.classList.remove("wallet-chip-active");
                });
                chip.classList.add("wallet-chip-active");
                const amt = chip.getAttribute("data-amt");
                if (input && amt)
                    input.value = amt + ".00";
            });
        });
        if (input)
            input.value = "100.00";
    }
    function wireDeposit() {
        const btn = document.getElementById("btn-confirm-deposit");
        const input = document.getElementById("amount-input");
        if (!btn || !input)
            return;
        btn.addEventListener("click", () => {
            if (!currentUser)
                return;
            const amount = parseAmount(input.value);
            if (amount <= 0) {
                showFundMsg("Enter a valid amount.");
                return;
            }
            const uid = currentUser.uid;
            const userRef = db.collection("users").doc(uid);
            btn.disabled = true;
            showFundMsg("");
            userRef
                .get()
                .then((doc) => {
                const current = doc.exists ? Number(doc.data().walletBalance) || 0 : 0;
                const newBalance = Math.round((current + amount) * 100) / 100;
                const batch = db.batch();
                batch.set(userRef, { walletBalance: newBalance }, { merge: true });
                const txRef = userRef.collection("transactions").doc();
                batch.set(txRef, {
                    type: "deposit",
                    amount,
                    description: "Wallet deposit",
                    balance: newBalance,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                });
                return batch.commit().then(() => newBalance);
            })
                .then((newBalance) => {
                cashBalance = newBalance;
                setText("nav-balance", formatMoney(newBalance));
                showFundMsg("Deposit successful.", true);
                void refresh();
                btn.disabled = false;
            })
                .catch(() => {
                showFundMsg("Deposit failed. Try again.");
                btn.disabled = false;
            });
        });
    }
    function wireWithdraw() {
        const btn = document.getElementById("btn-confirm-withdraw");
        const input = document.getElementById("withdraw-input");
        if (!btn || !input)
            return;
        btn.addEventListener("click", () => {
            if (!currentUser)
                return;
            const amount = parseAmount(input.value);
            if (amount <= 0) {
                showFundMsg("Enter a valid amount.");
                return;
            }
            const uid = currentUser.uid;
            const userRef = db.collection("users").doc(uid);
            btn.disabled = true;
            showFundMsg("");
            userRef
                .get()
                .then((doc) => {
                const current = doc.exists ? Number(doc.data().walletBalance) || 0 : 0;
                if (amount > current)
                    throw new Error("Insufficient balance.");
                const newBalance = Math.round((current - amount) * 100) / 100;
                const batch = db.batch();
                batch.set(userRef, { walletBalance: newBalance }, { merge: true });
                const txRef = userRef.collection("transactions").doc();
                batch.set(txRef, {
                    type: "withdrawal",
                    amount: -amount,
                    description: "Wallet withdrawal",
                    balance: newBalance,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                });
                return batch.commit().then(() => newBalance);
            })
                .then((newBalance) => {
                cashBalance = newBalance;
                setText("nav-balance", formatMoney(newBalance));
                input.value = "";
                showFundMsg("Withdrawal submitted.", true);
                void refresh();
                btn.disabled = false;
            })
                .catch((err) => {
                showFundMsg(err.message || "Withdrawal failed.");
                btn.disabled = false;
            });
        });
    }
    auth.onAuthStateChanged((user) => {
        if (!user) {
            redirectLogin();
            return;
        }
        currentUser = user;
        void refresh();
    });
    wireFilters();
    wireTabs();
    wireChips();
    wireDeposit();
    wireWithdraw();
})();
