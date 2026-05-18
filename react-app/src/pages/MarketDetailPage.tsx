import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { db } from "../firebase";
import type { Market } from "./EventsPage";
import "../../../styles.css";
import "../../../market-detail.css";

interface PricePoint {
  label: string;
  yes: number;
  ts: number;
}

type TimeFilter = "1D" | "1W" | "1M" | "ALL";

const CATEGORY_EMOJI: Record<string, string> = {
  ccny: "🎓",
  sports: "🏆",
  politics: "🏛️",
  economics: "📈",
  culture: "🎭",
  climate: "🌍",
  other: "📊",
};

function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function simulateHistory(marketId: string, currentPrice: number): PricePoint[] {
  let seed = 0;
  for (let i = 0; i < marketId.length; i++) seed += marketId.charCodeAt(i);
  const points: PricePoint[] = [];
  let price = 0.5;
  const now = Date.now();
  for (let i = 30; i >= 0; i--) {
    const rng = seededRand(seed + i * 7);
    price = price + (currentPrice - price) * 0.12 + (rng - 0.5) * 0.07;
    price = Math.max(0.02, Math.min(0.98, price));
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    points.push({
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      yes: Math.round(price * 100),
      ts: date.getTime(),
    });
  }
  return points;
}

function filterByTime(points: PricePoint[], filter: TimeFilter): PricePoint[] {
  if (filter === "ALL") return points;
  const ranges: Record<TimeFilter, number> = {
    "1D": 864e5,
    "1W": 7 * 864e5,
    "1M": 30 * 864e5,
    "ALL": Infinity,
  };
  const cutoff = Date.now() - ranges[filter];
  return points.filter((p) => p.ts >= cutoff);
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="md-tooltip">
      <div className="md-tooltip-date">{label}</div>
      <div className="md-tooltip-val">{payload[0].value}% YES</div>
    </div>
  );
}

