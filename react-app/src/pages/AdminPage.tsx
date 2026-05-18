import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import "../../../styles.css";
import "../../../admin.css";

interface Market {
  id: string;
  title: string;
  category: string;
  closesAt?: { seconds: number };
  status: string;
  outcome?: string;
  yesPrice: number;
  noPrice: number;
  totalTrades: number;
}

function closesLabel(m: Market): string {
  if (!m.closesAt) return "—";
  return new Date(m.closesAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminPage(): JSX.Element {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("ccny");
  const [imageUrl, setImageUrl] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [yesPrice, setYesPrice] = useState(0.5);
  const [createMsg, setCreateMsg] = useState("");
  const [createErr, setCreateErr] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate(`/login?redirect=${encodeURIComponent("/admin")}`, { replace: true }); return; }
    if (role !== "admin") navigate("/events", { replace: true });
  }, [loading, user, role, navigate]);

  const loadMarkets = async (): Promise<void> => {
    const snap = await getDocs(query(collection(db, "markets"), orderBy("createdAt", "desc")));
    setMarkets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Market)));
    setDataLoading(false);
  };

  useEffect(() => {
    if (user && role === "admin") void loadMarkets();
  }, [user, role]);

  const createMarket = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!title.trim() || !closesAt) {
      setCreateMsg("Fill in all required fields.");
      setCreateErr(true);
      return;
    }
    const yp = parseFloat(yesPrice.toString());
    if (isNaN(yp) || yp <= 0 || yp >= 1) {
      setCreateMsg("YES price must be between 0.01 and 0.99.");
      setCreateErr(true);
      return;
    }
    try {
      const marketRef = await addDoc(collection(db, "markets"), {
        title: title.trim(),
        category,
        imageUrl: imageUrl.trim() || null,
        closesAt: Timestamp.fromDate(new Date(closesAt)),
        yesPrice: yp,
        noPrice: parseFloat((1 - yp).toFixed(2)),
        status: "open",
        totalTrades: 0,
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, "markets", marketRef.id, "priceHistory"), {
        yesPrice: yp,
        noPrice: parseFloat((1 - yp).toFixed(2)),
        timestamp: serverTimestamp(),
      });
      setTitle("");
      setImageUrl("");
      setClosesAt("");
      setYesPrice(0.5);
      setCreateMsg("Market created!");
      setCreateErr(false);
      await loadMarkets();
    } catch (e) {
      setCreateMsg((e as Error).message || "Failed to create market.");
      setCreateErr(true);
    }
  };

  const SEED_MARKETS = [
    // CCNY
    { title: "Will CCNY cancel classes for a snow day before May?",        category: "ccny",      yesPrice: 0.58, closesIn: 60 },
    { title: "Will the CCNY cafeteria add a vegan station this semester?", category: "ccny",      yesPrice: 0.34, closesIn: 90 },
    { title: "Will student council elections see record turnout?",         category: "ccny",      yesPrice: 0.47, closesIn: 45 },
    // Sports
    { title: "Will the Yankees win the World Series this year?",           category: "sports",    yesPrice: 0.28, closesIn: 180 },
    { title: "Will LeBron James retire before 2026?",                      category: "sports",    yesPrice: 0.15, closesIn: 200 },
    { title: "Will the USMNT reach the knockout stage of the 2026 World Cup?", category: "sports", yesPrice: 0.66, closesIn: 365 },
    // Politics
    { title: "Will Congress pass a new budget before the next deadline?",  category: "politics",  yesPrice: 0.48, closesIn: 60 },
    { title: "Will a third-party candidate win any electoral votes in 2028?", category: "politics", yesPrice: 0.21, closesIn: 365 },
    // Economics
    { title: "Will the Fed cut rates at least twice before year end?",     category: "economics", yesPrice: 0.71, closesIn: 180 },
    { title: "Will US inflation stay below 4% this year?",                 category: "economics", yesPrice: 0.63, closesIn: 180 },
    { title: "Will Bitcoin exceed $150k by end of 2025?",                  category: "economics", yesPrice: 0.44, closesIn: 200 },
    { title: "Will a major US bank report a quarterly loss this year?",    category: "economics", yesPrice: 0.19, closesIn: 150 },
    // Culture
    { title: "Will Taylor Swift release a new album in 2025?",             category: "culture",   yesPrice: 0.78, closesIn: 180 },
    { title: "Will a superhero movie win Best Picture at the Oscars?",     category: "culture",   yesPrice: 0.11, closesIn: 300 },
    { title: "Will streaming fully overtake cable TV in total viewership?", category: "culture",  yesPrice: 0.87, closesIn: 365 },
    { title: "Will a video game adaptation win a major Emmy award?",       category: "culture",   yesPrice: 0.39, closesIn: 200 },
    // Climate
    { title: "Will 2025 be the hottest year on record?",                   category: "climate",   yesPrice: 0.73, closesIn: 200 },
    { title: "Will California face a major wildfire emergency this summer?", category: "climate",  yesPrice: 0.81, closesIn: 120 },
    { title: "Will the US pass new federal clean energy legislation?",     category: "climate",   yesPrice: 0.29, closesIn: 300 },
    { title: "Will a major Arctic ice record be broken this year?",        category: "climate",   yesPrice: 0.65, closesIn: 180 },
  ] as const;

  const [seedMsg, setSeedMsg] = useState("");
  const [seeding, setSeeding] = useState(false);

  const seedDemoMarkets = async (): Promise<void> => {
    setSeeding(true);
    setSeedMsg("");
    try {
      for (const m of SEED_MARKETS) {
        const np = parseFloat((1 - m.yesPrice).toFixed(2));
        const closes = new Date(Date.now() + m.closesIn * 24 * 60 * 60 * 1000);
        const ref = await addDoc(collection(db, "markets"), {
          title: m.title,
          category: m.category,
          imageUrl: null,
          closesAt: Timestamp.fromDate(closes),
          yesPrice: m.yesPrice,
          noPrice: np,
          status: "open",
          totalTrades: Math.floor(Math.random() * 200 + 20),
          createdAt: serverTimestamp(),
        });
        await addDoc(collection(db, "markets", ref.id, "priceHistory"), {
          yesPrice: m.yesPrice,
          noPrice: np,
          timestamp: serverTimestamp(),
        });
      }
      setSeedMsg(`✓ Added ${SEED_MARKETS.length} demo markets!`);
      await loadMarkets();
    } catch (e) {
      setSeedMsg((e as Error).message || "Seed failed.");
    } finally {
      setSeeding(false);
    }
  };

  const resolveMarket = async (id: string, outcome: "yes" | "no"): Promise<void> => {
    await updateDoc(doc(db, "markets", id), { status: "resolved", outcome });
    await loadMarkets();
  };

  const deleteMarket = async (id: string): Promise<void> => {
    if (!confirm("Delete this market? This cannot be undone.")) return;
    await deleteDoc(doc(db, "markets", id));
    await loadMarkets();
  };

  if (loading || !user || role !== "admin") {
    return (
      <div className="admin-loading-screen">Checking permissions…</div>
    );
  }

  return (
    <>
      <div className="bg-glow bg-glow-1" aria-hidden="true" />
      <div className="bg-glow bg-glow-2" aria-hidden="true" />
      <SiteHeader />

      <div className="admin-page container">
        <h1 className="admin-page-title">Admin Dashboard</h1>

        <div className="admin-section">
          <div className="admin-section-title">Seed Demo Markets</div>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", margin: "0 0 14px" }}>
            Instantly populate all categories with realistic sample markets.
          </p>
          <button
            type="button"
            className="admin-submit-btn"
            disabled={seeding}
            onClick={() => void seedDemoMarkets()}
          >
            {seeding ? "Creating markets…" : "🌱 Seed all categories"}
          </button>
          {seedMsg ? (
            <div className={"admin-msg" + (seedMsg.startsWith("✓") ? " success" : " error")} style={{ marginTop: 10 }}>
              {seedMsg}
            </div>
          ) : null}
        </div>

        <div className="admin-section">
          <div className="admin-section-title">Create Market</div>
          <form className="admin-form" onSubmit={(e) => void createMarket(e)} noValidate>
            <div className="admin-field">
              <label>Question</label>
              <input
                type="text"
                id="market-title"
                placeholder="Will the Knicks win the championship?"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="admin-row">
              <div className="admin-field">
                <label>Category</label>
                <select id="market-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="ccny">CCNY</option>
                  <option value="sports">Sports</option>
                  <option value="politics">Politics</option>
                  <option value="economics">Economics</option>
                  <option value="culture">Culture</option>
                  <option value="climate">Climate</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="admin-field">
                <label>Closes At</label>
                <input
                  type="date"
                  id="market-closes"
                  required
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                />
              </div>
              <div className="admin-field">
                <label>YES Price (0–1)</label>
                <input
                  type="number"
                  id="market-yes-price"
                  min={0.01}
                  max={0.99}
                  step={0.01}
                  required
                  value={yesPrice}
                  onChange={(e) => setYesPrice(parseFloat(e.target.value))}
                />
                <span className="admin-hint">NO price = 1 − YES price ({(1 - yesPrice).toFixed(2)})</span>
              </div>
            </div>
            <div className="admin-field">
              <label>Icon Image URL <span className="admin-hint">(optional — leave blank to use category emoji)</span></label>
              <input
                type="url"
                id="market-image-url"
                placeholder="https://example.com/icon.png"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            <button type="submit" className="admin-submit-btn">Create Market</button>
            {createMsg ? (
              <div className={"admin-msg" + (createErr ? " error" : " success")}>{createMsg}</div>
            ) : null}
          </form>
        </div>

        <div className="admin-section">
          <div className="admin-section-title">Manage Markets</div>
          <div id="admin-markets-list">
            {dataLoading ? (
              <p className="admin-loading">Loading…</p>
            ) : markets.length === 0 ? (
              <p className="admin-loading">No markets yet.</p>
            ) : (
              markets.map((m) => (
                <div key={m.id} className="admin-market-row">
                  <div className="admin-market-info">
                    <div className="admin-market-title">{m.title}</div>
                    <div className="admin-market-meta">
                      {m.category} · YES ${m.yesPrice.toFixed(2)} · NO ${m.noPrice.toFixed(2)} · {m.totalTrades} trades · Closes {closesLabel(m)}
                      {m.status === "resolved" ? (
                        <span className={"admin-outcome-badge " + m.outcome}> · {m.outcome?.toUpperCase()} wins</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="admin-market-actions">
                    {m.status !== "resolved" ? (
                      <>
                        <button type="button" className="admin-resolve-btn yes" onClick={() => void resolveMarket(m.id, "yes")}>
                          Resolve YES
                        </button>
                        <button type="button" className="admin-resolve-btn no" onClick={() => void resolveMarket(m.id, "no")}>
                          Resolve NO
                        </button>
                      </>
                    ) : (
                      <span className="admin-resolved-label">Resolved</span>
                    )}
                    <button type="button" className="admin-delete-btn" onClick={() => void deleteMarket(m.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
