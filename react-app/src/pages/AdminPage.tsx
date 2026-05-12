import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import {
  createMarket as apiCreateMarket,
  deleteMarket as apiDeleteMarket,
  listMarkets as apiListMarkets,
  resolveMarket as apiResolveMarket,
} from "../api/markets";
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
  const [resolving, setResolving] = useState<{ id: string; outcome: "yes" | "no" } | null>(null);
  const [resolveMsg, setResolveMsg] = useState<{ id: string; text: string; error: boolean } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate(`/login?redirect=${encodeURIComponent("/admin")}`, { replace: true }); return; }
    if (role !== "admin") navigate("/events", { replace: true });
  }, [loading, user, role, navigate]);

  const loadMarkets = async (): Promise<void> => {
    try {
      const list = await apiListMarkets();
      setMarkets(list as Market[]);
    } finally {
      setDataLoading(false);
    }
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
      await apiCreateMarket({
        title: title.trim(),
        category,
        closesAt,
        yesPrice: yp,
      });
      setTitle("");
      setClosesAt("");
      setYesPrice(0.5);
      setCreateMsg("Market created!");
      setCreateErr(false);
      await loadMarkets();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setCreateMsg(err.response?.data?.error ?? err.message ?? "Failed to create market.");
      setCreateErr(true);
    }
  };

  const resolveMarket = async (id: string, outcome: "yes" | "no"): Promise<void> => {
    if (resolving || deletingId) return;
    if (!confirm(`Resolve this market as ${outcome.toUpperCase()}? This cannot be undone.`)) return;
    setResolving({ id, outcome });
    setResolveMsg(null);
    try {
      await apiResolveMarket(id, outcome);
      setResolveMsg({ id, text: `Resolved as ${outcome.toUpperCase()}.`, error: false });
      await loadMarkets();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setResolveMsg({ id, text: err.response?.data?.error ?? err.message ?? "Failed to resolve market.", error: true });
    } finally {
      setResolving(null);
    }
  };

  const deleteMarket = async (id: string): Promise<void> => {
    if (resolving || deletingId) return;
    if (!confirm("Delete this market? This cannot be undone.")) return;
    setDeletingId(id);
    setResolveMsg(null);
    try {
      await apiDeleteMarket(id);
      await loadMarkets();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setResolveMsg({ id, text: err.response?.data?.error ?? err.message ?? "Failed to delete market.", error: true });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || !user || role !== "admin") {
    return (
      <div className="admin-loading-screen">Checking permissions…</div>
    );
  }

  return (
    <AppLayout>
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
              markets.map((m) => {
                const rowBusy = resolving?.id === m.id || deletingId === m.id;
                const resolvingYes = resolving?.id === m.id && resolving.outcome === "yes";
                const resolvingNo = resolving?.id === m.id && resolving.outcome === "no";
                const deleting = deletingId === m.id;
                const rowMsg = resolveMsg?.id === m.id ? resolveMsg : null;
                return (
                  <div key={m.id} className="admin-market-row">
                    <div className="admin-market-info">
                      <div className="admin-market-title">{m.title}</div>
                      <div className="admin-market-meta">
                        {m.category} · YES ${m.yesPrice.toFixed(2)} · NO ${m.noPrice.toFixed(2)} · {m.totalTrades} trades · Closes {closesLabel(m)}
                        {m.status === "resolved" ? (
                          <span className={"admin-outcome-badge " + m.outcome}> · {m.outcome?.toUpperCase()} wins</span>
                        ) : null}
                      </div>
                      {rowMsg ? (
                        <div className={"admin-msg" + (rowMsg.error ? " error" : " success")}>{rowMsg.text}</div>
                      ) : null}
                    </div>
                    <div className="admin-market-actions">
                      {m.status !== "resolved" ? (
                        <>
                          <button
                            type="button"
                            className="admin-resolve-btn yes"
                            disabled={rowBusy}
                            aria-busy={resolvingYes}
                            onClick={() => void resolveMarket(m.id, "yes")}
                          >
                            {resolvingYes ? "Resolving…" : "Resolve YES"}
                          </button>
                          <button
                            type="button"
                            className="admin-resolve-btn no"
                            disabled={rowBusy}
                            aria-busy={resolvingNo}
                            onClick={() => void resolveMarket(m.id, "no")}
                          >
                            {resolvingNo ? "Resolving…" : "Resolve NO"}
                          </button>
                        </>
                      ) : (
                        <span className="admin-resolved-label">Resolved</span>
                      )}
                      <button
                        type="button"
                        className="admin-delete-btn"
                        disabled={rowBusy}
                        aria-busy={deleting}
                        onClick={() => void deleteMarket(m.id)}
                      >
                        {deleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
