/**
 * Eventra — Events / Markets page script
 * - Loads markets from Firestore
 * - Renders cards dynamically (replaces static HTML)
 * - Handles YES/NO buying via Firestore transaction
 * - Shows user's open positions
 * - Allows claiming payouts on resolved markets
 */
((): void => {
  "use strict";

  const db   = firebase.firestore();
  const auth = window.EventraAuth;

  let currentUser: FirebaseUser | null = null;
  let currentUserBalance: number = 0;
  let activeMarkets: Market[] = [];

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const feed         = document.getElementById("markets-feed")     as HTMLElement | null;
  const posSection   = document.getElementById("positions-section") as HTMLElement | null;
  const posList      = document.getElementById("positions-list")   as HTMLElement | null;
  const tradeModal   = document.getElementById("trade-modal")      as HTMLElement | null;
  const modalTitle   = document.getElementById("modal-market-title") as HTMLElement | null;
  const modalBalance = document.getElementById("modal-user-balance") as HTMLElement | null;
  const modalSide    = document.getElementById("modal-side")       as HTMLElement | null;
  const modalPrice   = document.getElementById("modal-price")      as HTMLElement | null;
  const modalShares  = document.getElementById("modal-shares")     as HTMLInputElement | null;
  const modalCost    = document.getElementById("modal-cost")       as HTMLElement | null;
  const modalBuyBtn  = document.getElementById("modal-buy-btn")    as HTMLButtonElement | null;
  const modalCloseBtn = document.getElementById("modal-close-btn") as HTMLButtonElement | null;
  const modalMsg     = document.getElementById("modal-msg")        as HTMLElement | null;

  let pendingMarketId: string = "";
  let pendingSide: "yes" | "no" = "yes";
  let pendingPrice: number = 0;

  // ── Category filter ─────────────────────────────────────────────────────────
  (window as any).filterCat = function (cat: string, catTabEl: HTMLElement | null, sidebarEl: HTMLElement | null): void {
    document.querySelectorAll(".cat-tab").forEach((t): void => t.classList.remove("active"));
    document.querySelectorAll(".sidebar-link").forEach((t): void => t.classList.remove("active"));
    const idx = ["all", "ccny", "sports", "politics"].indexOf(cat);
    const tabs = document.querySelectorAll(".cat-tab");
    const links = document.querySelectorAll(".sidebar-link");
    if (tabs[idx])  tabs[idx].classList.add("active");
    if (links[idx]) links[idx].classList.add("active");
    document.querySelectorAll<HTMLElement>(".feed-section").forEach((s): void => {
      s.style.display = (cat === "all" || s.dataset.cat === cat) ? "" : "none";
    });
  };

  // ── Auth state ───────────────────────────────────────────────────────────────
  auth.onAuthStateChanged((user: FirebaseUser | null): void => {
    currentUser = user;
    if (user) {
      db.collection("users").doc(user.uid).get().then((doc: any): void => {
        currentUserBalance = doc.exists ? (doc.data().walletBalance || 0) : 0;
      });
    }
    loadMarkets();
  });

  // ── Load markets from Firestore ─────────────────────────────────────────────
  function loadMarkets(): void {
    if (!feed) return;
    feed.innerHTML = '<p class="markets-loading">Loading markets\u2026</p>';

    db.collection("markets").orderBy("createdAt", "desc").get()
      .then((snap: any): void => {
        const markets: Market[] = snap.docs.map((d: any): Market => ({ id: d.id, ...d.data() } as Market));
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
      .catch((): void => {
        if (feed) feed.innerHTML = '<p class="markets-loading">Failed to load markets.</p>';
      });
  }

  // ── Render market cards ──────────────────────────────────────────────────────
  function renderMarkets(markets: Market[]): void {
    if (!feed) return;

    const categories: string[] = ["ccny", "sports", "politics"];
    const byCategory: Record<string, Market[]> = { ccny: [], sports: [], politics: [], other: [] };
    markets.forEach((m: Market): void => {
      const cat = categories.includes(m.category) ? m.category : "other";
      byCategory[cat].push(m);
    });

    const sections: string[] = [...categories];
    if (byCategory.other.length > 0) sections.push("other");

    feed.innerHTML = sections.map((cat: string): string => {
      const ms = byCategory[cat];
      if (ms.length === 0) return "";
      return (
        '<div class="feed-section" data-cat="' + cat + '">' +
          '<div class="feed-section-title">' + capitalize(cat) + "</div>" +
          ms.map(cardHTML).join("") +
        "</div>"
      );
    }).join("");
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function cardHTML(m: Market): string {
    const resolved = m.status === "resolved";
    const closesDate = m.closesAt
      ? new Date(m.closesAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "—";
    const tagClass = m.category;
    const resolvedBadge = resolved
      ? '<span class="outcome-badge ' + m.outcome + '">' + (m.outcome === "yes" ? "YES wins" : "NO wins") + "</span>"
      : "";

    return (
      '<div class="event-card" data-id="' + m.id + '">' +
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
                "</button>"
            ) +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  // ── Open trade modal ─────────────────────────────────────────────────────────
  (window as any).openTrade = function (marketId: string, side: "yes" | "no"): void {
    if (!currentUser) {
      window.location.href =
        "login.html?redirect=" + encodeURIComponent("react-dist/index.html#/events");
      return;
    }
    const market = activeMarkets.find((m: Market): boolean => m.id === marketId);
    if (!market || market.status === "resolved") return;

    pendingMarketId = marketId;
    pendingSide     = side;
    pendingPrice    = side === "yes" ? market.yesPrice : market.noPrice;

    if (modalTitle)   modalTitle.textContent   = market.title;
    if (modalSide)    modalSide.textContent     = side.toUpperCase();
    if (modalSide)    modalSide.className       = "modal-side-badge " + side;
    if (modalPrice)   modalPrice.textContent    = "$" + pendingPrice.toFixed(2) + " per share";
    if (modalBalance) modalBalance.textContent  = "$" + currentUserBalance.toFixed(2);
    if (modalShares)  modalShares.value         = "1";
    if (modalCost)    modalCost.textContent     = "$" + pendingPrice.toFixed(2);
    if (modalMsg)     modalMsg.textContent      = "";
    if (tradeModal)   tradeModal.style.display  = "flex";
  };

  if (modalShares) {
    modalShares.addEventListener("input", (): void => {
      const n = Math.max(1, parseInt(modalShares!.value) || 1);
      if (modalCost) modalCost.textContent = "$" + (pendingPrice * n).toFixed(2);
    });
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeTrade);
  }
  if (tradeModal) {
    tradeModal.addEventListener("click", (e: MouseEvent): void => {
      if (e.target === tradeModal) closeTrade();
    });
  }

  function closeTrade(): void {
    if (tradeModal) tradeModal.style.display = "none";
  }

  // ── Execute trade ────────────────────────────────────────────────────────────
  if (modalBuyBtn) {
    modalBuyBtn.addEventListener("click", (): void => {
      if (!currentUser || !pendingMarketId) return;
      const shares = Math.max(1, parseInt(modalShares ? modalShares.value : "1") || 1);
      const totalCost = parseFloat((pendingPrice * shares).toFixed(2));

      if (totalCost > currentUserBalance) {
        if (modalMsg) { modalMsg.textContent = "Insufficient balance."; modalMsg.className = "modal-msg error"; }
        return;
      }

      modalBuyBtn.disabled = true;
      if (modalMsg) { modalMsg.textContent = "Processing\u2026"; modalMsg.className = "modal-msg"; }

      const uid        = currentUser.uid;
      const userRef    = db.collection("users").doc(uid);
      const marketRef  = db.collection("markets").doc(pendingMarketId);
      const posRef     = db.collection("users").doc(uid).collection("positions").doc(pendingMarketId);
      const txRef      = db.collection("users").doc(uid).collection("transactions").doc();
      const side       = pendingSide;
      const marketId   = pendingMarketId;

      db.runTransaction((t: any): Promise<number> => {
        return Promise.all([userRef.get(), posRef.get(), marketRef.get()])
          .then(([userSnap, posSnap, marketSnap]: [any, any, any]): number => {
            const balance: number = userSnap.exists ? (userSnap.data().walletBalance || 0) : 0;
            if (totalCost > balance) throw new Error("Insufficient balance.");

            const newBalance = parseFloat((balance - totalCost).toFixed(2));
            const posData    = posSnap.exists ? posSnap.data() : { yesShares: 0, noShares: 0 };
            const newYes     = (posData.yesShares || 0) + (side === "yes" ? shares : 0);
            const newNo      = (posData.noShares  || 0) + (side === "no"  ? shares : 0);
            const trades: number = marketSnap.exists ? ((marketSnap.data().totalTrades || 0) + 1) : 1;

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
      .then((newBalance: number): void => {
        currentUserBalance = newBalance;
        const navBal = document.getElementById("nav-balance") as HTMLElement | null;
        if (navBal) navBal.textContent = "$" + newBalance.toFixed(2);
        if (modalBalance) modalBalance.textContent = "$" + newBalance.toFixed(2);
        if (modalMsg) { modalMsg.textContent = "Trade placed!"; modalMsg.className = "modal-msg success"; }
        modalBuyBtn.disabled = false;
        loadPositions(uid, activeMarkets);
        // refresh trade count on card
        loadMarkets();
      })
      .catch((err: Error): void => {
        if (modalMsg) { modalMsg.textContent = err.message || "Trade failed."; modalMsg.className = "modal-msg error"; }
        modalBuyBtn.disabled = false;
      });
    });
  }

  // ── Load & render positions ──────────────────────────────────────────────────
  function loadPositions(uid: string, markets: Market[]): void {
    if (!posSection || !posList) return;

    db.collection("users").doc(uid).collection("positions").get()
      .then((snap: any): void => {
        if (snap.empty) {
          posSection.style.display = "none";
          return;
        }

        const rows: string[] = snap.docs.map((d: any): string => {
          const pos = d.data();
          const market = markets.find((m: Market): boolean => m.id === pos.marketId);
          const title  = market ? market.title : pos.marketId;
          const resolved = market ? market.status === "resolved" : false;
          const outcome  = market ? market.outcome : null;

          let claimBtn = "";
          let claimedLine = "";
          if (resolved && outcome) {
            const winShares = outcome === "yes" ? (pos.yesShares || 0) : (pos.noShares || 0);
            const alreadyClaimed = pos.payoutClaimed === true;
            if (alreadyClaimed && typeof pos.claimedAmount === "number") {
              claimedLine =
                '<span class="claimed-label">Claimed $' + pos.claimedAmount.toFixed(2) + "</span>";
            } else if (winShares > 0) {
              claimBtn =
                '<button type="button" class="claim-btn" data-claim-market="' + pos.marketId + '">Claim $' +
                winShares.toFixed(2) +
                "</button>";
            }
          }

          return (
            '<div class="position-row" data-market-id="' + pos.marketId + '">' +
              '<div class="pos-title">' + title + "</div>" +
              '<div class="pos-shares">' +
                (pos.yesShares > 0 ? '<span class="pos-yes">YES ×' + pos.yesShares + "</span>" : "") +
                (pos.noShares  > 0 ? '<span class="pos-no">NO ×' + pos.noShares   + "</span>" : "") +
              "</div>" +
              claimedLine +
              claimBtn +
            "</div>"
          );
        }).filter((s: string): boolean => s !== "");

        if (rows.length === 0) { posSection.style.display = "none"; return; }
        posSection.style.display = "";
        posList.innerHTML = rows.join("");
      });
  }

  // ── Claim payout (delegated click — avoids broken onclick strings) ─────────
  if (posList) {
    posList.addEventListener("click", (e: MouseEvent): void => {
      const btn = (e.target as HTMLElement).closest("[data-claim-market]") as HTMLButtonElement | null;
      if (!btn || !currentUser) return;
      const marketId = btn.getAttribute("data-claim-market");
      if (!marketId) return;
      claimPayout(marketId);
    });
  }

  function claimPayout(marketId: string): void {
    if (!currentUser) return;
    const uid       = currentUser.uid;
    const userRef   = db.collection("users").doc(uid);
    const posRef    = db.collection("users").doc(uid).collection("positions").doc(marketId);
    const marketRef = db.collection("markets").doc(marketId);
    const txRef     = db.collection("users").doc(uid).collection("transactions").doc();

    db.runTransaction((t: any): Promise<number> => {
      return Promise.all([userRef.get(), posRef.get(), marketRef.get()])
        .then(([userSnap, posSnap, marketSnap]: [any, any, any]): number => {
          if (!posSnap.exists) throw new Error("Position not found.");
          if (!marketSnap.exists) throw new Error("Market not found.");
          const mdata = marketSnap.data();
          if (mdata.status !== "resolved" || !mdata.outcome) {
            throw new Error("Market is not resolved yet.");
          }
          const posData = posSnap.data();
          if (posData.payoutClaimed === true) throw new Error("Payout already claimed.");
          const outcome = mdata.outcome as "yes" | "no";
          const winShares = outcome === "yes" ? (posData.yesShares || 0) : (posData.noShares || 0);
          if (winShares <= 0) throw new Error("No winning shares to claim.");
          const payout = parseFloat(winShares.toFixed(2));
          const balance: number = userSnap.exists ? (userSnap.data().walletBalance || 0) : 0;
          const newBalance = parseFloat((balance + payout).toFixed(2));
          const title = mdata.title || marketId;

          const posUpdate: Record<string, unknown> = {
            payoutClaimed: true,
            claimedAmount: payout,
            claimedAt: firebase.firestore.FieldValue.serverTimestamp(),
          };
          if (outcome === "yes") posUpdate.yesShares = 0;
          else posUpdate.noShares = 0;

          t.update(userRef, { walletBalance: newBalance });
          t.set(posRef, posUpdate, { merge: true });
          t.set(txRef, {
            type: "payout",
            amount: payout,
            description: "Payout from: " + title,
            balance: newBalance,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          });
          return newBalance;
        });
    })
      .then((newBalance: number): void => {
        currentUserBalance = newBalance;
        const navBal = document.getElementById("nav-balance") as HTMLElement | null;
        if (navBal) navBal.textContent = "$" + newBalance.toFixed(2);
        if (currentUser) loadPositions(currentUser.uid, activeMarkets);
        loadMarkets();
      })
      .catch((err: Error): void => {
        alert(err.message || "Claim failed.");
      });
  }
})();
