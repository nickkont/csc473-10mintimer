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
      await addDoc(collection(db, "markets"), {
        title: title.trim(),
        category,
        closesAt: Timestamp.fromDate(new Date(closesAt)),
        yesPrice: yp,
        noPrice: parseFloat((1 - yp).toFixed(2)),
        status: "open",
        totalTrades: 0,
        createdAt: serverTimestamp(),
      });
      setTitle("");
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
