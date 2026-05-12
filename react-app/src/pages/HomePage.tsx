import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import { listMarkets, MarketDoc } from "../api/markets";
import "../../../styles.css";

function closesLabel(m: MarketDoc): string {
  const ca = m.closesAt;
  if (!ca) return "—";
  return new Date(ca.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const KNOWN_TAGS = new Set(["ccny", "sports", "politics"]);
function tagClass(category: string): string {
  return KNOWN_TAGS.has(category) ? category : "other";
}

export default function HomePage(): JSX.Element {
  const { user } = useAuth();
  const [featured, setFeatured] = useState<MarketDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false): Promise<void> => {
    if (!silent) setLoading(true);
    try {
      const all = await listMarkets();
      const open = all.filter((m) => m.status !== "resolved");
      const sorted = [...open].sort((a, b) => (b.totalTrades || 0) - (a.totalTrades || 0));
      setFeatured(sorted.slice(0, 3));
    } catch {
      if (!silent) setFeatured([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(true), 10000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <AppLayout>
      <main className="container">
        <section className="hero">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            Live markets · Real predictions
          </div>
          <h1>Prediction Markets for <span className="accent">the culture.</span></h1>
          <p className="hero-sub">
            Buy YES/NO contracts on events you actually care about — from $0.01 to $1.00.
          </p>
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

        <section id="featured" className="slideshow-section container">
          <div className="slideshow-label">Featured markets</div>
          <div className="cards-scroll">
            {loading && featured.length === 0 ? (
              <p className="markets-loading">Loading featured markets…</p>
            ) : featured.length === 0 ? (
              <p className="markets-loading">No open markets right now.</p>
            ) : (
              featured.map((m) => (
                <Link key={m.id} className="snap-card" to={`/market/${m.id}`}>
                  <div className="slide-card">
                    <div>
                      <span className={"slide-tag " + tagClass(m.category)}>
                        {(m.category || "other").toUpperCase()} · ▲ trending
                      </span>
                      <div className="slide-question">{m.title}</div>
                      <div className="slide-meta">{m.totalTrades} trades · Closes {closesLabel(m)}</div>
                    </div>
                    <div className="slide-prices">
                      <div className="slide-price yes">
                        <span className="slide-price-label">YES</span>
                        <span className="slide-price-val">${m.yesPrice.toFixed(2)}</span>
                      </div>
                      <div className="slide-price no">
                        <span className="slide-price-label">NO</span>
                        <span className="slide-price-val">${m.noPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
          <div className="slideshow-nav">
            <Link className="events-cta" to="/events">View all markets →</Link>
          </div>
        </section>
      </main>
    </AppLayout>
  );
}
