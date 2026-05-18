import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import { auth, db } from "../firebase";
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
      await setDoc(doc(db, "users", cred.user.uid), {
        email,
        displayName: name,
        walletBalance: 0,
        role: "user",
        createdAt: serverTimestamp(),
      });
      navigate("/events", { replace: true });
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
        </div>
      </main>
    </>
  );
}
