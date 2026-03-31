import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { loginWithRedirect } from "../lib/siteUrls";
import "../../../styles.css";

export interface Market {
  id: string;
  title: string;
  category: string;
  closesAt?: { seconds: number; toDate?: () => Date };
  status: string;
  outcome?: "yes" | "no";
  yesPrice: number;
  noPrice: number;
  totalTrades: number;
}

interface PositionRow {
  marketId: string;
  yesShares: number;
  noShares: number;
  payoutClaimed?: boolean;
  claimedAmount?: number;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function closesLabel(m: Market): string {
  const c = m.closesAt as { seconds?: number; toDate?: () => Date } | undefined;
  if (!c) return "—";
  const d = typeof c.toDate === "function" ? c.toDate() : new Date((c.seconds ?? 0) * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function EventsPage(): JSX.Element {
  const { user, balance: navBalance } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [positions, setPositions] = useState<Array<PositionRow & { title: string; market?: Market }>>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<"all" | "ccny" | "sports" | "politics">("all");
  const [userBalance, setUserBalance] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [pendingMarketId, setPendingMarketId] = useState("");
  const [pendingSide, setPendingSide] = useState<"yes" | "no">("yes");
  const [pendingPrice, setPendingPrice] = useState(0);
  const [shares, setShares] = useState(1);
  const [modalMsg, setModalMsg] = useState("");
  const [modalMsgClass, setModalMsgClass] = useState("");

  useEffect(() => {
    setUserBalance(navBalance);
  }, [navBalance]);

  const loadMarkets = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const q = query(collection(db, "markets"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const list: Market[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Market));
      setMarkets(list);
      if (user) {
        const pSnap = await getDocs(collection(db, "users", user.uid, "positions"));
        const rows: Array<PositionRow & { title: string; market?: Market }> = [];
        pSnap.docs.forEach((docSnap) => {
          const pos = docSnap.data() as PositionRow;
          const market = list.find((m) => m.id === pos.marketId);
          rows.push({
            ...pos,
            title: market ? market.title : pos.marketId,
            market,
          });
        });
        setPositions(rows);
      } else {
        setPositions([]);
      }
    } catch {
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadMarkets();
  }, [loadMarkets]);

  const openTrade = (marketId: string, side: "yes" | "no"): void => {
    if (!user) {
      window.location.href = loginWithRedirect("/events");
      return;
    }
    const market = markets.find((m) => m.id === marketId);
    if (!market || market.status === "resolved") return;
    const price = side === "yes" ? market.yesPrice : market.noPrice;
    setPendingMarketId(marketId);
    setPendingSide(side);
    setPendingPrice(price);
    setShares(1);
    setModalMsg("");
    setModalOpen(true);
  };

  const closeTrade = (): void => {
    setModalOpen(false);
  };

  const totalCost = pendingPrice * Math.max(1, shares);

  const executeTrade = async (): Promise<void> => {
    if (!user || !pendingMarketId) return;
    const n = Math.max(1, shares);
    const cost = parseFloat((pendingPrice * n).toFixed(2));
    if (cost > userBalance) {
      setModalMsg("Insufficient balance.");
      setModalMsgClass("error");
      return;
    }
    setModalMsg("Processing…");
    setModalMsgClass("");
    const uid = user.uid;
    const userRef = doc(db, "users", uid);
    const marketRef = doc(db, "markets", pendingMarketId);
    const posRef = doc(db, "users", uid, "positions", pendingMarketId);
    const side = pendingSide;
    const marketId = pendingMarketId;

    try {
      const newBalance = await runTransaction(db, async (t) => {
        const [userSnap, posSnap, marketSnap] = await Promise.all([
          t.get(userRef),
          t.get(posRef),
          t.get(marketRef),
        ]);
        const bal = userSnap.exists ? Number(userSnap.data().walletBalance) || 0 : 0;
        if (cost > bal) throw new Error("Insufficient balance.");
        const nb = parseFloat((bal - cost).toFixed(2));
        const posData = posSnap.exists ? posSnap.data() : { yesShares: 0, noShares: 0 };
        const newYes = Number(posData.yesShares) || 0;
        const newNo = Number(posData.noShares) || 0;
        const ny = newYes + (side === "yes" ? n : 0);
        const nn = newNo + (side === "no" ? n : 0);
        const trades = marketSnap.exists ? Number(marketSnap.data().totalTrades) || 0 : 0;

        t.update(userRef, { walletBalance: nb });
        t.set(
          posRef,
          {
            marketId,
            yesShares: ny,
            noShares: nn,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        const txRef = doc(collection(db, "users", uid, "transactions"));
        t.set(txRef, {
          type: "trade",
          amount: -cost,
          description:
            "Bought " +
            n +
            " " +
            side.toUpperCase() +
            " on: " +
            (marketSnap.exists ? marketSnap.data().title : marketId),
          balance: nb,
          timestamp: serverTimestamp(),
        });
        t.update(marketRef, { totalTrades: trades + 1 });
        return nb;
      });
      setUserBalance(newBalance);
      setModalMsg("Trade placed!");
      setModalMsgClass("success");
      await loadMarkets();
      setTimeout(() => setModalOpen(false), 800);
    } catch (e) {
      const err = e as Error;
      setModalMsg(err.message || "Trade failed.");
      setModalMsgClass("error");
    }
  };

  const claimPayout = async (marketId: string): Promise<void> => {
    if (!user) return;
    const uid = user.uid;
    const userRef = doc(db, "users", uid);
    const posRef = doc(db, "users", uid, "positions", marketId);
    const marketRef = doc(db, "markets", marketId);

    try {
      const newBalance = await runTransaction(db, async (t) => {
        const [userSnap, posSnap, marketSnap] = await Promise.all([
          t.get(userRef),
          t.get(posRef),
          t.get(marketRef),
        ]);
        if (!posSnap.exists) throw new Error("Position not found.");
        if (!marketSnap.exists) throw new Error("Market not found.");
        const mdata = marketSnap.data() as { status?: string; outcome?: string; title?: string };
        if (mdata.status !== "resolved" || !mdata.outcome) throw new Error("Market is not resolved yet.");
        const posData = posSnap.data() as Record<string, unknown>;
        if (posData.payoutClaimed === true) throw new Error("Payout already claimed.");
        const outcome = mdata.outcome as "yes" | "no";
        const winShares =
          outcome === "yes" ? Number(posData.yesShares) || 0 : Number(posData.noShares) || 0;
        if (winShares <= 0) throw new Error("No winning shares to claim.");
        const payout = parseFloat(winShares.toFixed(2));
        const bal = userSnap.exists ? Number(userSnap.data().walletBalance) || 0 : 0;
        const nb = parseFloat((bal + payout).toFixed(2));
        const title = mdata.title || marketId;
        const posUpdate: Record<string, unknown> = {
          payoutClaimed: true,
          claimedAmount: payout,
          claimedAt: serverTimestamp(),
        };
        if (outcome === "yes") posUpdate.yesShares = 0;
        else posUpdate.noShares = 0;
        t.update(userRef, { walletBalance: nb });
        t.set(posRef, posUpdate, { merge: true });
        const txRef = doc(collection(db, "users", uid, "transactions"));
        t.set(txRef, {
          type: "payout",
          amount: payout,
          description: "Payout from: " + title,
          balance: nb,
          timestamp: serverTimestamp(),
        });
        return nb;
      });
      setUserBalance(newBalance);
      await loadMarkets();
    } catch (e) {
      alert((e as Error).message || "Claim failed.");
    }
  };

  const categories = ["ccny", "sports", "politics"] as const;
  const byCategory: Record<string, Market[]> = { ccny: [], sports: [], politics: [], other: [] };
  markets.forEach((m) => {
    const cat = categories.includes(m.category as "ccny") ? m.category : "other";
    byCategory[cat].push(m);
  });
  const sections = [...categories, ...(byCategory.other.length ? ["other"] : [])];

  function filterCat(cat: typeof catFilter): void {
    setCatFilter(cat);
  }

  return (
    <AppLayout active="events">
      <div className="cat-bar">
        <div className="cat-bar-inner">
          <div className={"cat-tab" + (catFilter === "all" ? " active" : "")} onClick={() => filterCat("all")}>
            All markets
          </div>
          <div className={"cat-tab" + (catFilter === "ccny" ? " active" : "")} onClick={() => filterCat("ccny")}>
            CCNY
          </div>
          <div className={"cat-tab" + (catFilter === "sports" ? " active" : "")} onClick={() => filterCat("sports")}>
            Sports
          </div>
          <div className={"cat-tab" + (catFilter === "politics" ? " active" : "")} onClick={() => filterCat("politics")}>
            Politics
          </div>
        </div>
      </div>

      <div className="page-layout">
        <aside className="sidebar">
          <div className="sidebar-title">Browse</div>
          <div className={"sidebar-link" + (catFilter === "all" ? " active" : "")} onClick={() => filterCat("all")}>
            All markets
          </div>
          <div className={"sidebar-link" + (catFilter === "ccny" ? " active" : "")} onClick={() => filterCat("ccny")}>
            CCNY
          </div>
          <div className={"sidebar-link" + (catFilter === "sports" ? " active" : "")} onClick={() => filterCat("sports")}>
            Sports
          </div>
          <div className={"sidebar-link" + (catFilter === "politics" ? " active" : "")} onClick={() => filterCat("politics")}>
            Politics
          </div>
        </aside>

        <main className="feed">
          {user && positions.length > 0 ? (
            <div id="positions-section" className="feed-section">
              <div className="feed-section-title">My Positions</div>
              <div id="positions-list">
                {positions.map((p) => {
                  const market = p.market;
                  const resolved = market ? market.status === "resolved" : false;
                  const outcome = market?.outcome ?? null;
                  let winShares = 0;
                  if (resolved && outcome) {
                    winShares = outcome === "yes" ? p.yesShares || 0 : p.noShares || 0;
                  }
                  const alreadyClaimed = p.payoutClaimed === true;
                  return (
                    <div key={p.marketId} className="position-row" data-market-id={p.marketId}>
                      <div className="pos-title">{p.title}</div>
                      <div className="pos-shares">
                        {p.yesShares > 0 ? <span className="pos-yes">YES ×{p.yesShares}</span> : null}
                        {p.noShares > 0 ? <span className="pos-no">NO ×{p.noShares}</span> : null}
                      </div>
                      {resolved && outcome && alreadyClaimed && typeof p.claimedAmount === "number" ? (
                        <span className="claimed-label">Claimed ${p.claimedAmount.toFixed(2)}</span>
                      ) : null}
                      {resolved && outcome && !alreadyClaimed && winShares > 0 ? (
                        <button type="button" className="claim-btn" onClick={() => void claimPayout(p.marketId)}>
                          Claim ${winShares.toFixed(2)}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div id="markets-feed">
            {loading ? (
              <p className="markets-loading">Loading markets…</p>
            ) : markets.length === 0 ? (
              <p className="markets-loading">No markets yet. Check back soon.</p>
            ) : (
              sections.map((cat) => {
                const ms = byCategory[cat];
                if (!ms.length) return null;
                if (catFilter !== "all" && catFilter !== cat) return null;
                return (
                  <div key={cat} className="feed-section" data-cat={cat}>
                    <div className="feed-section-title">{capitalize(cat)}</div>
                    {ms.map((m) => {
                      const resolved = m.status === "resolved";
                      return (
                        <div key={m.id} className="event-card" data-id={m.id}>
                          <div className="event-card-top">
                            <span className={"event-tag " + m.category}>{capitalize(m.category)}</span>
                            {resolved ? (
                              <span className={"outcome-badge " + m.outcome}>
                                {m.outcome === "yes" ? "YES wins" : "NO wins"}
                              </span>
                            ) : null}
                          </div>
                          <div className="event-question">{m.title}</div>
                          <div className="event-bottom">
                            <span className="event-meta">
                              {m.totalTrades} trades · Closes {closesLabel(m)}
                            </span>
                            <div className="event-prices">
                              {resolved ? (
                                <span className="resolved-label">Market closed</span>
                              ) : (
                                <>
                                  <button type="button" className="trade-btn yes-btn" onClick={() => openTrade(m.id, "yes")}>
                                    YES <span className="trade-price">${m.yesPrice.toFixed(2)}</span>
                                  </button>
                                  <button type="button" className="trade-btn no-btn" onClick={() => openTrade(m.id, "no")}>
                                    NO <span className="trade-price">${m.noPrice.toFixed(2)}</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      <div
        id="trade-modal"
        className="trade-modal-overlay"
        style={{ display: modalOpen ? "flex" : "none" }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeTrade();
        }}
      >
        <div className="trade-modal-card">
          <div className="trade-modal-header">
            <div className="trade-modal-title" id="modal-market-title">
              {markets.find((x) => x.id === pendingMarketId)?.title ?? ""}
            </div>
            <button type="button" className="trade-modal-close" id="modal-close-btn" aria-label="Close" onClick={closeTrade}>
              ×
            </button>
          </div>
          <div className="trade-modal-meta">
            <span className={"modal-side-badge " + pendingSide} id="modal-side">
              {pendingSide.toUpperCase()}
            </span>
            <span className="modal-price-label" id="modal-price">
              ${pendingPrice.toFixed(2)} per share
            </span>
          </div>
          <div className="trade-modal-balance">
            Balance: <strong id="modal-user-balance">${userBalance.toFixed(2)}</strong>
          </div>
          <div className="trade-modal-field">
            <label htmlFor="modal-shares">Shares</label>
            <input
              type="number"
              id="modal-shares"
              min={1}
              value={shares}
              onChange={(e) => setShares(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
          <div className="trade-modal-cost">
            Total cost: <strong id="modal-cost">${totalCost.toFixed(2)}</strong>
          </div>
          <button type="button" className="trade-modal-buy-btn" id="modal-buy-btn" onClick={() => void executeTrade()}>
            Buy
          </button>
          <div className={"modal-msg" + (modalMsgClass ? " " + modalMsgClass : "")} id="modal-msg">
            {modalMsg}
          </div>
        </div>
      </div>

      <footer className="footer">
        <div className="container footer-inner">
          <span>Eventra · Prediction Markets</span>
        </div>
      </footer>
    </AppLayout>
  );
}
