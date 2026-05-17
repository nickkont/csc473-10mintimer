import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import { deleteMe, getMe, getMyTransactions, updateMe } from "../api/users";
import { deposit as apiDeposit } from "../api/wallet";
import { loginWithRedirect } from "../lib/siteUrls";
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
  const navigate = useNavigate();
  const { uid: paramUid } = useParams<{ uid?: string }>();
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
      navigate(loginWithRedirect(paramUid ? `/account/${paramUid}` : "/account"), { replace: true });
      return;
    }
    // If we landed on bare /account, redirect to canonical /account/<uid> URL.
    if (!paramUid) {
      navigate(`/account/${user.uid}`, { replace: true });
      return;
    }
    // If the URL uid doesn't match the signed-in user, redirect to the signed-in user's account.
    if (paramUid !== user.uid) {
      navigate(`/account/${user.uid}`, { replace: true });
    }
  }, [loading, user, navigate, paramUid]);

  const loadWallet = useCallback(async (): Promise<void> => {
    const [me, txs] = await Promise.all([getMe(), getMyTransactions(10)]);
    const bal = typeof me.walletBalance === "number" ? me.walletBalance : 0;
    setWalletBalance("$" + bal.toFixed(2));
    if (txs.length === 0) {
      setTxRows(<p className="tx-empty">No transactions yet.</p>);
      return;
    }
    setTxRows(
      txs.map((tx) => {
        const sign = (tx.amount ?? 0) >= 0 ? "+" : "";
        const cls = (tx.amount ?? 0) >= 0 ? "tx-credit" : "tx-debit";
        const date = tx.timestamp ? new Date(tx.timestamp.seconds * 1000).toLocaleDateString() : "—";
        return (
          <div key={tx.id} className="tx-row">
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
      const me = await getMe();
      const p: ProfileData = {
        firstName: String(me.firstName ?? ""),
        lastName: String(me.lastName ?? ""),
        username: String(me.username ?? ""),
        phone: String((me as Record<string, unknown>).phone ?? ""),
        dob: String((me as Record<string, unknown>).dob ?? ""),
        timezone: String((me as Record<string, unknown>).timezone ?? "ET"),
        language: String((me as Record<string, unknown>).language ?? "en"),
        bio: String(me.bio ?? ""),
      };
      setProfile(p);
      setSnapshot(p);
      await loadWallet();
    })();
  }, [user, loadWallet]);

  const saveProfile = (): void => {
    if (!user) return;
    setProfileMsg("Saving…");
    setProfileErr(false);
    void updateMe(profile as unknown as Parameters<typeof updateMe>[0])
      .then(() => {
        setSnapshot(profile);
        setProfileMsg("Profile saved.");
        setProfileErr(false);
      })
      .catch((e) => {
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        setProfileMsg(err.response?.data?.error ?? err.message ?? "Could not save profile.");
        setProfileErr(true);
      });
  };

  const cancelProfile = (): void => {
    if (snapshot) setProfile({ ...snapshot });
    setProfileMsg("");
  };

  const addFunds = (): void => {
    if (!user) return;
    void (async () => {
      try {
        const { newBalance } = await apiDeposit(10, "Demo");
        setWalletBalance("$" + newBalance.toFixed(2));
        await loadWallet();
      } catch {
        // swallow; UI feedback would land here
      }
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
      .then(() => deleteMe())
      .then(() => {
        navigate("/", { replace: true });
      })
      .catch((e) => {
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        setDeleteMsg(err.response?.data?.error ?? err.message ?? "Could not delete account.");
      });
  };

  const segClass = (i: number): string => {
    if (sm.score <= 0) return "seg";
    const cls = sm.score <= 1 ? "weak" : sm.score <= 2 ? "medium" : "strong";
    return "seg " + (i < sm.score ? cls : "");
  };

  if (loading || !user) {
    return (
      <AppLayout>
        <div className="page container">
          <p className="markets-loading">Loading…</p>
        </div>
      </AppLayout>
    );
  }

  const avatarInitials = (() => {
    const f = profile.firstName?.[0] ?? "";
    const l = profile.lastName?.[0] ?? "";
    if (f || l) return (f + l).toUpperCase();
    return user?.email?.[0].toUpperCase() ?? "?";
  })();

  const displayName =
    (profile.firstName || profile.lastName)
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : profile.username || user?.email?.split("@")[0] || "Your Account";

  return (
    <AppLayout>
      <div className="page">
        <div className="container">
          <div className="profile-hero">
            <div className="profile-hero-left">
              <div className="profile-hero-avatar">{avatarInitials}</div>
              <div className="profile-hero-info">
                <div className="profile-hero-eyebrow">
                  <span className="profile-hero-dot" />
                  Account Settings
                </div>
                <div className="profile-hero-name">{displayName}</div>
                <div className="profile-hero-email">{user?.email}</div>
              </div>
            </div>
            <div className="profile-hero-balance">
              <div className="profile-hero-balance-label">Available Balance</div>
              <div className="profile-hero-balance-amt">{walletBalance}</div>
              <Link to="/wallet" className="profile-hero-wallet-link">Open wallet →</Link>
            </div>
          </div>

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
                <Link to="/wallet" className="wallet-redirect-link">
                  Open wallet dashboard →
                </Link>
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
    </AppLayout>
  );
}
