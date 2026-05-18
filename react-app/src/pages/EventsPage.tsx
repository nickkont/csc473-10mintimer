import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ActivityTicker from "../components/ActivityTicker";
import AppLayout from "../components/AppLayout";
import Sparkline from "../components/Sparkline";
import { useAuth } from "../context/AuthContext";
import { loginWithRedirect } from "../lib/siteUrls";
import { placeBet, sellShares } from "../api/bets";
import { claimPayout as apiClaimPayout, getPriceHistory, listMarkets } from "../api/markets";
import type { PriceTick } from "../api/markets";
import { getMyPositions } from "../api/users";
import "../../../styles.css";
import "../../../events-extras.css";

export interface Market {
  id: string;
  title: string;
  category: string;
  imageUrl?: string;
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
  yesCost?: number;
  noCost?: number;
  payoutClaimed?: boolean;
  claimedAmount?: number;
}

const CATEGORY_EMOJI: Record<string, string> = {
  ccny: "🎓", sports: "🏆", politics: "🏛️",
  economics: "📈", culture: "🎭", climate: "🌍", other: "📊",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function closesLabel(m: Market): string {
  const c = m.closesAt as { seconds?: number; toDate?: () => Date } | undefined;
  if (!c) return "—";
  const d = typeof c.toDate === "function" ? c.toDate() : new Date((c.seconds ?? 0) * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ALL_CATEGORIES = ["ccny", "sports", "politics", "economics", "culture", "climate"] as const;
type CatFilter = "all" | typeof ALL_CATEGORIES[number];

export default function EventsPage(): JSX.Element {
  const { user, balance: navBalance } = useAuth();
  const navigate = useNavigate();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [positions, setPositions] = useState<Array<PositionRow & { title: string; market?: Market }>>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<CatFilter>("all");
  const [userBalance, setUserBalance] = useState(0);
  const [histories, setHistories] = useState<Record<string, PriceTick[]>>({});
  const [showClosed, setShowClosed] = useState(false);
  const [showClosedCats, setShowClosedCats] = useState<Record<string, boolean>>({});
  const [flashMarkets, setFlashMarkets] = useState<Record<string, "up" | "down">>({});
  const prevPricesRef = useRef<Record<string, number>>({});

  // Trade modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingMarketId, setPendingMarketId] = useState("");
  const [pendingSide, setPendingSide] = useState<"yes" | "no">("yes");
  const [pendingPrice, setPendingPrice] = useState(0);
  const [pendingAction, setPendingAction] = useState<"buy" | "sell">("buy");
  const [pendingMaxShares, setPendingMaxShares] = useState(0);
  const [pendingCostBasis, setPendingCostBasis] = useState(0);
  const [shares, setShares] = useState(1);
  const [modalMsg, setModalMsg] = useState("");
  const [modalMsgClass, setModalMsgClass] = useState("");

  useEffect(() => { setUserBalance(navBalance); }, [navBalance]);

  const loadMarkets = useCallback(async (silent = false): Promise<void> => {
    if (!silent) setLoading(true);
    try {
      const list = (await listMarkets()) as unknown as Market[];

      // Detect price changes and flash affected cards
      const flashes: Record<string, "up" | "down"> = {};
      for (const m of list) {
        const prev = prevPricesRef.current[m.id];
        if (prev !== undefined && Math.abs(m.yesPrice - prev) > 0.001) {
          flashes[m.id] = m.yesPrice > prev ? "up" : "down";
        }
      }
      prevPricesRef.current = Object.fromEntries(list.map((m) => [m.id, m.yesPrice]));
      if (Object.keys(flashes).length > 0) {
        setFlashMarkets(flashes);
        setTimeout(() => setFlashMarkets({}), 1200);
      }

      setMarkets(list);
      if (user) {
        const posList = await getMyPositions();
        setPositions(posList.map((pos) => {
          const market = list.find((m) => m.id === pos.marketId);
          return { ...pos, title: market ? market.title : pos.marketId, market };
        }));
      } else {
        setPositions([]);
      }
    } catch {
      if (!silent) setMarkets([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  const loadHistories = useCallback(async (ids: string[]): Promise<void> => {
    const results = await Promise.allSettled(
      ids.map((id) => getPriceHistory(id, 30).then((h) => [id, h] as const))
    );
    const next: Record<string, PriceTick[]> = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        const [id, h] = r.value;
        next[id] = h;
      }
    }
    setHistories(next);
  }, []);

  useEffect(() => { void loadMarkets(); }, [loadMarkets]);

  useEffect(() => {
    if (markets.length === 0) return;
    const ids = markets.map((m) => m.id);
    void loadHistories(ids);
    const interval = setInterval(() => {
      void loadHistories(ids);
      void loadMarkets(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [markets.length, loadHistories, loadMarkets]);

  const openTrade = (marketId: string, side: "yes" | "no"): void => {
    if (!user) { navigate(loginWithRedirect("/events")); return; }
    const market = markets.find((m) => m.id === marketId);
    if (!market || market.status === "resolved") return;
    setPendingMarketId(marketId);
    setPendingSide(side);
    setPendingPrice(side === "yes" ? market.yesPrice : market.noPrice);
    setPendingAction("buy");
    setPendingMaxShares(0);
    setPendingCostBasis(0);
    setShares(1);
    setModalMsg("");
    setModalOpen(true);
  };

  const openSell = (marketId: string, side: "yes" | "no", maxShares: number, costBasis: number): void => {
    if (!user) { navigate(loginWithRedirect("/events")); return; }
    const market = markets.find((m) => m.id === marketId);
    if (!market || market.status === "resolved" || maxShares < 1) return;
    setPendingMarketId(marketId);
    setPendingSide(side);
    setPendingPrice(side === "yes" ? market.yesPrice : market.noPrice);
    setPendingAction("sell");
    setPendingMaxShares(maxShares);
    setPendingCostBasis(costBasis);
    setShares(maxShares);
    setModalMsg("");
    setModalOpen(true);
  };

  const totalCost = pendingPrice * Math.max(1, shares);

  const executeTrade = async (): Promise<void> => {
    if (!user || !pendingMarketId) return;
    const n = Math.max(1, shares);
    setModalMsg("Processing…");
    setModalMsgClass("");
    try {
      if (pendingAction === "sell") {
        const { newBalance } = await sellShares({ marketId: pendingMarketId, side: pendingSide, shares: n });
        setUserBalance(newBalance);
        setModalMsg("Sold!");
      } else {
        const { newBalance } = await placeBet({ marketId: pendingMarketId, side: pendingSide, shares: n });
        setUserBalance(newBalance);
        setModalMsg("Trade placed!");
      }
      setModalMsgClass("success");
      await loadMarkets(true);
      setTimeout(() => setModalOpen(false), 800);
    } catch (e) {
      const msg = (e as Error).message || "Trade failed.";
      setModalMsg(msg);
      setModalMsgClass("error");
    }
  };

  const claimPayout = async (marketId: string): Promise<void> => {
    if (!user) return;
    try {
      const { newBalance } = await apiClaimPayout(marketId);
      setUserBalance(newBalance);
      await loadMarkets();
    } catch (e) {
      alert((e as Error).message || "Claim failed.");
    }
  };

  // ── Positions helpers ────────────────────────────────────────────────────────

  const plClass = (pl: number): string => (pl > 0.005 ? "up" : pl < -0.005 ? "down" : "flat");
  const plLabel = (pl: number): string => (pl >= 0 ? `+$${pl.toFixed(2)}` : `-$${Math.abs(pl).toFixed(2)}`);

  const isClosed = (p: PositionRow & { market?: Market }): boolean => {
    const resolved = p.market?.status === "resolved";
    const outcome = p.market?.outcome ?? null;
    const winShares = resolved && outcome ? (outcome === "yes" ? p.yesShares || 0 : p.noShares || 0) : 0;
    if (resolved && (p.payoutClaimed || winShares === 0)) return true;
    if ((p.yesShares || 0) === 0 && (p.noShares || 0) === 0) return true;
    return false;
  };

  const renderPositionCard = (p: PositionRow & { title: string; market?: Market }): JSX.Element => {
    const market = p.market;
    const resolved = market?.status === "resolved";
    const outcome = market?.outcome ?? null;
    const winShares = resolved && outcome ? (outcome === "yes" ? p.yesShares || 0 : p.noShares || 0) : 0;
    const alreadyClaimed = p.payoutClaimed === true;
    const yesPrice = market?.yesPrice ?? 0;
    const noPrice = market?.noPrice ?? 0;
    const yesValue = parseFloat(((p.yesShares || 0) * yesPrice).toFixed(2));
    const noValue  = parseFloat(((p.noShares  || 0) * noPrice).toFixed(2));
    const yesPaid  = typeof p.yesCost === "number" ? p.yesCost : null;
    const noPaid   = typeof p.noCost  === "number" ? p.noCost  : null;
    const yesPL    = yesPaid !== null ? parseFloat((yesValue - yesPaid).toFixed(2)) : null;
    const noPL     = noPaid  !== null ? parseFloat((noValue  - noPaid).toFixed(2))  : null;

    return (
      <div key={p.marketId} className="position-card" data-market-id={p.marketId}>
        <div className="position-card-head">
          <div className="position-card-title">{p.title}</div>
          <Link to={`/events/${p.marketId}`} className="position-card-view">View market →</Link>
        </div>

        <div className="position-card-rows">
          {(p.yesShares || 0) > 0 ? (
            <div className="position-side-block">
              <div className="position-side-row">
                <span className="position-side-label yes">YES</span>
                <span className="position-side-shares">×{p.yesShares}</span>
                <span className="position-side-price">@ ${yesPrice.toFixed(2)}</span>
                <span className="position-side-value">${yesValue.toFixed(2)}</span>
                {!resolved ? (
                  <button type="button" className="position-side-sell"
                    onClick={() => openSell(p.marketId, "yes", p.yesShares || 0, yesPaid ?? 0)}>
                    Sell
                  </button>
                ) : null}
              </div>
              <div className="position-side-meta">
                <span>Paid: {yesPaid !== null ? `$${yesPaid.toFixed(2)}` : "—"}</span>
                <span className={"position-side-pl " + (yesPL !== null ? plClass(yesPL) : "flat")}>
                  P/L: {yesPL !== null ? plLabel(yesPL) : "—"}
                </span>
              </div>
            </div>
          ) : null}

          {(p.noShares || 0) > 0 ? (
            <div className="position-side-block">
              <div className="position-side-row">
                <span className="position-side-label no">NO</span>
                <span className="position-side-shares">×{p.noShares}</span>
                <span className="position-side-price">@ ${noPrice.toFixed(2)}</span>
                <span className="position-side-value">${noValue.toFixed(2)}</span>
                {!resolved ? (
                  <button type="button" className="position-side-sell"
                    onClick={() => openSell(p.marketId, "no", p.noShares || 0, noPaid ?? 0)}>
                    Sell
                  </button>
                ) : null}
              </div>
              <div className="position-side-meta">
                <span>Paid: {noPaid !== null ? `$${noPaid.toFixed(2)}` : "—"}</span>
                <span className={"position-side-pl " + (noPL !== null ? plClass(noPL) : "flat")}>
                  P/L: {noPL !== null ? plLabel(noPL) : "—"}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {resolved && outcome && alreadyClaimed && typeof p.claimedAmount === "number" ? (
          <div className="position-card-foot">
            <span className="claimed-label">Claimed ${p.claimedAmount.toFixed(2)}</span>
          </div>
        ) : null}
        {resolved && outcome && !alreadyClaimed && winShares > 0 ? (
          <div className="position-card-foot">
            <button type="button" className="claim-btn" onClick={() => void claimPayout(p.marketId)}>
              Claim ${winShares.toFixed(2)}
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  // ── Market grid helpers ──────────────────────────────────────────────────────

  const byCategory: Record<string, Market[]> = { ccny: [], sports: [], politics: [], economics: [], culture: [], climate: [], other: [] };
  markets.forEach((m) => {
    const cat = (ALL_CATEGORIES as readonly string[]).includes(m.category) ? m.category : "other";
    byCategory[cat].push(m);
  });
  const sections = [...ALL_CATEGORIES, ...(byCategory.other.length ? ["other"] : [])];

  const openPositions   = positions.filter((p) => !isClosed(p));
  const closedPositions = positions.filter(isClosed);

  return (
    <AppLayout>
      {/* Category bar */}
      <div className="cat-bar">
        <div className="cat-bar-inner">
          {(["all", ...ALL_CATEGORIES] as const).map((cat) => (
            <div
              key={cat}
              className={"cat-tab" + (catFilter === cat ? " active" : "")}
              onClick={() => setCatFilter(cat)}
            >
              {cat === "all" ? "All markets" : capitalize(cat)}
            </div>
          ))}
        </div>
      </div>

      <div className="page-layout">
        {/* Left sidebar */}
        <aside className="sidebar">
          <div className="sidebar-title">Browse</div>
          {(["all", ...ALL_CATEGORIES] as const).map((cat) => (
            <div
              key={cat}
              className={"sidebar-link" + (catFilter === cat ? " active" : "")}
              onClick={() => setCatFilter(cat)}
            >
              {cat === "all" ? "All markets" : capitalize(cat)}
            </div>
          ))}
        </aside>

        {/* Main feed */}
        <main className="feed">

          {/* Positions */}
          {user && positions.length > 0 ? (
            <div id="positions-section" className="feed-section">
              <div className="feed-section-title">My Positions</div>
              <div id="positions-list">
                {openPositions.length === 0 ? (
                  <p className="positions-empty">No active positions. Place a trade to get started.</p>
                ) : (
                  openPositions.map(renderPositionCard)
                )}
              </div>
              {closedPositions.length > 0 ? (
                <div className="closed-positions">
                  <button
                    type="button"
                    className="closed-positions-toggle"
                    onClick={() => setShowClosed((v) => !v)}
                    aria-expanded={showClosed}
                  >
                    <span>{showClosed ? "Hide" : "Show"} closed positions</span>
                    <span className="closed-positions-count">{closedPositions.length}</span>
                  </button>
                  {showClosed ? (
                    <div className="closed-positions-list">
                      {closedPositions.map(renderPositionCard)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Markets feed */}
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
                const openMs   = ms.filter((m) => m.status !== "resolved");
                const closedMs = ms.filter((m) => m.status === "resolved");

                const renderCard = (m: Market) => {
                  const resolved = m.status === "resolved";
                  return (
                    <div
                      key={m.id}
                      className={"event-card" + (flashMarkets[m.id] === "up" ? " price-flash-up" : flashMarkets[m.id] === "down" ? " price-flash-down" : "")}
                      data-id={m.id}
                      onClick={() => navigate(`/events/${m.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="event-card-top">
                        <div className="event-card-icon">
                          {m.imageUrl
                            ? <img src={m.imageUrl} alt="" />
                            : <span>{CATEGORY_EMOJI[m.category] ?? "📊"}</span>}
                        </div>
                        <span className={"event-tag " + m.category}>{capitalize(m.category)}</span>
                        {resolved ? (
                          <span className={"outcome-badge " + m.outcome}>
                            {m.outcome === "yes" ? "YES wins" : "NO wins"}
                          </span>
                        ) : null}
                      </div>
                      <div className="event-question">{m.title}</div>
                      {histories[m.id] && histories[m.id].length >= 2 ? (
                        <div className="event-spark">
                          <Sparkline history={histories[m.id]} side="both" height={40} />
                        </div>
                      ) : null}
                      <div className="event-bottom">
                        <span className="event-meta">
                          {m.totalTrades} trades · Closes {closesLabel(m)}
                        </span>
                        <div className="event-prices">
                          {resolved ? (
                            <span className="resolved-label">Market closed</span>
                          ) : (
                            <>
                              <button type="button" className="trade-btn yes-btn"
                                onClick={(e) => { e.stopPropagation(); openTrade(m.id, "yes"); }}>
                                YES <span className="trade-price">${m.yesPrice.toFixed(2)}</span>
                              </button>
                              <button type="button" className="trade-btn no-btn"
                                onClick={(e) => { e.stopPropagation(); openTrade(m.id, "no"); }}>
                                NO <span className="trade-price">${m.noPrice.toFixed(2)}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                };

                return (
                  <div key={cat} className="feed-section" data-cat={cat}>
                    <div className="feed-section-title">{capitalize(cat)}</div>
                    {openMs.map(renderCard)}
                    {closedMs.length > 0 ? (
                      <div className="closed-cat-markets">
                        <button
                          type="button"
                          className="closed-cat-toggle"
                          onClick={() => setShowClosedCats((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                        >
                          <span>{showClosedCats[cat] ? "Hide" : "Show"} closed markets</span>
                          <span className="closed-cat-count">{closedMs.length}</span>
                        </button>
                        {showClosedCats[cat] ? closedMs.map(renderCard) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </main>

        {/* Right rail — live activity */}
        <aside className="events-activity-rail">
          <ActivityTicker />
        </aside>
      </div>

      {/* Trade / Sell modal */}
      <div
        id="trade-modal"
        className="trade-modal-overlay"
        style={{ display: modalOpen ? "flex" : "none" }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
      >
        <div className="trade-modal-card">
          <div className="trade-modal-header">
            <div className="trade-modal-title">
              {markets.find((x) => x.id === pendingMarketId)?.title ?? ""}
            </div>
            <button type="button" className="trade-modal-close" aria-label="Close" onClick={() => setModalOpen(false)}>×</button>
          </div>
          <div className="trade-modal-meta">
            <span className={"modal-side-badge " + pendingSide}>{pendingSide.toUpperCase()}</span>
            <span className="modal-price-label">${pendingPrice.toFixed(2)} per share</span>
          </div>
          <div className="trade-modal-balance">
            Balance: <strong>${userBalance.toFixed(2)}</strong>
          </div>
          <div className="trade-modal-field">
            <label htmlFor="modal-shares">
              Shares{pendingAction === "sell" ? ` (max ${pendingMaxShares})` : ""}
            </label>
            <input
              type="number" id="modal-shares" min={1}
              max={pendingAction === "sell" ? pendingMaxShares : undefined}
              value={shares}
              onChange={(e) => {
                const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                setShares(pendingAction === "sell" ? Math.min(v, pendingMaxShares) : v);
              }}
            />
          </div>
          <div className="trade-modal-cost">
            {pendingAction === "sell" ? "You'll receive: " : "Total cost: "}
            <strong>${totalCost.toFixed(2)}</strong>
          </div>
          {pendingAction === "sell" && pendingMaxShares > 0 ? (() => {
            const sellN = Math.min(Math.max(1, shares), pendingMaxShares);
            const costPortion = pendingCostBasis * (sellN / pendingMaxShares);
            const projectedPL = parseFloat((totalCost - costPortion).toFixed(2));
            const cls = projectedPL > 0.005 ? "up" : projectedPL < -0.005 ? "down" : "flat";
            const label = projectedPL >= 0 ? `+$${projectedPL.toFixed(2)}` : `-$${Math.abs(projectedPL).toFixed(2)}`;
            return (
              <div className={"trade-modal-pl " + cls}>
                <span>Cost basis (this sale): ${costPortion.toFixed(2)}</span>
                <span>Projected P/L: <strong>{label}</strong></span>
              </div>
            );
          })() : null}
          <button type="button" className="trade-modal-buy-btn" onClick={() => void executeTrade()}>
            {pendingAction === "sell" ? "Sell" : "Buy"}
          </button>
          <div className={"modal-msg" + (modalMsgClass ? " " + modalMsgClass : "")}>
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
