import { collection, getDocs, orderBy, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import {
  clearMarketImages as clearMarketImagesApi,
  createMarket as createMarketApi,
  deleteMarket as deleteMarketApi,
  patchMarketImages as patchMarketImagesApi,
  resolveMarket as resolveMarketApi,
  seedDemoMarkets as seedDemoMarketsApi,
} from "../api/markets";
import {
  AdminUserRow,
  approveUser as approveUserApi,
  banUser as banUserApi,
  listUsers,
  setUserRole as setUserRoleApi,
  unapproveUser as unapproveUserApi,
  unbanUser as unbanUserApi,
} from "../api/users";
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

  // Users
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userFilter, setUserFilter] = useState<"all" | "pending" | "admins" | "banned">("all");
  const [userBusy, setUserBusy] = useState<string | null>(null);

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

  const loadUsers = async (): Promise<void> => {
    setUsersLoading(true);
    try {
      const list = await listUsers();
      setUsers(list);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (user && role === "admin") {
      void loadMarkets();
      void loadUsers();
    }
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
      await createMarketApi({
        title: title.trim(),
        category,
        imageUrl: imageUrl.trim() || null,
        closesAt: new Date(closesAt).toISOString(),
        yesPrice: yp,
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
      const result = await seedDemoMarketsApi();
      setSeedMsg(`Added ${result.added} demo markets.`);
      await loadMarkets();
    } catch (err) { setSeedMsg((err as Error).message || "Seed failed."); }
    finally { setSeeding(false); }
  };

  const patchMarketImages = async (): Promise<void> => {
    setPatching(true); setPatchMsg("");
    try {
      const result = await patchMarketImagesApi();
      setPatchMsg(`Updated ${result.updated} markets with images.`);
      await loadMarkets();
    } catch (err) { setPatchMsg((err as Error).message || "Patch failed."); }
    finally { setPatching(false); }
  };

  const clearMarketImages = async (): Promise<void> => {
    setPatching(true); setPatchMsg("");
    try {
      const result = await clearMarketImagesApi();
      setPatchMsg(`Cleared images from ${result.cleared} markets.`);
      await loadMarkets();
    } catch (err) { setPatchMsg((err as Error).message || "Clear failed."); }
    finally { setPatching(false); }
  };

  const resolveMarket = async (id: string, outcome: "yes" | "no"): Promise<void> => {
    await resolveMarketApi(id, outcome);
    await loadMarkets();
  };

  const deleteMarket = async (id: string): Promise<void> => {
    if (!confirm("Delete this market? This cannot be undone.")) return;
    await deleteMarketApi(id);
    await loadMarkets();
  };

  const toggleBan = async (target: AdminUserRow): Promise<void> => {
    if (target.uid === user?.uid) { alert("You can't ban yourself."); return; }
    const action = target.banned ? "unban" : "ban";
    if (!confirm(`Are you sure you want to ${action} ${target.displayName || target.email || target.uid}?`)) return;
    setUserBusy(target.uid);
    try {
      if (target.banned) await unbanUserApi(target.uid);
      else await banUserApi(target.uid);
      await loadUsers();
    } catch (err) {
      alert((err as Error).message || `${action} failed.`);
    } finally {
      setUserBusy(null);
    }
  };

  const toggleRole = async (target: AdminUserRow): Promise<void> => {
    if (target.uid === user?.uid && target.role === "admin") {
      alert("You can't demote yourself.");
      return;
    }
    const nextRole = target.role === "admin" ? "user" : "admin";
    if (!confirm(`Set ${target.displayName || target.email || target.uid} to ${nextRole.toUpperCase()}?`)) return;
    setUserBusy(target.uid);
    try {
      await setUserRoleApi(target.uid, nextRole);
      await loadUsers();
    } catch (err) {
      alert((err as Error).message || "Role update failed.");
    } finally {
      setUserBusy(null);
    }
  };

  const toggleApproved = async (target: AdminUserRow): Promise<void> => {
    if (target.uid === user?.uid && target.approved) {
      alert("You can't unapprove yourself.");
      return;
    }
    setUserBusy(target.uid);
    try {
      if (target.approved) await unapproveUserApi(target.uid);
      else await approveUserApi(target.uid);
      await loadUsers();
    } catch (err) {
      alert((err as Error).message || "Update failed.");
    } finally {
      setUserBusy(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (userFilter === "pending") return !u.approved;
    if (userFilter === "admins") return u.role === "admin";
    if (userFilter === "banned") return u.banned;
    return true;
  });
  const adminCount = users.filter((u) => u.role === "admin").length;
  const bannedCount = users.filter((u) => u.banned).length;
  const pendingCount = users.filter((u) => !u.approved).length;

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
              <p className="admin-card-desc">Populate all categories with realistic sample markets.</p>
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

        {/* ── Users list ── */}
        <section className="admin-card admin-markets-section" aria-labelledby="users-heading" style={{ marginTop: 18 }}>
          <div className="admin-markets-head">
            <h2 className="admin-card-title" id="users-heading">
              Users
              <span className="admin-markets-count">{filteredUsers.length}</span>
            </h2>
            <div className="admin-filter-tabs" role="tablist">
              {([
                { key: "all" as const,     label: `All (${users.length})` },
                { key: "pending" as const, label: `Pending (${pendingCount})` },
                { key: "admins" as const,  label: `Admins (${adminCount})` },
                { key: "banned" as const,  label: `Banned (${bannedCount})` },
              ]).map((f) => (
                <button
                  key={f.key} type="button" role="tab"
                  className={"admin-filter-tab" + (userFilter === f.key ? " active" : "")}
                  onClick={() => setUserFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {usersLoading ? (
            <p className="admin-empty">Loading users…</p>
          ) : filteredUsers.length === 0 ? (
            <p className="admin-empty">No users match this filter.</p>
          ) : (
            <div className="admin-market-list">
              {filteredUsers.map((u) => {
                const initials = (u.displayName || u.email || u.uid)
                  .trim().split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "?";
                const isSelf = u.uid === user.uid;
                const busy = userBusy === u.uid;
                return (
                  <div key={u.uid} className={"admin-user-row" + (u.banned ? " banned" : "")}>
                    <div className={"admin-user-avatar" + (u.isBot ? " bot" : "")}>{initials}</div>
                    <div className="admin-user-body">
                      <div className="admin-user-top">
                        <span className="admin-user-name">{u.displayName || "(no name)"}</span>
                        {isSelf ? <span className="admin-role-badge admin">you</span> : null}
                        <span className={"admin-role-badge " + (u.isBot ? "bot" : u.role)}>
                          {u.isBot ? "bot" : u.role}
                        </span>
                        {!u.approved ? <span className="admin-role-badge banned">pending</span> : null}
                        {u.banned ? <span className="admin-role-badge banned">banned</span> : null}
                      </div>
                      <div className="admin-user-email">{u.email || u.uid}</div>
                      <div className="admin-user-meta">${u.walletBalance.toFixed(2)}</div>
                    </div>
                    <div className="admin-user-actions">
                      {!u.approved ? (
                        <button
                          type="button"
                          className="admin-user-btn promote"
                          disabled={busy}
                          onClick={() => void toggleApproved(u)}
                        >
                          {busy ? "…" : "Approve"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={"admin-user-btn " + (u.role === "admin" ? "" : "promote")}
                        disabled={busy || (isSelf && u.role === "admin")}
                        onClick={() => void toggleRole(u)}
                      >
                        {busy ? "…" : u.role === "admin" ? "Demote" : "Make admin"}
                      </button>
                      <button
                        type="button"
                        className={"admin-user-btn " + (u.banned ? "" : "ban")}
                        disabled={busy || isSelf}
                        onClick={() => void toggleBan(u)}
                      >
                        {busy ? "…" : u.banned ? "Unban" : "Ban"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </>
  );
}
