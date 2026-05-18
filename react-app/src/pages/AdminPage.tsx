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
  imageUrl?: string;
  closesAt?: { seconds: number };
  status: string;
  outcome?: string;
  yesPrice: number;
  noPrice: number;
  totalTrades: number;
}

function closesLabel(m: Market): string {
  if (!m.closesAt) return "—";
  return new Date(m.closesAt.seconds * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const CATEGORY_EMOJI: Record<string, string> = {
  ccny: "🎓", sports: "🏆", politics: "🏛️",
  economics: "📈", culture: "🎭", climate: "🌍", other: "📊",
};

// ── Seed data ─────────────────────────────────────────────────────────────────
const W  = "https://upload.wikimedia.org/wikipedia/commons/thumb";
const WE = "https://upload.wikimedia.org/wikipedia/en/thumb";
const lf = (kw: string, lock: number) => `https://loremflickr.com/100/100/${kw}?lock=${lock}`;

const SEED_MARKETS = [
  { title: "Will CCNY cancel classes for a snow day before May?",            category: "ccny",      yesPrice: 0.58, closesIn: 60,  imageUrl: lf("snowstorm", 240) },
  { title: "Will the CCNY cafeteria add a vegan station this semester?",     category: "ccny",      yesPrice: 0.34, closesIn: 90,  imageUrl: lf("salad", 250) },
  { title: "Will student council elections see record turnout?",              category: "ccny",      yesPrice: 0.47, closesIn: 45,  imageUrl: lf("election", 260) },
  { title: "Will the Yankees win the World Series this year?",               category: "sports",    yesPrice: 0.28, closesIn: 180, imageUrl: `${W}/f/f0/New_York_Yankees_Primary_Logo.svg/100px-New_York_Yankees_Primary_Logo.svg.png` },
  { title: "Will LeBron James retire before 2026?",                          category: "sports",    yesPrice: 0.15, closesIn: 200, imageUrl: `${WE}/0/03/National_Basketball_Association_logo.svg/100px-National_Basketball_Association_logo.svg.png` },
  { title: "Will the USMNT reach the knockout stage of the 2026 World Cup?", category: "sports",    yesPrice: 0.66, closesIn: 365, imageUrl: lf("soccer", 270) },
  { title: "Will Congress pass a new budget before the next deadline?",      category: "politics",  yesPrice: 0.48, closesIn: 60,  imageUrl: `${W}/4/4f/US_Capitol_west_side.JPG/100px-US_Capitol_west_side.JPG` },
  { title: "Will a third-party candidate win any electoral votes in 2028?",  category: "politics",  yesPrice: 0.21, closesIn: 365, imageUrl: lf("politics", 300) },
  { title: "Will the Fed cut rates at least twice before year end?",         category: "economics", yesPrice: 0.71, closesIn: 180, imageUrl: `${W}/b/be/Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg/100px-Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg` },
  { title: "Will US inflation stay below 4% this year?",                     category: "economics", yesPrice: 0.63, closesIn: 180, imageUrl: lf("currency", 170) },
  { title: "Will Bitcoin exceed $150k by end of 2025?",                      category: "economics", yesPrice: 0.44, closesIn: 200, imageUrl: `${W}/4/46/Bitcoin.svg/100px-Bitcoin.svg.png` },
  { title: "Will the S&P 500 hit a new all-time high before July?",          category: "economics", yesPrice: 0.58, closesIn: 60,  imageUrl: lf("stock-market", 190) },
  { title: "Will the US enter a recession in 2025?",                         category: "economics", yesPrice: 0.31, closesIn: 200, imageUrl: lf("recession", 210) },
  { title: "Will Taylor Swift release a new album in 2025?",                 category: "culture",   yesPrice: 0.78, closesIn: 180, imageUrl: lf("music-concert", 90) },
  { title: "Will a superhero movie win Best Picture at the Oscars?",         category: "culture",   yesPrice: 0.11, closesIn: 300, imageUrl: `${W}/6/66/OscarStatuette.jpg/100px-OscarStatuette.jpg` },
  { title: "Will GTA VI release in 2025?",                                   category: "culture",   yesPrice: 0.61, closesIn: 180, imageUrl: lf("video-game", 110) },
  { title: "Will 2025 be the hottest year on record?",                       category: "climate",   yesPrice: 0.73, closesIn: 200, imageUrl: lf("heatwave", 70) },
  { title: "Will California face a major wildfire emergency this summer?",   category: "climate",   yesPrice: 0.81, closesIn: 120, imageUrl: lf("wildfire", 10) },
  { title: "Will the US pass new federal clean energy legislation?",         category: "climate",   yesPrice: 0.29, closesIn: 300, imageUrl: lf("wind-turbine", 80) },
  { title: "Will a Category 5 hurricane hit the US mainland in 2025?",      category: "climate",   yesPrice: 0.42, closesIn: 150, imageUrl: `${W}/1/10/Hurricane_Isabel_from_ISS.jpg/100px-Hurricane_Isabel_from_ISS.jpg` },
] as const;

function pickImage(title: string, category: string): string {
  const t = title.toLowerCase();
  if (t.includes("bitcoin"))                                return `${W}/4/46/Bitcoin.svg/100px-Bitcoin.svg.png`;
  if (t.includes("ethereum"))                               return `${W}/0/05/Ethereum_logo_2014.svg/100px-Ethereum_logo_2014.svg.png`;
  if (t.includes("apple"))                                  return `${W}/f/fa/Apple_logo_black.svg/100px-Apple_logo_black.svg.png`;
  if (t.includes("yankee"))                                 return `${W}/f/f0/New_York_Yankees_Primary_Logo.svg/100px-New_York_Yankees_Primary_Logo.svg.png`;
  if (t.includes("hurricane"))                              return `${W}/1/10/Hurricane_Isabel_from_ISS.jpg/100px-Hurricane_Isabel_from_ISS.jpg`;
  if (t.includes("oscar") || t.includes("best picture"))   return `${W}/6/66/OscarStatuette.jpg/100px-OscarStatuette.jpg`;
  if (t.includes("congress") || t.includes("budget"))      return `${W}/4/4f/US_Capitol_west_side.JPG/100px-US_Capitol_west_side.JPG`;
  if (t.includes("fed cut") || t.includes("interest rate"))return `${W}/b/be/Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg/100px-Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg`;
  if (t.includes("wildfire"))   return lf("wildfire", 10);
  if (t.includes("solar"))      return lf("solar-energy", 20);
  if (t.includes("heatwave") || t.includes("hottest")) return lf("heatwave", 70);
  if (t.includes("soccer") || t.includes("world cup"))     return lf("soccer", 270);
  if (t.includes("snow"))       return lf("snowstorm", 240);
  if (t.includes("vegan"))      return lf("salad", 250);
  if (t.includes("election"))   return lf("election", 260);
  if (t.includes("taylor swift") || t.includes("album")) return lf("music-concert", 90);
  if (t.includes("gta") || t.includes("video game"))     return lf("video-game", 110);
  if (t.includes("inflation"))  return lf("currency", 170);
  if (t.includes("s&p") || t.includes("stock"))          return lf("stock-market", 190);
  if (t.includes("recession"))  return lf("recession", 210);
  const fallbacks: Record<string, string> = {
    ccny: lf("college-campus", 1), sports: lf("sports", 2),
    politics: lf("politics", 3),   economics: lf("finance", 4),
    culture: lf("culture", 5),     climate: lf("climate", 6),
  };
  return fallbacks[category] ?? lf("market", 7);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminPage(): JSX.Element {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [listFilter, setListFilter] = useState<"all" | "open" | "resolved">("all");

  // Create form
  const [title, setTitle]       = useState("");
  const [category, setCategory] = useState("ccny");
  const [imageUrl, setImageUrl] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [yesPrice, setYesPrice] = useState(0.5);
  const [createMsg, setCreateMsg] = useState("");
  const [createErr, setCreateErr] = useState(false);
  const [creating, setCreating]   = useState(false);

  // Tools
  const [seedMsg, setSeedMsg]   = useState("");
  const [seeding, setSeeding]   = useState(false);
  const [patchMsg, setPatchMsg] = useState("");
  const [patching, setPatching] = useState(false);

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

  // Derived stats
  const openCount     = markets.filter((m) => m.status === "open").length;
  const resolvedCount = markets.filter((m) => m.status === "resolved").length;
  const filteredMarkets = markets.filter((m) => {
    if (listFilter === "open")     return m.status === "open";
    if (listFilter === "resolved") return m.status === "resolved";
    return true;
  });

  const createMarket = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!title.trim() || !closesAt) { setCreateMsg("Fill in all required fields."); setCreateErr(true); return; }
    const yp = parseFloat(yesPrice.toString());
    if (isNaN(yp) || yp <= 0 || yp >= 1) { setCreateMsg("YES price must be between 0.01 and 0.99."); setCreateErr(true); return; }
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, "markets"), {
        title: title.trim(), category,
        imageUrl: imageUrl.trim() || null,
        closesAt: Timestamp.fromDate(new Date(closesAt)),
        yesPrice: yp, noPrice: parseFloat((1 - yp).toFixed(2)),
        status: "open", totalTrades: 0, createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, "markets", ref.id, "priceHistory"), {
        yesPrice: yp, noPrice: parseFloat((1 - yp).toFixed(2)), timestamp: serverTimestamp(),
      });
      setTitle(""); setImageUrl(""); setClosesAt(""); setYesPrice(0.5);
      setCreateMsg("Market created!"); setCreateErr(false);
      await loadMarkets();
    } catch (err) {
      setCreateMsg((err as Error).message || "Failed to create market."); setCreateErr(true);
    } finally {
      setCreating(false);
    }
  };

  const seedDemoMarkets = async (): Promise<void> => {
    setSeeding(true); setSeedMsg("");
    try {
      for (const m of SEED_MARKETS) {
        const np = parseFloat((1 - m.yesPrice).toFixed(2));
        const closes = new Date(Date.now() + m.closesIn * 86400000);
        const ref = await addDoc(collection(db, "markets"), {
          title: m.title, category: m.category, imageUrl: m.imageUrl,
          closesAt: Timestamp.fromDate(closes),
          yesPrice: m.yesPrice, noPrice: np, status: "open",
          totalTrades: Math.floor(Math.random() * 200 + 20), createdAt: serverTimestamp(),
        });
        await addDoc(collection(db, "markets", ref.id, "priceHistory"), {
          yesPrice: m.yesPrice, noPrice: np, timestamp: serverTimestamp(),
        });
      }
      setSeedMsg(`Added ${SEED_MARKETS.length} demo markets.`);
      await loadMarkets();
    } catch (err) { setSeedMsg((err as Error).message || "Seed failed."); }
    finally { setSeeding(false); }
  };

  const patchMarketImages = async (): Promise<void> => {
    setPatching(true); setPatchMsg("");
    try {
      const snap = await getDocs(query(collection(db, "markets"), orderBy("createdAt", "desc")));
      for (const d of snap.docs) {
        const data = d.data();
        await updateDoc(doc(db, "markets", d.id), { imageUrl: pickImage(String(data.title || ""), String(data.category || "")) });
      }
      setPatchMsg(`Updated ${snap.size} markets with images.`);
      await loadMarkets();
    } catch (err) { setPatchMsg((err as Error).message || "Patch failed."); }
    finally { setPatching(false); }
  };

  const clearMarketImages = async (): Promise<void> => {
    setPatching(true); setPatchMsg("");
    try {
      const snap = await getDocs(query(collection(db, "markets"), orderBy("createdAt", "desc")));
      for (const d of snap.docs) await updateDoc(doc(db, "markets", d.id), { imageUrl: null });
      setPatchMsg(`Cleared images from ${snap.size} markets.`);
      await loadMarkets();
    } catch (err) { setPatchMsg((err as Error).message || "Clear failed."); }
    finally { setPatching(false); }
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
    return <div className="admin-loading-screen">Checking permissions…</div>;
  }

  return (
    <>
      <div className="bg-glow bg-glow-1" aria-hidden="true" />
      <div className="bg-glow bg-glow-2" aria-hidden="true" />
      <SiteHeader />

      <div className="admin-page container">

        {/* ── Page header ── */}
        <div className="admin-header">
          <div>
            <h1 className="admin-page-title">Admin Dashboard</h1>
            <p className="admin-page-sub">Manage prediction markets and platform content.</p>
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="admin-stats-bar">
          <div className="admin-stat">
            <span className="admin-stat-val">{markets.length}</span>
            <span className="admin-stat-label">Total markets</span>
          </div>
          <div className="admin-stat-divider" />
          <div className="admin-stat">
            <span className="admin-stat-val admin-stat-open">{openCount}</span>
            <span className="admin-stat-label">Open</span>
          </div>
          <div className="admin-stat-divider" />
          <div className="admin-stat">
            <span className="admin-stat-val admin-stat-resolved">{resolvedCount}</span>
            <span className="admin-stat-label">Resolved</span>
          </div>
        </div>

        {/* ── Top grid: Create + Tools ── */}
        <div className="admin-top-grid">

          {/* Create market */}
          <section className="admin-card" aria-labelledby="create-heading">
            <h2 className="admin-card-title" id="create-heading">Create Market</h2>
            <form className="admin-form" onSubmit={(e) => void createMarket(e)} noValidate>
              <div className="admin-field">
                <label htmlFor="market-title">Question</label>
                <input
                  type="text" id="market-title"
                  placeholder="Will the Knicks win the championship?"
                  required value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="admin-row-2">
                <div className="admin-field">
                  <label htmlFor="market-category">Category</label>
                  <select id="market-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="ccny">🎓 CCNY</option>
                    <option value="sports">🏆 Sports</option>
                    <option value="politics">🏛️ Politics</option>
                    <option value="economics">📈 Economics</option>
                    <option value="culture">🎭 Culture</option>
                    <option value="climate">🌍 Climate</option>
                    <option value="other">📊 Other</option>
                  </select>
                </div>
                <div className="admin-field">
                  <label htmlFor="market-closes">Closes At</label>
                  <input type="date" id="market-closes" required value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
                </div>
              </div>

              <div className="admin-field">
                <label htmlFor="market-yes-price">
                  YES Price
                  <span className="admin-label-hint">0.01 – 0.99  ·  NO = {(1 - yesPrice).toFixed(2)}</span>
                </label>
                <div className="admin-price-wrap">
                  <input
                    type="number" id="market-yes-price"
                    min={0.01} max={0.99} step={0.01} required
                    value={yesPrice}
                    onChange={(e) => setYesPrice(parseFloat(e.target.value))}
                  />
                  <div className="admin-price-bar">
                    <div className="admin-price-yes" style={{ width: `${Math.round(yesPrice * 100)}%` }} />
                    <div className="admin-price-no"  style={{ width: `${Math.round((1 - yesPrice) * 100)}%` }} />
                  </div>
                </div>
              </div>

              <div className="admin-field">
                <label htmlFor="market-image-url">
                  Image URL
                  <span className="admin-label-hint">optional — leave blank for category emoji</span>
                </label>
                <input
                  type="url" id="market-image-url"
                  placeholder="https://example.com/icon.png"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>

              <div className="admin-form-footer">
                <button type="submit" className="admin-btn-primary" disabled={creating}>
                  {creating ? "Creating…" : "Create Market"}
                </button>
                {createMsg ? (
                  <p className={"admin-form-msg " + (createErr ? "error" : "success")}>{createMsg}</p>
                ) : null}
              </div>
            </form>
          </section>

          {/* Tools */}
          <aside className="admin-tools" aria-label="Admin tools">
            <section className="admin-card">
              <h2 className="admin-card-title">Seed Demo Markets</h2>
              <p className="admin-card-desc">Populate all categories with {SEED_MARKETS.length} realistic sample markets.</p>
              <button type="button" className="admin-btn-secondary admin-btn-full" disabled={seeding} onClick={() => void seedDemoMarkets()}>
                {seeding ? "Creating…" : "Seed all categories"}
              </button>
              {seedMsg ? <p className="admin-tool-msg success">{seedMsg}</p> : null}
            </section>

            <section className="admin-card" style={{ marginTop: 14 }}>
              <h2 className="admin-card-title">Market Images</h2>
              <p className="admin-card-desc">Auto-assign images based on market titles, or restore emojis.</p>
              <div className="admin-tool-btns">
                <button type="button" className="admin-btn-secondary" disabled={patching} onClick={() => void patchMarketImages()}>
                  {patching ? "Updating…" : "Assign images"}
                </button>
                <button type="button" className="admin-btn-ghost" disabled={patching} onClick={() => void clearMarketImages()}>
                  Clear all
                </button>
              </div>
              {patchMsg ? <p className="admin-tool-msg success">{patchMsg}</p> : null}
            </section>
          </aside>
        </div>

        {/* ── Markets list ── */}
        <section className="admin-card admin-markets-section" aria-labelledby="markets-heading">
          <div className="admin-markets-head">
            <h2 className="admin-card-title" id="markets-heading">
              Markets
              <span className="admin-markets-count">{filteredMarkets.length}</span>
            </h2>
            <div className="admin-filter-tabs" role="tablist">
              {(["all", "open", "resolved"] as const).map((f) => (
                <button
                  key={f} type="button" role="tab"
                  className={"admin-filter-tab" + (listFilter === f ? " active" : "")}
                  onClick={() => setListFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {dataLoading ? (
            <p className="admin-empty">Loading markets…</p>
          ) : filteredMarkets.length === 0 ? (
            <p className="admin-empty">No {listFilter !== "all" ? listFilter : ""} markets yet.</p>
          ) : (
            <div className="admin-market-list">
              {filteredMarkets.map((m) => (
                <div key={m.id} className={"admin-market-card" + (m.status === "resolved" ? " resolved" : "")}>
                  <div className="admin-market-icon">
                    {m.imageUrl
                      ? <img src={m.imageUrl} alt="" />
                      : <span>{CATEGORY_EMOJI[m.category] ?? "📊"}</span>}
                  </div>
                  <div className="admin-market-body">
                    <div className="admin-market-top-row">
                      <span className={"admin-cat-tag " + m.category}>{m.category}</span>
                      {m.status === "resolved"
                        ? <span className={"admin-status-badge resolved " + m.outcome}>{m.outcome?.toUpperCase()} won</span>
                        : <span className="admin-status-badge open">Open</span>}
                    </div>
                    <p className="admin-market-title">{m.title}</p>
                    <div className="admin-market-meta-row">
                      <span className="admin-price-chip yes">YES {Math.round(m.yesPrice * 100)}¢</span>
                      <span className="admin-price-chip no">NO {Math.round(m.noPrice * 100)}¢</span>
                      <span className="admin-meta-item">{m.totalTrades} trades</span>
                      <span className="admin-meta-item">Closes {closesLabel(m)}</span>
                    </div>
                  </div>
                  <div className="admin-market-actions">
                    {m.status !== "resolved" ? (
                      <>
                        <button type="button" className="admin-resolve-btn yes" onClick={() => void resolveMarket(m.id, "yes")}>
                          YES wins
                        </button>
                        <button type="button" className="admin-resolve-btn no" onClick={() => void resolveMarket(m.id, "no")}>
                          NO wins
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
              ))}
            </div>
          )}
        </section>

      </div>
    </>
  );
}
