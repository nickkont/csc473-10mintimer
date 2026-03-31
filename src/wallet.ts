/**
 * Eventra — Wallet page (balance, deposit/withdraw, activity)
 */
((): void => {
  "use strict";

  const auth = window.EventraAuth;
  if (!auth) return;

  const db = firebase.firestore();

  let currentUser: FirebaseUser | null = null;
  let cashBalance = 0;
  let investedValue = 0;
  let allTransactions: Array<{ id: string; data: Record<string, unknown> }> = [];
  let activeFilter: "all" | "deposits" | "withdrawals" | "trades" = "all";

  function redirectLogin(): void {
    window.location.href =
      "login.html?redirect=" + encodeURIComponent("wallet.html");
  }

  function parseAmount(raw: string): number {
    const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  function formatMoney(n: number): string {
    return "$" + n.toFixed(2);
  }

  function setText(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function showFundMsg(text: string, ok?: boolean): void {
    const el = document.getElementById("fund-message");
    if (!el) return;
    el.textContent = text;
    el.className = "wallet-inline-msg" + (text ? (ok ? " success" : "") : "");
    if (text && ok) el.classList.add("success");
  }

  async function loadInvested(uid: string): Promise<number> {
    const posSnap = await db.collection("users").doc(uid).collection("positions").get();
    if (posSnap.empty) return 0;
    let sum = 0;
    for (const doc of posSnap.docs) {
      const pos = doc.data() as { marketId?: string; yesShares?: number; noShares?: number };
      const mSnap = await db.collection("markets").doc(pos.marketId || doc.id).get();
      if (!mSnap.exists) continue;
      const m = mSnap.data() as { yesPrice?: number; noPrice?: number };
      const y = pos.yesShares || 0;
      const n = pos.noShares || 0;
      sum += y * (m.yesPrice || 0) + n * (m.noPrice || 0);
    }
    return Math.round(sum * 100) / 100;
  }

  function todayNetChange(transactions: Array<{ data: Record<string, unknown> }>): number {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    let net = 0;
    for (const { data: tx } of transactions) {
      const ts = tx.timestamp as { seconds?: number } | undefined;
      if (!ts || typeof ts.seconds !== "number") continue;
      const d = new Date(ts.seconds * 1000);
      if (d >= start) {
        net += Number(tx.amount) || 0;
      }
    }
    return Math.round(net * 100) / 100;
  }

  function categorize(tx: Record<string, unknown>): "deposits" | "withdrawals" | "trades" | "other" {
    const t = String(tx.type || "").toLowerCase();
    if (t === "deposit") return "deposits";
    if (t === "withdrawal") return "withdrawals";
    if (t === "trade" || t === "payout") return "trades";
    return "other";
  }

  function passesFilter(tx: Record<string, unknown>): boolean {
    if (activeFilter === "all") return true;
    return categorize(tx) === activeFilter;
  }

  function txTypeLabel(tx: Record<string, unknown>): string {
    const t = String(tx.type || "").toLowerCase();
    if (t === "deposit") return "Deposit";
    if (t === "withdrawal") return "Withdrawal";
    if (t === "trade") return "Trade";
    if (t === "payout") return "Payout";
    return "Other";
  }

  function iconClass(tx: Record<string, unknown>): string {
    const t = String(tx.type || "").toLowerCase();
    if (t === "deposit") return "wallet-tx-icon-dep";
    if (t === "withdrawal") return "wallet-tx-icon-wd";
    if (t === "payout") return "wallet-tx-icon-pay";
    return "wallet-tx-icon-trade";
  }

  function iconGlyph(tx: Record<string, unknown>): string {
    const t = String(tx.type || "").toLowerCase();
    if (t === "deposit") return "+";
    if (t === "withdrawal") return "−";
    if (t === "payout") return "◆";
    return "T";
  }

  function renderTransactions(): void {
    const tbody = document.getElementById("wallet-tx-body") as HTMLElement | null;
    if (!tbody) return;

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
        const ts = tx.timestamp as { seconds?: number } | undefined;
        const dateStr =
          ts && typeof ts.seconds === "number"
            ? new Date(ts.seconds * 1000).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—";
        const desc = String(tx.description || "Transaction");
        const short = desc.length > 42 ? desc.slice(0, 40) + "…" : desc;
        return (
          '<tr>' +
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
          "</tr>"
        );
      })
      .join("");
  }

  async function refresh(): Promise<void> {
    if (!currentUser) return;
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

    allTransactions = txSnap.docs.map((d: { id: string; data: () => Record<string, unknown> }) => ({
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
      } else {
        badge.hidden = true;
      }
    }

    renderTransactions();
  }

  function wireFilters(): void {
    document.querySelectorAll("#tx-filters [data-filter]").forEach((btn) => {
      btn.addEventListener("click", (): void => {
        const f = (btn as HTMLElement).getAttribute("data-filter") as typeof activeFilter;
        if (!f) return;
        activeFilter = f;
        document.querySelectorAll("#tx-filters .wallet-filter-pill").forEach((p) => {
          p.classList.toggle("wallet-filter-active", p === btn);
        });
        renderTransactions();
      });
    });
  }

  function wireTabs(): void {
    const tabDep = document.getElementById("tab-deposit");
    const tabWd = document.getElementById("tab-withdraw");
    const panelDep = document.getElementById("panel-deposit");
    const panelWd = document.getElementById("panel-withdraw");

    function showDeposit(): void {
      tabDep?.classList.add("wallet-tab-active");
      tabWd?.classList.remove("wallet-tab-active");
      if (tabDep) tabDep.setAttribute("aria-selected", "true");
      if (tabWd) tabWd.setAttribute("aria-selected", "false");
      panelDep?.classList.remove("is-hidden");
      if (panelDep) panelDep.hidden = false;
      panelWd?.classList.add("is-hidden");
      if (panelWd) panelWd.hidden = true;
    }

    function showWithdraw(): void {
      tabWd?.classList.add("wallet-tab-active");
      tabDep?.classList.remove("wallet-tab-active");
      if (tabWd) tabWd.setAttribute("aria-selected", "true");
      if (tabDep) tabDep.setAttribute("aria-selected", "false");
      panelWd?.classList.remove("is-hidden");
      if (panelWd) panelWd.hidden = false;
      panelDep?.classList.add("is-hidden");
      if (panelDep) panelDep.hidden = true;
    }

    tabDep?.addEventListener("click", showDeposit);
    tabWd?.addEventListener("click", showWithdraw);

    document.querySelectorAll("[data-open-tab]").forEach((el) => {
      el.addEventListener("click", (e): void => {
        const tab = (e.currentTarget as HTMLElement).getAttribute("data-open-tab");
        if (tab === "withdraw") {
          showWithdraw();
          document.getElementById("fund-panel")?.scrollIntoView({ behavior: "smooth" });
        }
      });
    });
  }

  function wireChips(): void {
    const input = document.getElementById("amount-input") as HTMLInputElement | null;
    document.querySelectorAll("#amount-chips .wallet-chip").forEach((chip) => {
      chip.addEventListener("click", (): void => {
        document.querySelectorAll("#amount-chips .wallet-chip").forEach((c) => {
          c.classList.remove("wallet-chip-active");
        });
        chip.classList.add("wallet-chip-active");
        const amt = (chip as HTMLElement).getAttribute("data-amt");
        if (input && amt) input.value = amt + ".00";
      });
    });
    if (input) input.value = "100.00";
  }

  function wireDeposit(): void {
    const btn = document.getElementById("btn-confirm-deposit") as HTMLButtonElement | null;
    const input = document.getElementById("amount-input") as HTMLInputElement | null;
    if (!btn || !input) return;

    btn.addEventListener("click", (): void => {
      if (!currentUser) return;
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
        .then((doc: { exists: boolean; data: () => Record<string, unknown> }): Promise<number> => {
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
          return batch.commit().then((): number => newBalance);
        })
        .then((newBalance: number): void => {
          cashBalance = newBalance;
          setText("nav-balance", formatMoney(newBalance));
          showFundMsg("Deposit successful.", true);
          void refresh();
          btn.disabled = false;
        })
        .catch((): void => {
          showFundMsg("Deposit failed. Try again.");
          btn.disabled = false;
        });
    });
  }

  function wireWithdraw(): void {
    const btn = document.getElementById("btn-confirm-withdraw") as HTMLButtonElement | null;
    const input = document.getElementById("withdraw-input") as HTMLInputElement | null;
    if (!btn || !input) return;

    btn.addEventListener("click", (): void => {
      if (!currentUser) return;
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
        .then((doc: { exists: boolean; data: () => Record<string, unknown> }): Promise<number> => {
          const current = doc.exists ? Number(doc.data().walletBalance) || 0 : 0;
          if (amount > current) throw new Error("Insufficient balance.");
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
          return batch.commit().then((): number => newBalance);
        })
        .then((newBalance: number): void => {
          cashBalance = newBalance;
          setText("nav-balance", formatMoney(newBalance));
          input.value = "";
          showFundMsg("Withdrawal submitted.", true);
          void refresh();
          btn.disabled = false;
        })
        .catch((err: Error): void => {
          showFundMsg(err.message || "Withdrawal failed.");
          btn.disabled = false;
        });
    });
  }

  auth.onAuthStateChanged((user: FirebaseUser | null): void => {
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
