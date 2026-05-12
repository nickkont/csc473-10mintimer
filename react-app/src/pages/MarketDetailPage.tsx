import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import PriceChart from "../components/PriceChart";
import { useAuth } from "../context/AuthContext";
import { placeBet } from "../api/bets";
import { getMarket, getPriceHistory, MarketDoc, PriceTick } from "../api/markets";
import { loginWithRedirect } from "../lib/siteUrls";
import "../../../styles.css";
import "../../../market-detail.css";

type LoadState = "loading" | "found" | "missing";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function closesLabel(m: MarketDoc): string {
  if (!m.closesAt) return "—";
  return new Date(m.closesAt.seconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MarketDetailPage(): JSX.Element {
  const { marketId } = useParams<{ marketId: string }>();
  const { user, balance } = useAuth();
  const navigate = useNavigate();

  const [market, setMarket] = useState<MarketDoc | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [shares, setShares] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState(false);
  const [userBalance, setUserBalance] = useState(balance);
  const [history, setHistory] = useState<PriceTick[]>([]);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevYesRef = useRef<number | null>(null);

  useEffect(() => {
    setUserBalance(balance);
  }, [balance]);

  const loadMarket = useCallback(async (): Promise<void> => {
    if (!marketId) {
      setState("missing");
      return;
    }
    try {
      const m = await getMarket(marketId);
      setMarket((prev) => {
        if (prev && m.yesPrice !== prev.yesPrice) {
          setFlash(m.yesPrice > prev.yesPrice ? "up" : "down");
          setTimeout(() => setFlash(null), 600);
        }
        return m;
      });
      setState("found");
    } catch {
      setState("missing");
    }
  }, [marketId]);

  const loadHistory = useCallback(async (): Promise<void> => {
    if (!marketId) return;
    try {
      const h = await getPriceHistory(marketId, 100);
      setHistory(h);
    } catch {
      // ignore — chart will show empty state
    }
  }, [marketId]);

  useEffect(() => {
    setState("loading");
    void loadMarket();
    void loadHistory();
  }, [loadMarket, loadHistory]);

  useEffect(() => {
    if (state !== "found" || !market || market.status === "resolved") return;
    const interval = setInterval(() => {
      void loadMarket();
      void loadHistory();
    }, 5000);
    return () => clearInterval(interval);
  }, [state, market, loadMarket, loadHistory]);

  useEffect(() => {
    if (market) prevYesRef.current = market.yesPrice;
  }, [market]);

  const onTrade = async (): Promise<void> => {
    if (!user) {
      navigate(loginWithRedirect(`/market/${marketId ?? ""}`));
      return;
    }
    if (!market || !marketId) return;
    if (market.status === "resolved") return;
    const n = Math.max(1, Math.floor(shares) || 1);
    setBusy(true);
    setMsg("");
    setMsgErr(false);
    try {
      const { newBalance } = await placeBet({ marketId, side, shares: n });
      setUserBalance(newBalance);
      setMsg(`Bought ${n} ${side.toUpperCase()} share${n === 1 ? "" : "s"}.`);
      await loadMarket();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setMsg(err.response?.data?.error ?? err.message ?? "Trade failed.");
      setMsgErr(true);
    } finally {
      setBusy(false);
    }
  };

  const price = market ? (side === "yes" ? market.yesPrice : market.noPrice) : 0;
  const totalCost = parseFloat((price * Math.max(1, shares)).toFixed(2));

  return (
    <AppLayout>
      <div className="market-detail container">
        <Link to="/events" className="market-detail-back">
          ← Back to markets
        </Link>

        {state === "loading" ? <p className="markets-loading">Loading…</p> : null}

        {state === "missing" ? (
          <div className="market-detail-card">
            <p>No market found for ID <code>{marketId}</code>.</p>
          </div>
        ) : null}

        {state === "found" && market ? (
          <>
            <header className="market-detail-head">
              <div className="market-detail-tags">
                <span className={"event-tag " + market.category}>
                  {capitalize(market.category)}
                </span>
                {market.status === "resolved" && market.outcome ? (
                  <span className={"outcome-badge " + market.outcome}>
                    {market.outcome.toUpperCase()} wins
                  </span>
                ) : (
                  <span className="market-detail-status">Open</span>
                )}
              </div>
              <h1 className="market-detail-title">{market.title}</h1>
              <p className="market-detail-meta">
                {market.totalTrades} trades · Closes {closesLabel(market)} · ID: <code>{market.id}</code>
              </p>
            </header>

            <section className="market-detail-grid">
              <article className="market-detail-card market-detail-prices">
                <h2 className="market-detail-h2">Current prices</h2>
                <div className="market-detail-price-row">
                  <div className={"market-detail-price-tile yes" + (flash ? " flash-" + flash : "")}>
                    <div className="market-detail-price-label">YES</div>
                    <div className="market-detail-price-value">${market.yesPrice.toFixed(2)}</div>
                  </div>
                  <div className={"market-detail-price-tile no" + (flash ? " flash-" + (flash === "up" ? "down" : "up") : "")}>
                    <div className="market-detail-price-label">NO</div>
                    <div className="market-detail-price-value">${market.noPrice.toFixed(2)}</div>
                  </div>
                </div>
                <p className="market-detail-hint">
                  Each winning share pays out $1.00 when the market resolves.
                </p>
              </article>

              <article className="market-detail-card market-detail-trade">
                <h2 className="market-detail-h2">Place a trade</h2>
                {market.status === "resolved" ? (
                  <p className="market-detail-closed">This market is closed.</p>
                ) : (
                  <>
                    <div className="market-detail-side-toggle">
                      <button
                        type="button"
                        className={"market-detail-side-btn yes" + (side === "yes" ? " active" : "")}
                        onClick={() => setSide("yes")}
                      >
                        YES · ${market.yesPrice.toFixed(2)}
                      </button>
                      <button
                        type="button"
                        className={"market-detail-side-btn no" + (side === "no" ? " active" : "")}
                        onClick={() => setSide("no")}
                      >
                        NO · ${market.noPrice.toFixed(2)}
                      </button>
                    </div>
                    <label className="market-detail-field-label" htmlFor="md-shares">
                      Shares
                    </label>
                    <input
                      id="md-shares"
                      type="number"
                      min={1}
                      value={shares}
                      onChange={(e) => setShares(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="market-detail-input"
                    />
                    <div className="market-detail-cost-row">
                      <span>Total cost</span>
                      <strong>${totalCost.toFixed(2)}</strong>
                    </div>
                    {user ? (
                      <div className="market-detail-cost-row market-detail-balance">
                        <span>Balance</span>
                        <strong>${userBalance.toFixed(2)}</strong>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="market-detail-buy-btn"
                      onClick={() => void onTrade()}
                      disabled={busy}
                    >
                      {busy ? "Placing…" : user ? `Buy ${side.toUpperCase()}` : "Log in to trade"}
                    </button>
                    {msg ? (
                      <div className={"market-detail-msg" + (msgErr ? " error" : " success")}>
                        {msg}
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            </section>

            <section className="market-detail-card market-detail-chart-card">
              <div className="market-detail-chart-head">
                <h2 className="market-detail-h2">{side.toUpperCase()} price history</h2>
                <span className="market-detail-chart-hint">Live · updates every 30s</span>
              </div>
              <PriceChart history={history} side={side} />
            </section>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
