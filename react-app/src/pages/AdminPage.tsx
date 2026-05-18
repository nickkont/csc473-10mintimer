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

  const W = "https://upload.wikimedia.org/wikipedia/commons/thumb";
  const WE = "https://upload.wikimedia.org/wikipedia/en/thumb";
  const P = (kw: string, lock = 1) => `https://loremflickr.com/100/100/${kw}?lock=${lock}`;

  const SEED_MARKETS = [
    // CCNY
    { title: "Will CCNY cancel classes for a snow day before May?",           category: "ccny",      yesPrice: 0.58, closesIn: 60,  imageUrl: P("snowstorm", 240) },
    { title: "Will the CCNY cafeteria add a vegan station this semester?",    category: "ccny",      yesPrice: 0.34, closesIn: 90,  imageUrl: P("salad", 250) },
    { title: "Will student council elections see record turnout?",             category: "ccny",      yesPrice: 0.47, closesIn: 45,  imageUrl: P("election", 260) },
    // Sports
    { title: "Will the Yankees win the World Series this year?",              category: "sports",    yesPrice: 0.28, closesIn: 180, imageUrl: `${W}/f/f0/New_York_Yankees_Primary_Logo.svg/100px-New_York_Yankees_Primary_Logo.svg.png` },
    { title: "Will LeBron James retire before 2026?",                         category: "sports",    yesPrice: 0.15, closesIn: 200, imageUrl: `${WE}/0/03/National_Basketball_Association_logo.svg/100px-National_Basketball_Association_logo.svg.png` },
    { title: "Will the USMNT reach the knockout stage of the 2026 World Cup?",category: "sports",    yesPrice: 0.66, closesIn: 365, imageUrl: P("soccer", 270) },
    // Politics
    { title: "Will Congress pass a new budget before the next deadline?",     category: "politics",  yesPrice: 0.48, closesIn: 60,  imageUrl: `${W}/4/4f/US_Capitol_west_side.JPG/100px-US_Capitol_west_side.JPG` },
    { title: "Will a third-party candidate win any electoral votes in 2028?", category: "politics",  yesPrice: 0.21, closesIn: 365, imageUrl: P("politics", 300) },
    // Economics
    { title: "Will the Fed cut rates at least twice before year end?",        category: "economics", yesPrice: 0.71, closesIn: 180, imageUrl: `${W}/b/be/Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg/100px-Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg` },
    { title: "Will US inflation stay below 4% this year?",                    category: "economics", yesPrice: 0.63, closesIn: 180, imageUrl: P("currency", 170) },
    { title: "Will Bitcoin exceed $150k by end of 2025?",                     category: "economics", yesPrice: 0.44, closesIn: 200, imageUrl: `${W}/4/46/Bitcoin.svg/100px-Bitcoin.svg.png` },
    { title: "Will a major US bank report a quarterly loss this year?",       category: "economics", yesPrice: 0.19, closesIn: 150, imageUrl: P("bank", 180) },
    { title: "Will the S&P 500 hit a new all-time high before July?",         category: "economics", yesPrice: 0.58, closesIn: 60,  imageUrl: P("stock-market", 190) },
    { title: "Will the US unemployment rate exceed 5% this year?",            category: "economics", yesPrice: 0.23, closesIn: 180, imageUrl: P("unemployment", 200) },
    { title: "Will Ethereum flip Bitcoin in market cap by 2026?",             category: "economics", yesPrice: 0.12, closesIn: 365, imageUrl: `${W}/0/05/Ethereum_logo_2014.svg/100px-Ethereum_logo_2014.svg.png` },
    { title: "Will the US enter a recession in 2025?",                        category: "economics", yesPrice: 0.31, closesIn: 200, imageUrl: P("recession", 210) },
    { title: "Will gas prices exceed $5/gallon nationally this summer?",      category: "economics", yesPrice: 0.38, closesIn: 90,  imageUrl: P("gas-station", 220) },
    { title: "Will Apple become the first $4 trillion company?",              category: "economics", yesPrice: 0.52, closesIn: 180, imageUrl: `${W}/f/fa/Apple_logo_black.svg/100px-Apple_logo_black.svg.png` },
    // Culture
    { title: "Will Taylor Swift release a new album in 2025?",                category: "culture",   yesPrice: 0.78, closesIn: 180, imageUrl: P("music-concert", 90) },
    { title: "Will a superhero movie win Best Picture at the Oscars?",        category: "culture",   yesPrice: 0.11, closesIn: 300, imageUrl: `${W}/6/66/OscarStatuette.jpg/100px-OscarStatuette.jpg` },
    { title: "Will streaming fully overtake cable TV in total viewership?",   category: "culture",   yesPrice: 0.87, closesIn: 365, imageUrl: P("streaming", 120) },
    { title: "Will a video game adaptation win a major Emmy award?",          category: "culture",   yesPrice: 0.39, closesIn: 200, imageUrl: P("television", 130) },
    { title: "Will GTA VI release in 2025?",                                  category: "culture",   yesPrice: 0.61, closesIn: 180, imageUrl: P("video-game", 110) },
    { title: "Will Kendrick Lamar headline a major festival this year?",      category: "culture",   yesPrice: 0.74, closesIn: 150, imageUrl: P("music-festival", 100) },
    { title: "Will a social media platform surpass Instagram in US users?",   category: "culture",   yesPrice: 0.17, closesIn: 365, imageUrl: `${W}/e/e7/Instagram_logo_2016.svg/100px-Instagram_logo_2016.svg.png` },
    { title: "Will a non-English film win Best Picture at the Oscars?",       category: "culture",   yesPrice: 0.26, closesIn: 300, imageUrl: P("cinema", 150) },
    { title: "Will the NBA have a record-breaking viewership game this season?",category:"culture",  yesPrice: 0.33, closesIn: 90,  imageUrl: P("basketball", 160) },
    { title: "Will there be a major Marvel and DC crossover announced?",      category: "culture",   yesPrice: 0.09, closesIn: 365, imageUrl: P("superhero", 140) },
    // Climate
    { title: "Will 2025 be the hottest year on record?",                      category: "climate",   yesPrice: 0.73, closesIn: 200, imageUrl: P("heatwave", 70) },
    { title: "Will California face a major wildfire emergency this summer?",  category: "climate",   yesPrice: 0.81, closesIn: 120, imageUrl: P("wildfire", 10) },
    { title: "Will the US pass new federal clean energy legislation?",        category: "climate",   yesPrice: 0.29, closesIn: 300, imageUrl: P("wind-turbine", 80) },
    { title: "Will a major Arctic ice record be broken this year?",           category: "climate",   yesPrice: 0.65, closesIn: 180, imageUrl: P("arctic-ice", 30) },
    { title: "Will a Category 5 hurricane hit the US mainland in 2025?",     category: "climate",   yesPrice: 0.42, closesIn: 150, imageUrl: `${W}/1/10/Hurricane_Isabel_from_ISS.jpg/100px-Hurricane_Isabel_from_ISS.jpg` },
    { title: "Will global CO2 emissions peak before 2030?",                   category: "climate",   yesPrice: 0.54, closesIn: 365, imageUrl: P("air-pollution", 50) },
    { title: "Will a major city announce a full single-use plastic ban?",     category: "climate",   yesPrice: 0.67, closesIn: 180, imageUrl: P("ocean-plastic", 60) },
    { title: "Will the Amazon rainforest lose record acreage this year?",     category: "climate",   yesPrice: 0.48, closesIn: 200, imageUrl: P("rainforest", 40) },
    { title: "Will solar energy surpass natural gas in US power generation?", category: "climate",   yesPrice: 0.22, closesIn: 365, imageUrl: P("solar-energy", 20) },
    { title: "Will a major world city declare a climate emergency in 2025?",  category: "climate",   yesPrice: 0.57, closesIn: 180, imageUrl: P("city", 310) },
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
          imageUrl: "imageUrl" in m ? m.imageUrl : null,
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

  const [patchMsg, setPatchMsg] = useState("");
  const [patching, setPatching] = useState(false);

  const pickImage = (title: string, category: string): string => {
    const t = title.toLowerCase();
    const wc = "https://upload.wikimedia.org/wikipedia/commons/thumb";
    const we = "https://upload.wikimedia.org/wikipedia/en/thumb";
    // loremflickr: real Flickr photos selected by keyword + consistent lock number
    const lf = (kw: string, lock: number) => `https://loremflickr.com/100/100/${kw}?lock=${lock}`;

    // Specific logos from Wikipedia (always correct)
    if (t.includes("bitcoin"))                                      return `${wc}/4/46/Bitcoin.svg/100px-Bitcoin.svg.png`;
    if (t.includes("ethereum"))                                     return `${wc}/0/05/Ethereum_logo_2014.svg/100px-Ethereum_logo_2014.svg.png`;
    if (t.includes("apple"))                                        return `${wc}/f/fa/Apple_logo_black.svg/100px-Apple_logo_black.svg.png`;
    if (t.includes("instagram"))                                    return `${wc}/e/e7/Instagram_logo_2016.svg/100px-Instagram_logo_2016.svg.png`;
    if (t.includes("oscar") || t.includes("best picture"))          return `${wc}/6/66/OscarStatuette.jpg/100px-OscarStatuette.jpg`;
    if (t.includes("hurricane"))                                    return `${wc}/1/10/Hurricane_Isabel_from_ISS.jpg/100px-Hurricane_Isabel_from_ISS.jpg`;
    if (t.includes("congress") || t.includes("senate") || t.includes("budget") || t.includes("capitol")) return `${wc}/4/4f/US_Capitol_west_side.JPG/100px-US_Capitol_west_side.JPG`;
    if (t.includes("federal reserve") || t.includes("fed cut") || t.includes("fed rate") || t.includes("interest rate")) return `${wc}/b/be/Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg/100px-Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg`;
    if (t.includes("yankee"))                                       return `${wc}/f/f0/New_York_Yankees_Primary_Logo.svg/100px-New_York_Yankees_Primary_Logo.svg.png`;
    if (t.includes("nba") || t.includes("lebron"))                  return `${we}/0/03/National_Basketball_Association_logo.svg/100px-National_Basketball_Association_logo.svg.png`;

    // Real topic photos via loremflickr (keyword-matched Flickr images)
    if (t.includes("wildfire") || t.includes("wildfire"))           return lf("wildfire", 10);
    if (t.includes("solar"))                                        return lf("solar-energy", 20);
    if (t.includes("arctic") || t.includes("ice record"))          return lf("arctic-ice", 30);
    if (t.includes("amazon") || t.includes("rainforest"))          return lf("rainforest", 40);
    if (t.includes("co2") || t.includes("emission") || t.includes("carbon")) return lf("air-pollution", 50);
    if (t.includes("plastic") || t.includes("ocean"))              return lf("ocean-plastic", 60);
    if (t.includes("heat") || t.includes("hottest"))               return lf("heatwave", 70);
    if (t.includes("wind turbine") || t.includes("clean energy") || t.includes("wind"))  return lf("wind-turbine", 80);
    if (t.includes("taylor swift") || t.includes("album"))         return lf("music-concert", 90);
    if (t.includes("kendrick") || t.includes("festival"))          return lf("music-festival", 100);
    if (t.includes("gta") || t.includes("video game") || t.includes("gaming")) return lf("video-game", 110);
    if (t.includes("stream"))                                       return lf("streaming", 120);
    if (t.includes("emmy"))                                         return lf("television", 130);
    if (t.includes("superhero") || t.includes("marvel") || t.includes(" dc ")) return lf("superhero", 140);
    if (t.includes("film") || t.includes("cinema") || t.includes("non-english")) return lf("cinema", 150);
    if (t.includes("nba") || t.includes("basketball") || t.includes("viewership")) return lf("basketball", 160);
    if (t.includes("inflation") || t.includes("dollar") || t.includes("currency")) return lf("currency", 170);
    if (t.includes("bank"))                                         return lf("bank", 180);
    if (t.includes("s&p") || t.includes("stock market") || t.includes("wall street") || t.includes("all-time high")) return lf("stock-market", 190);
    if (t.includes("unemploy"))                                     return lf("unemployment", 200);
    if (t.includes("recession"))                                    return lf("recession", 210);
    if (t.includes("gas price") || t.includes("gallon"))           return lf("gas-station", 220);
    if (t.includes("trillion"))                                     return lf("technology", 230);
    if (t.includes("snow") || t.includes("cancel class"))          return lf("snowstorm", 240);
    if (t.includes("vegan") || t.includes("cafeteria"))            return lf("salad", 250);
    if (t.includes("election") || t.includes("vote") || t.includes("turnout")) return lf("election", 260);
    if (t.includes("soccer") || t.includes("usmnt") || t.includes("world cup")) return lf("soccer", 270);
    if (t.includes("world series") || t.includes("baseball"))      return lf("baseball", 280);
    if (t.includes("retire") || t.includes("lebron"))              return lf("basketball", 290);
    if (t.includes("third-party") || t.includes("third party") || t.includes("electoral")) return lf("politics", 300);
    if (t.includes("city") || t.includes("climate emergency"))     return lf("city", 310);

    // Category fallbacks with real relevant photos
    const fallbacks: Record<string, string> = {
      ccny:      lf("college-campus", 1),
      sports:    lf("sports", 2),
      politics:  lf("politics", 3),
      economics: lf("finance", 4),
      culture:   lf("culture", 5),
      climate:   lf("climate", 6),
    };
    return fallbacks[category] ?? lf("market", 7);
  };

  const clearMarketImages = async (): Promise<void> => {
    setPatching(true);
    setPatchMsg("");
    try {
      const snap = await getDocs(query(collection(db, "markets"), orderBy("createdAt", "desc")));
      for (const d of snap.docs) {
        await updateDoc(doc(db, "markets", d.id), { imageUrl: null });
      }
      setPatchMsg(`✓ Cleared images from ${snap.size} markets — emojis restored.`);
      await loadMarkets();
    } catch (e) {
      setPatchMsg((e as Error).message || "Clear failed.");
    } finally {
      setPatching(false);
    }
  };

  const patchMarketImages = async (): Promise<void> => {
    setPatching(true);
    setPatchMsg("");
    try {
      const snap = await getDocs(query(collection(db, "markets"), orderBy("createdAt", "desc")));
      let count = 0;
      for (const d of snap.docs) {
        const data = d.data();
        const img = pickImage(String(data.title || ""), String(data.category || ""));
        await updateDoc(doc(db, "markets", d.id), { imageUrl: img });
        count++;
      }
      setPatchMsg(`✓ Updated ${count} market${count !== 1 ? "s" : ""} with images!`);
      await loadMarkets();
    } catch (e) {
      setPatchMsg((e as Error).message || "Patch failed.");
    } finally {
      setPatching(false);
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
          <div className="admin-section-title">Update Market Images</div>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", margin: "0 0 14px" }}>
            Scans all existing markets without an image and assigns one based on the title.
          </p>
          <button
            type="button"
            className="admin-submit-btn"
            disabled={patching}
            onClick={() => void patchMarketImages()}
          >
            {patching ? "Updating images…" : "🖼️ Update all market images"}
          </button>
          <button
            type="button"
            className="admin-submit-btn"
            disabled={patching}
            style={{ marginTop: 8, background: "rgba(255,255,255,0.06)" }}
            onClick={() => void clearMarketImages()}
          >
            🔄 Clear all images (restore emojis)
          </button>
          {patchMsg ? (
            <div className={"admin-msg" + (patchMsg.startsWith("✓") ? " success" : " error")} style={{ marginTop: 10 }}>
              {patchMsg}
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
