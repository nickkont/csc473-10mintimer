import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import "../../../styles.css";

interface FeaturedMarket {
  id: string;
  title: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  totalTrades: number;
}

function useCountUp(target: number, duration = 1400): number {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

const CATEGORY_EMOJI: Record<string, string> = {
  ccny: "🎓", sports: "🏆", politics: "🏛️",
  economics: "📈", culture: "🎭", climate: "🌍", other: "📊",
};

export default function HomePage(): JSX.Element {
  const { user, signOutApp } = useAuth();
  const [markets, setMarkets] = useState(0);
  const [trades, setTrades] = useState(0);
  const [featured, setFeatured] = useState<FeaturedMarket[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "markets"), orderBy("totalTrades", "desc"), limit(10))
        );
        let tradeSum = 0;
        const top: FeaturedMarket[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          tradeSum += Number(data.totalTrades) || 0;
          if (top.length < 3 && data.status !== "resolved") {
            top.push({
              id: d.id,
              title: String(data.title || ""),
              category: String(data.category || "other"),
              yesPrice: Number(data.yesPrice) || 0.5,
              noPrice: Number(data.noPrice) || 0.5,
              totalTrades: Number(data.totalTrades) || 0,
            });
          }
        });
        setMarkets(snap.size);
        setTrades(tradeSum);
        setFeatured(top);
      } catch {
        // leave defaults
      }
    })();
  }, []);

  const animMarkets = useCountUp(markets || 12);
  const animTrades  = useCountUp(trades  || 480);

  const staticFeatured: FeaturedMarket[] = [
    { id: "", title: "Will the shuttle bus break down next month?", category: "ccny", yesPrice: 0.62, noPrice: 0.38, totalTrades: 143 },
    { id: "", title: "Will the Knicks win their next 3 games?",    category: "sports", yesPrice: 0.35, noPrice: 0.65, totalTrades: 210 },
    { id: "", title: "Will there be a government shutdown before July?", category: "politics", yesPrice: 0.41, noPrice: 0.59, totalTrades: 367 },
  ];
  const displayFeatured = featured.length >= 2 ? featured : staticFeatured;

  return (
    <>
      <div className="bg-glow bg-glow-1" aria-hidden="true" />
      <div className="bg-glow bg-glow-2" aria-hidden="true" />
      <SiteHeader />

      <main className="container">
        <section className="hero">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            Live markets · Real predictions
          </div>
          <h1>Prediction Markets <span className="accent">for the culture.</span></h1>
          <p className="hero-sub">
            Buy YES/NO contracts on events you actually care about — from $0.01 to $1.00.
          </p>

          {/* Live stats */}
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-val">{animMarkets.toLocaleString()}</div>
              <div className="hero-stat-label">Active markets</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-val">{animTrades.toLocaleString()}</div>
              <div className="hero-stat-label">Total trades</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-val">$1.00</div>
              <div className="hero-stat-label">Max payout / share</div>
            </div>
          </div>

          <div className="hero-cta">
            {user ? (
              <>
                <Link className="btn btn-primary btn-lg" to="/events">Browse markets</Link>
                <Link className="btn btn-ghost btn-lg" to="/wallet">My wallet</Link>
              </>
            ) : (
              <>
                <Link className="btn btn-primary btn-lg" to="/signup">Get started</Link>
                <Link className="btn btn-ghost btn-lg" to="/events">Browse markets</Link>
              </>
            )}
          </div>
          <button
            className="scroll-hint"
            onClick={() => document.getElementById("featured")?.scrollIntoView({ behavior: "smooth" })}
          >
            Scroll to explore
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </button>
        </section>

        {/* How it works */}
        <section className="how-section">
          <div className="how-title">How it works</div>
          <div className="how-steps">
            <div className="how-step">
              <div className="how-step-num">1</div>
              <div className="how-step-text">
                <strong>Pick a market</strong>
                <span>Browse events across sports, politics, CCNY, economics and more.</span>
              </div>
            </div>
            <div className="how-step">
              <div className="how-step-num">2</div>
              <div className="how-step-text">
                <strong>Buy YES or NO</strong>
                <span>Each share costs between $0.01–$0.99. The price reflects the crowd's probability.</span>
              </div>
            </div>
            <div className="how-step">
              <div className="how-step-num">3</div>
              <div className="how-step-text">
                <strong>Collect your payout</strong>
                <span>Winning shares pay out $1.00 each when the market resolves.</span>
              </div>
            </div>
          </div>
        </section>

        {/* Featured markets */}
        <section id="featured" className="slideshow-section container">
          <div className="slideshow-label">Featured markets</div>
          <div className="cards-scroll">
            {displayFeatured.map((m, i) => {
              const card = (
                <div className="slide-card">
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: "1.2rem" }}>{CATEGORY_EMOJI[m.category] ?? "📊"}</span>
                      <span className={"slide-tag " + m.category}>{m.category.toUpperCase()} · ▲ trending</span>
                    </div>
                    <div className="slide-question">{m.title}</div>
                    <div className="slide-meta">{m.totalTrades} trades</div>
                  </div>
                  <div className="slide-prices">
                    <div className="slide-price yes"><span className="slide-price-label">YES</span><span className="slide-price-val">${m.yesPrice.toFixed(2)}</span></div>
                    <div className="slide-price no"><span className="slide-price-label">NO</span><span className="slide-price-val">${m.noPrice.toFixed(2)}</span></div>
                  </div>
                </div>
              );
              return m.id ? (
                <Link key={m.id} className="snap-card" to={`/events/${m.id}`}>{card}</Link>
              ) : (
                <Link key={i} className="snap-card" to="/events">{card}</Link>
              );
            })}
          </div>
          <div className="slideshow-nav">
            <Link className="events-cta" to="/events">View all markets →</Link>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <span>Eventra · Prediction Markets</span>
          {user ? (
            <button type="button" className="btn btn-ghost" style={{ fontSize: "0.8rem" }} onClick={() => void signOutApp()}>
              Log out
            </button>
          ) : null}
        </div>
      </footer>
    </>
  );
}