export default function MarketDetailPage(): JSX.Element {
  const { marketId } = useParams<{ marketId: string }>();
  const { user, balance } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [market, setMarket] = useState<Market | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [allPoints, setAllPoints] = useState<PricePoint[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("ALL");

  const [side, setSide] = useState<"yes" | "no">("yes");
  const [shares, setShares] = useState(1);
  const [tradeMsg, setTradeMsg] = useState("");
  const [tradeMsgOk, setTradeMsgOk] = useState(false);
  const [userBalance, setUserBalance] = useState(balance);

  useEffect(() => { setUserBalance(balance); }, [balance]);

  const loadMarket = useCallback(async () => {
    if (!marketId) return;
    setPageLoading(true);
    try {
      const snap = await getDoc(doc(db, "markets", marketId));
      if (!snap.exists()) { navigate("/events"); return; }
      const m = { id: snap.id, ...snap.data() } as Market;
      setMarket(m);

      try {
        const histSnap = await getDocs(
          query(collection(db, "markets", marketId, "priceHistory"), orderBy("timestamp", "asc"))
        );
        if (histSnap.size >= 2) {
          setAllPoints(
            histSnap.docs.map((d) => {
              const data = d.data() as { yesPrice: number; timestamp: { seconds: number } };
              const date = new Date(data.timestamp.seconds * 1000);
              return {
                label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                yes: Math.round(data.yesPrice * 100),
                ts: date.getTime(),
              };
            })
          );
        } else {
          setAllPoints(simulateHistory(marketId, m.yesPrice));
        }
      } catch {
        setAllPoints(simulateHistory(marketId, m.yesPrice));
      }
    } finally {
      setPageLoading(false);
    }
  }, [marketId, navigate]);

  useEffect(() => { void loadMarket(); }, [loadMarket]);

  const chartData = filterByTime(allPoints, timeFilter);
  const currentYes = market ? Math.round(market.yesPrice * 100) : 0;
  const currentNo = market ? Math.round(market.noPrice * 100) : 0;
  const price = side === "yes" ? (market?.yesPrice ?? 0) : (market?.noPrice ?? 0);
  const totalCost = price * Math.max(1, shares);

  const executeTrade = async (): Promise<void> => {
    if (!user || !market || !marketId) return;
    const n = Math.max(1, shares);
    const cost = parseFloat((price * n).toFixed(2));
    if (cost > userBalance) { setTradeMsg("Insufficient balance."); setTradeMsgOk(false); return; }
    setTradeMsg("Processing…");
    const uid = user.uid;
    const userRef = doc(db, "users", uid);
    const marketRef = doc(db, "markets", market.id);
    const posRef = doc(db, "users", uid, "positions", market.id);
    try {
      const newBalance = await runTransaction(db, async (t) => {
        const [userSnap, posSnap, marketSnap] = await Promise.all([
          t.get(userRef), t.get(posRef), t.get(marketRef),
        ]);
        const bal = userSnap.exists() ? Number(userSnap.data().walletBalance) || 0 : 0;
        if (cost > bal) throw new Error("Insufficient balance.");
        const nb = parseFloat((bal - cost).toFixed(2));
        const posData = posSnap.exists() ? posSnap.data() : { yesShares: 0, noShares: 0 };
        const ny = Number(posData.yesShares) + (side === "yes" ? n : 0);
        const nn = Number(posData.noShares) + (side === "no" ? n : 0);
        const trades = marketSnap.exists() ? Number(marketSnap.data().totalTrades) || 0 : 0;
        t.update(userRef, { walletBalance: nb });
        t.set(posRef, { marketId: market.id, yesShares: ny, noShares: nn, updatedAt: serverTimestamp() }, { merge: true });
        const txRef = doc(collection(db, "users", uid, "transactions"));
        t.set(txRef, {
          type: "trade",
          amount: -cost,
          description: `Bought ${n} ${side.toUpperCase()} on: ${market.title}`,
          balance: nb,
          timestamp: serverTimestamp(),
        });
        t.update(marketRef, { totalTrades: trades + 1 });
        const snapRef = doc(collection(db, "markets", market.id, "priceHistory"));
        t.set(snapRef, { yesPrice: market.yesPrice, noPrice: market.noPrice, timestamp: serverTimestamp() });
        return nb;
      });
      setUserBalance(newBalance);
      setTradeMsg("Trade placed!");
      setTradeMsgOk(true);
      toast("Trade placed! 🎉");
      await loadMarket();
    } catch (e) {
      const m = (e as Error).message || "Trade failed.";
      setTradeMsg(m);
      setTradeMsgOk(false);
      toast(m, "error");
    }
  };

  if (pageLoading) {
    return (
      <AppLayout>
        <div className="md-loading">Loading market…</div>
      </AppLayout>
    );
  }

  if (!market) {
    return (
      <AppLayout>
        <div className="md-loading">Market not found.</div>
      </AppLayout>
    );
  }

  const resolved = market.status === "resolved";
  const closesDate = market.closesAt
    ? new Date((market.closesAt as { seconds: number }).seconds * 1000).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : null;

  return (
    <AppLayout>
      <div className="md-page">
        <div className="md-container">
          <button type="button" className="md-back" onClick={() => navigate("/events")}>
            ← Markets
          </button>

          <div className="md-header">
            <div className="md-icon">
              {market.imageUrl
                ? <img src={market.imageUrl} alt="" />
                : <span>{CATEGORY_EMOJI[market.category] ?? "📊"}</span>}
            </div>
            <div className="md-header-text">
              <div className="md-category">{market.category.toUpperCase()}</div>
              <h1 className="md-title">{market.title}</h1>
              <div className="md-stats">
                <span>{market.totalTrades} trades</span>
                {closesDate ? <span>· Closes {closesDate}</span> : null}
                {resolved ? (
                  <span className={"md-resolved-badge " + market.outcome}>
                    · {market.outcome?.toUpperCase()} won
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="md-body">
            {/* Chart */}
            <div className="md-chart-section">
              <div className="md-prob-row">
                <span className="md-prob-value">{currentYes}%</span>
                <span className="md-prob-label">chance YES</span>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="yesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ade80" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="yes"
                    stroke="#4ade80"
                    strokeWidth={2}
                    fill="url(#yesGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#4ade80", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="md-time-filters">
                {(["1D", "1W", "1M", "ALL"] as TimeFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={"md-time-btn" + (timeFilter === f ? " active" : "")}
                    onClick={() => setTimeFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Trade panel */}
            <div className="md-trade-panel">
              {resolved ? (
                <div className="md-resolved-panel">
                  <div className="md-resolved-title">Market resolved</div>
                  <div className={"md-resolved-outcome " + market.outcome}>
                    {market.outcome?.toUpperCase()} wins
                  </div>
                </div>
              ) : (
                <>
                  <div className="md-side-btns">
                    <button
                      type="button"
                      className={"md-side-btn yes" + (side === "yes" ? " active" : "")}
                      onClick={() => setSide("yes")}
                    >
                      Yes {currentYes}¢
                    </button>
                    <button
                      type="button"
                      className={"md-side-btn no" + (side === "no" ? " active" : "")}
                      onClick={() => setSide("no")}
                    >
                      No {currentNo}¢
                    </button>
                  </div>

                  <div className="md-trade-field">
                    <label>Shares</label>
                    <input
                      type="number"
                      min={1}
                      value={shares}
                      onChange={(e) => setShares(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                  </div>

                  <div className="md-cost-row">
                    <span>Total cost</span>
                    <strong>${totalCost.toFixed(2)}</strong>
                  </div>
                  <div className="md-cost-row">
                    <span>Balance</span>
                    <strong>${userBalance.toFixed(2)}</strong>
                  </div>

                  {user ? (
                    <button type="button" className="md-buy-btn" onClick={() => void executeTrade()}>
                      Buy {side.toUpperCase()}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="md-buy-btn"
                      onClick={() => navigate(`/login?redirect=/events/${marketId ?? ""}`)}
                    >
                      Sign up to trade
                    </button>
                  )}

                  {tradeMsg ? (
                    <div className={"md-trade-msg" + (tradeMsgOk ? " ok" : " err")}>{tradeMsg}</div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
