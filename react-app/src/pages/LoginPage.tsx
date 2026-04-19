import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase";
import "../../../styles.css";
import "../../../auth.css";

export default function LoginPage(): JSX.Element {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const redirect = params.get("redirect") || "/events";

  useEffect(() => {
    if (!loading && user) navigate(redirect, { replace: true });
  }, [loading, user, navigate, redirect]);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate(redirect, { replace: true });
    } catch (err) {
      setMsg((err as Error).message || "Login failed.");
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
          <h1>Log in</h1>
          <p className="sub">Sign in to your Eventra account.</p>
          <form className="auth-form" onSubmit={(e) => void submit(e)} noValidate>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                type="email"
                id="login-email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                type="password"
                id="login-password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-submit" disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>
          {msg ? <div className="auth-message show error" role="alert">{msg}</div> : null}
          <p className="auth-footer">
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </div>
      </main>
    </>
  );
}
