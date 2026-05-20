import { createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { createMe } from "../api/users";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase";
import "../../../styles.css";
import "../../../auth.css";

export default function SignupPage(): JSX.Element {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/events", { replace: true });
  }, [loading, user, navigate]);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const name = displayName.trim() || email.split("@")[0];
      await updateProfile(cred.user, { displayName: name });
      await createMe({ email, displayName: name });
      // New users start pending. Sign them out so AuthContext doesn't redirect
      // them into the app while we show the pending-approval message.
      await signOut(auth);
      setPendingApproval(true);
    } catch (err) {
      setMsg((err as Error).message || "Sign up failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="bg-glow bg-glow-1" aria-hidden="true" />
      <div className="bg-glow bg-glow-2" aria-hidden="true" />
      <SiteHeader />
      <main
        className="auth-main"
        style={{ minHeight: "calc(100vh - 64px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}
      >
        <div className="auth-card">
          {pendingApproval ? (
            <>
              <h1>Account pending approval</h1>
              <p className="sub">
                Thanks for signing up. An admin needs to approve your account before you can log in.
                You'll be able to sign in once that's done.
              </p>
              <p className="auth-footer" style={{ marginTop: 24 }}>
                <Link to="/login">Back to log in</Link>
              </p>
            </>
          ) : (
          <>
          <h1>Create account</h1>
          <p className="sub">Sign up to trade contracts and manage your account.</p>
          <form className="auth-form" onSubmit={(e) => void submit(e)} noValidate>
            <div className="field">
              <label htmlFor="signup-name">Display name</label>
              <input
                type="text"
                id="signup-name"
                autoComplete="name"
                placeholder="Jordan"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="signup-email">Email</label>
              <input
                type="email"
                id="signup-email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="signup-password">Password</label>
              <input
                type="password"
                id="signup-password"
                required
                autoComplete="new-password"
                placeholder="At least 6 characters"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-submit" disabled={busy}>
              {busy ? "Creating account…" : "Sign up"}
            </button>
          </form>
          {msg ? <div className="auth-message show error" role="alert">{msg}</div> : null}
          <p className="auth-footer">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
          </>
          )}
        </div>
      </main>
    </>
  );
}
