import {
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import "../../../styles.css";
import "../../../wallet.css";

interface Tx {
  id: string;
  type: string;
  amount: number;
  description: string;
  timestamp?: { seconds: number };
}

type TxFilter = "all" | "deposits" | "withdrawals" | "trades";

export default function WalletPage(): JSX.Element {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [cash, setCash] = useState(0);
  const [invested, setInvested] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [txFilter, setTxFilter] = useState<TxFilter>("all");
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [depositAmt, setDepositAmt] = useState("100");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank account •••4521");
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const fundPanelRef = useRef<HTMLElement>(null);
  const activityRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate(`/login?redirect=${encodeURIComponent("/wallet")}`, { replace: true });
  }, [loading, user, navigate]);

  const loadData = useCallback(async (): Promise<void> => {
    if (!user) return;
    setDataLoading(true);
    try {
      const [userSnap, posSnap, txSnap] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDocs(collection(db, "users", user.uid, "positions")),
        getDocs(query(collection(db, "users", user.uid, "transactions"), orderBy("timestamp", "desc"), limit(50))),
      ]);

      const walletBalance = userSnap.exists() ? Number(userSnap.data().walletBalance) || 0 : 0;
      setCash(walletBalance);

      let inv = 0;
      posSnap.forEach((d) => {
        const p = d.data();
        inv += (Number(p.yesShares) || 0) + (Number(p.noShares) || 0);
      });
      setInvested(parseFloat(inv.toFixed(2)));

      setTxs(
        txSnap.docs.map((d) => ({
          id: d.id,
          type: String(d.data().type || ""),
          amount: Number(d.data().amount || 0),
          description: String(d.data().description || ""),
          timestamp: d.data().timestamp,
        }))
      );
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) void loadData();
  }, [user, loadData]);

  const deposit = async (): Promise<void> => {
    if (!user) return;
    const amount = parseFloat(depositAmt);
    if (isNaN(amount) || amount <= 0) {
      setMsg("Enter a valid amount.");
      setMsgOk(false);
      return;
    }
    const uid = user.uid;
    const userRef = doc(db, "users", uid);
    try {
      const newBalance = await runTransaction(db, async (t) => {
        const snap = await t.get(userRef);
        const cur = snap.exists() ? Number(snap.data().walletBalance) || 0 : 0;
        const nb = parseFloat((cur + amount).toFixed(2));
        t.update(userRef, { walletBalance: nb });
        const txRef = doc(collection(db, "users", uid, "transactions"));
        t.set(txRef, {
          type: "deposit",
          amount,
          description: `Deposit via ${paymentMethod}`,
          balance: nb,
          timestamp: serverTimestamp(),
        });
        return nb;
      });
      setCash(newBalance);
      setMsg("Deposit successful!");
      setMsgOk(true);
      await loadData();
    } catch (e) {
      setMsg((e as Error).message || "Deposit failed.");
      setMsgOk(false);
    }
  };

  const withdraw = async (): Promise<void> => {
    if (!user) return;
    const amount = parseFloat(withdrawAmt);
    if (isNaN(amount) || amount <= 0) {
      setMsg("Enter a valid amount.");
      setMsgOk(false);
      return;
    }
    const uid = user.uid;
    const userRef = doc(db, "users", uid);
    try {
      const newBalance = await runTransaction(db, async (t) => {
        const snap = await t.get(userRef);
        const cur = snap.exists() ? Number(snap.data().walletBalance) || 0 : 0;
        if (amount > cur) throw new Error("Insufficient balance.");
        const nb = parseFloat((cur - amount).toFixed(2));
        t.update(userRef, { walletBalance: nb });
        const txRef = doc(collection(db, "users", uid, "transactions"));
        t.set(txRef, {
          type: "withdrawal",
          amount: -amount,
          description: "Withdrawal",
          balance: nb,
          timestamp: serverTimestamp(),
        });
        return nb;
      });
      setCash(newBalance);
      setWithdrawAmt("");
      setMsg("Withdrawal successful!");
      setMsgOk(true);
      await loadData();
    } catch (e) {
      setMsg((e as Error).message || "Withdrawal failed.");
      setMsgOk(false);
    }
  };

  const filteredTxs = txs.filter((tx) => {
    if (txFilter === "all") return true;
    if (txFilter === "deposits") return tx.type === "deposit";
    if (txFilter === "withdrawals") return tx.type === "withdrawal";
    if (txFilter === "trades") return tx.type === "trade";
    return true;
  });

  const total = parseFloat((cash + invested).toFixed(2));

  if (loading || (!user && !loading)) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="wallet-page">
      <div className="bg-glow bg-glow-1" aria-hidden="true" />
      <div className="bg-glow bg-glow-2" aria-hidden="true" />

      <SiteHeader />

      <div className="wallet-shell">
        <aside className="wallet-sidebar" aria-label="Wallet navigation">
          <div className="wallet-sidebar-group">
            <Link className="wallet-side-link" to="/account">Payment methods</Link>
            <Link className="wallet-side-link" to="/account">Settings</Link>
          </div>
        </aside>

        <main className="wallet-main" id="wallet-main">
          <header className="wallet-page-head">
            <h1 className="wallet-page-title">Wallet</h1>
            <p className="wallet-page-sub">Manage your balance, deposits, and withdrawals.</p>
          </header>

          <section className="wallet-stat-grid" aria-label="Balances">
            <article className="wallet-stat-card wallet-stat-card-hero">
              <div className="wallet-stat-label">Total balance</div>
              <div className="wallet-stat-value">{dataLoading ? "$—" : `$${total.toFixed(2)}`}</div>
            </article>
            <article className="wallet-stat-card">
              <div className="wallet-stat-label">Invested</div>
              <div className="wallet-stat-value wallet-stat-value-sm">{dataLoading ? "$—" : `$${invested.toFixed(2)}`}</div>
            </article>
            <article className="wallet-stat-card">
              <div className="wallet-stat-label">Available cash</div>
              <div className="wallet-stat-value wallet-stat-value-sm">{dataLoading ? "$—" : `$${cash.toFixed(2)}`}</div>
            </article>
            <article className="wallet-stat-card">
              <div className="wallet-stat-label">Pending</div>
              <div className="wallet-stat-value wallet-stat-value-sm">$0.00</div>
            </article>
          </section>

          <div className="wallet-panels">
            <section className="wallet-panel wallet-panel-funds" id="fund-panel" ref={fundPanelRef as React.RefObject<HTMLElement>} aria-labelledby="fund-heading">
              <h2 className="visually-hidden" id="fund-heading">Add or remove funds</h2>
              <div className="wallet-tabs" role="tablist">
                <button
                  type="button"
                  className={"wallet-tab" + (activeTab === "deposit" ? " wallet-tab-active" : "")}
                  role="tab"
                  aria-selected={activeTab === "deposit"}
                  onClick={() => setActiveTab("deposit")}
                >
                  Deposit
                </button>
                <button
                  type="button"
                  className={"wallet-tab" + (activeTab === "withdraw" ? " wallet-tab-active" : "")}
                  role="tab"
                  aria-selected={activeTab === "withdraw"}
                  onClick={() => setActiveTab("withdraw")}
                >
                  Withdraw
                </button>
              </div>

              {activeTab === "deposit" ? (
                <div className="wallet-tab-panel" role="tabpanel">
                  <label className="wallet-field-label" htmlFor="amount-input">Amount</label>
                  <div className="wallet-amount-wrap">
                    <span className="wallet-currency">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="wallet-amount-input"
                      id="amount-input"
                      placeholder="0.00"
                      autoComplete="off"
                      value={depositAmt}
                      onChange={(e) => setDepositAmt(e.target.value)}
                    />
                  </div>
                  <div className="wallet-chips">
                    {[25, 50, 100, 250].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className={"wallet-chip" + (depositAmt === String(amt) ? " wallet-chip-active" : "")}
                        onClick={() => setDepositAmt(String(amt))}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                  <label className="wallet-field-label" htmlFor="payment-select">Payment method</label>
                  <select
                    className="wallet-select"
                    id="payment-select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option>Bank account •••4521</option>
                    <option>Debit card •••8830</option>
                  </select>
                  <button type="button" className="wallet-btn-primary" onClick={() => void deposit()}>
                    Confirm deposit
                  </button>
                  <p className="wallet-panel-foot">Funds available instantly</p>
                </div>
              ) : (
                <div className="wallet-tab-panel" role="tabpanel">
                  <label className="wallet-field-label" htmlFor="withdraw-input">Amount</label>
                  <div className="wallet-amount-wrap">
                    <span className="wallet-currency">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="wallet-amount-input"
                      id="withdraw-input"
                      placeholder="0.00"
                      autoComplete="off"
                      value={withdrawAmt}
                      onChange={(e) => setWithdrawAmt(e.target.value)}
                    />
                  </div>
                  <button type="button" className="wallet-btn-primary wallet-btn-withdraw" onClick={() => void withdraw()}>
                    Confirm withdrawal
                  </button>
                  <p className="wallet-panel-foot">Withdrawals typically settle within 1–3 business days</p>
                </div>
              )}

              {msg ? (
                <div className={"wallet-inline-msg" + (msgOk ? "" : " error")} role="status">
                  {msg}
                </div>
              ) : null}
            </section>

            <section
              className="wallet-panel wallet-panel-activity"
              id="activity-panel"
              ref={activityRef as React.RefObject<HTMLElement>}
              aria-labelledby="activity-heading"
            >
              <div className="wallet-activity-head">
                <h2 className="wallet-activity-title" id="activity-heading">Recent activity</h2>
              </div>
              <div className="wallet-activity-filters">
                {(["all", "deposits", "withdrawals", "trades"] as TxFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={"wallet-filter-pill" + (txFilter === f ? " wallet-filter-active" : "")}
                    onClick={() => setTxFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <div className="wallet-table-wrap">
                <table className="wallet-table">
                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th className="wallet-th-amt">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataLoading ? (
                      <tr><td colSpan={4} className="wallet-tx-empty">Loading…</td></tr>
                    ) : filteredTxs.length === 0 ? (
                      <tr><td colSpan={4} className="wallet-tx-empty">No transactions yet.</td></tr>
                    ) : (
                      filteredTxs.map((tx) => {
                        const sign = tx.amount >= 0 ? "+" : "";
                        const cls = tx.amount >= 0 ? "tx-credit" : "tx-debit";
                        const date = tx.timestamp
                          ? new Date(tx.timestamp.seconds * 1000).toLocaleDateString()
                          : "—";
                        return (
                          <tr key={tx.id}>
                            <td>{tx.description}</td>
                            <td>{tx.type}</td>
                            <td>{date}</td>
                            <td className={"wallet-th-amt " + cls}>
                              {sign}${Math.abs(tx.amount).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>

      <footer className="wallet-footer">
        <span>Eventra · Wallet</span>
      </footer>
    </div>
  );
}
