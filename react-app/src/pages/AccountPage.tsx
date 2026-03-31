import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import { auth, db } from "../firebase";
import { loginWithRedirect, siteHomeHref, siteRootPage } from "../lib/siteUrls";
import "../../../styles.css";
import "../../../account.css";

interface ProfileData {
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
  dob: string;
  timezone: string;
  language: string;
  bio: string;
}

const emptyProfile: ProfileData = {
  firstName: "",
  lastName: "",
  username: "",
  phone: "",
  dob: "",
  timezone: "ET",
  language: "en",
  bio: "",
};

function strength(val: string): { label: string; score: number } {
  if (!val) return { label: "—", score: 0 };
  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const labels = ["", "Weak", "Fair", "Strong", "Very Strong"];
  return { label: labels[score] || "—", score };
}

export default function AccountPage(): JSX.Element {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [email, setEmail] = useState("");
  const [snapshot, setSnapshot] = useState<ProfileData | null>(null);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState(false);
  const [walletBalance, setWalletBalance] = useState("—");
  const [txRows, setTxRows] = useState<React.ReactNode>(null);
  const [pw, setPw] = useState("");
  const sm = strength(pw);
  const [deleteStep, setDeleteStep] = useState(false);
  const [deletePwd, setDeletePwd] = useState("");
  const [deleteMsg, setDeleteMsg] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = loginWithRedirect("/account");
    }
  }, [loading, user]);

  const loadWallet = useCallback(async (uid: string): Promise<void> => {
    const uref = doc(db, "users", uid);
    const snap = await getDoc(uref);
    const data = snap.exists() ? snap.data() : {};
    const bal = typeof data.walletBalance === "number" ? data.walletBalance : 0;
    setWalletBalance("$" + bal.toFixed(2));

    const txSnap = await getDocs(
      query(collection(db, "users", uid, "transactions"), orderBy("timestamp", "desc"), limit(10))
    );
    if (txSnap.empty) {
      setTxRows(<p className="tx-empty">No transactions yet.</p>);
      return;
    }
    setTxRows(
      txSnap.docs.map((d) => {
        const tx = d.data() as { amount?: number; description?: string; timestamp?: { seconds: number } };
        const sign = (tx.amount ?? 0) >= 0 ? "+" : "";
        const cls = (tx.amount ?? 0) >= 0 ? "tx-credit" : "tx-debit";
        const date = tx.timestamp ? new Date(tx.timestamp.seconds * 1000).toLocaleDateString() : "—";
        return (
          <div key={d.id} className="tx-row">
            <div className="tx-left">
              <div className="tx-desc">{tx.description}</div>
              <div className="tx-date">{date}</div>
            </div>
            <div className={"tx-amount " + cls}>
              {sign}${Math.abs(tx.amount ?? 0).toFixed(2)}
            </div>
          </div>
        );
      })
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "");
    void (async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.exists() ? (snap.data() as Partial<ProfileData>) : {};
      const p: ProfileData = {
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        username: data.username ?? "",
        phone: data.phone ?? "",
        dob: data.dob ?? "",
        timezone: data.timezone ?? "ET",
        language: data.language ?? "en",
        bio: data.bio ?? "",
      };
      setProfile(p);
      setSnapshot(p);
      await loadWallet(user.uid);
    })();
  }, [user, loadWallet]);

  const saveProfile = (): void => {
    if (!user) return;
    setProfileMsg("Saving…");
    setProfileErr(false);
    void setDoc(doc(db, "users", user.uid), profile, { merge: true })
      .then(() => {
        setSnapshot(profile);
        setProfileMsg("Profile saved.");
        setProfileErr(false);
      })
      .catch((e) => {
        setProfileMsg((e as Error).message || "Could not save profile.");
        setProfileErr(true);
      });
  };

  const cancelProfile = (): void => {
    if (snapshot) setProfile({ ...snapshot });
    setProfileMsg("");
  };

  const addFunds = (): void => {
    if (!user) return;
    const uid = user.uid;
    const userRef = doc(db, "users", uid);
    const amount = 10;
    void (async () => {
      const docSnap = await getDoc(userRef);
      const current = docSnap.exists() ? Number(docSnap.data().walletBalance) || 0 : 0;
      const newBalance = current + amount;
      const batch = writeBatch(db);
      batch.update(userRef, { walletBalance: newBalance });
      const txRef = doc(collection(db, "users", uid, "transactions"));
      batch.set(txRef, {
        type: "deposit",
        amount,
        description: "Demo deposit",
        balance: newBalance,
        timestamp: serverTimestamp(),
      });
      await batch.commit();
      setWalletBalance("$" + newBalance.toFixed(2));
      await loadWallet(uid);
    })();
  };

  const confirmDelete = (): void => {
    if (!user) return;
    if (!deleteStep) {
      setDeleteStep(true);
      return;
    }
    if (!deletePwd) {
      setDeleteMsg("Enter your password to confirm.");
      return;
    }
    const cred = EmailAuthProvider.credential(user.email || "", deletePwd);
    void reauthenticateWithCredential(user, cred)
      .then(() => deleteDoc(doc(db, "users", user.uid)))
      .then(() => deleteUser(user))
      .then(() => {
        window.location.href = "../index.html";
      })
      .catch((e) => {
        setDeleteMsg((e as Error).message || "Could not delete account.");
      });
  };

  const segClass = (i: number): string => {
    if (sm.score <= 0) return "seg";
    const cls = sm.score <= 1 ? "weak" : sm.score <= 2 ? "medium" : "strong";
    return "seg " + (i < sm.score ? cls : "");
  };

  if (loading || !user) {
    return (
      <AppLayout active="account">
        <div className="page container">
          <p className="markets-loading">Loading…</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout active="account">
      <div className="page">
        <div className="container">
          <div className="page-title">Account Settings</div>

          <div className="section">
            <div className="section-head">Profile</div>
            <div className="section-body">
              <div className="row">
                <div className="field">
                  <label>First Name</label>
                  <input
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div className="field">
                  <label>Last Name</label>
                  <input
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="row">
                <div className="field">
                  <label>Username</label>
                  <input
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                    placeholder="username"
                  />
                </div>
                <div className="field">
                  <label>
                    Email <span className="lock"> from Firebase Auth</span>
                  </label>
                  <input type="email" value={email} disabled placeholder="Sign in to see email" readOnly />
                </div>
              </div>
              <div className="row">
                <div className="field">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="(optional)"
                  />
                </div>
                <div className="field">
                  <label>Date of Birth</label>
                  <input type="date" value={profile.dob} onChange={(e) => setProfile({ ...profile, dob: e.target.value })} />
                </div>
              </div>
              <div className="row">
                <div className="field">
                  <label>Timezone</label>
                  <select value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}>
                    <option value="ET">Eastern Time (ET)</option>
                    <option value="CT">Central Time (CT)</option>
                    <option value="PT">Pacific Time (PT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div className="field">
                  <label>Language</label>
                  <select value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })}>
                    <option value="en">English (US)</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Bio</label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Tell us a sentence about yourself (optional)"
                />
              </div>
              <div className="save-row">
                <button type="button" className="btn-ghost" onClick={cancelProfile}>
                  Cancel
                </button>
                <button type="button" className="btn-save" onClick={saveProfile}>
                  Save Profile
                </button>
              </div>
              {profileMsg ? (
                <div className={"auth-message-inline show " + (profileErr ? "error" : "success")}>{profileMsg}</div>
              ) : null}
            </div>
          </div>

          <div className="section">
            <div className="section-head">Wallet</div>
            <div className="section-body">
              <p className="wallet-redirect-note">
                <a href={siteRootPage("wallet.html")} className="wallet-redirect-link">
                  Open wallet dashboard →
                </a>
                <span className="wallet-redirect-hint">Deposits, withdrawals, and full activity</span>
              </p>
              <div className="wallet-header">
                <div className="wallet-balance-block">
                  <div className="wallet-balance-label">Available Balance</div>
                  <div className="wallet-balance-amount">{walletBalance}</div>
                </div>
                <button type="button" className="btn-save" onClick={addFunds}>
                  + Add $10 (Demo)
                </button>
              </div>
              <div className="wallet-transactions-wrap">
                <div className="wallet-tx-title">Recent Transactions</div>
                <div id="wallet-transactions">{txRows}</div>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-head">Security</div>
            <div className="section-body">
              <div className="field">
                <label>Current Password</label>
                <input type="password" placeholder="Enter current password" />
              </div>
              <div className="row">
                <div className="field">
                  <label>New Password</label>
                  <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" />
                  <div className="strength">
                    <div className={segClass(0)} id="s1" />
                    <div className={segClass(1)} id="s2" />
                    <div className={segClass(2)} id="s3" />
                    <div className={segClass(3)} id="s4" />
                  </div>
                  <div className="s-hint">{sm.label}</div>
                </div>
                <div className="field">
                  <label>Confirm Password</label>
                  <input type="password" placeholder="Confirm new password" />
                </div>
              </div>
              <div className="save-row">
                <button type="button" className="btn-ghost">
                  Cancel
                </button>
                <button type="button" className="btn-save">
                  Update Security
                </button>
              </div>
            </div>
          </div>

          <div className="section section-danger">
            <div className="section-head">Delete account</div>
            <div className="section-body">
              <p className="danger-text">
                Permanently delete your Eventra account and all associated data. This cannot be undone.
              </p>
              {deleteStep ? (
                <div className="field" id="delete-reauth-wrap">
                  <label>Confirm your password</label>
                  <input
                    type="password"
                    value={deletePwd}
                    onChange={(e) => setDeletePwd(e.target.value)}
                    placeholder="Enter password to confirm"
                  />
                </div>
              ) : null}
              <div className="save-row">
                {deleteStep ? (
                  <button type="button" className="btn-ghost" onClick={() => setDeleteStep(false)}>
                    Cancel
                  </button>
                ) : null}
                <button type="button" className="btn-danger" onClick={confirmDelete}>
                  {deleteStep ? "Confirm delete" : "Delete my account"}
                </button>
              </div>
              {deleteMsg ? <div className="auth-message-inline show error">{deleteMsg}</div> : null}
            </div>
          </div>
        </div>
      </div>

      <footer>Eventra · Account</footer>
    </AppLayout>
  );
}
