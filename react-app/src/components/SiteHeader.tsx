import type { User } from "firebase/auth";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function initials(u: User | null): string {
  if (!u) return "?";
  if (u.displayName) {
    return u.displayName.trim().split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  }
  if (u.email) return u.email[0].toUpperCase();
  return "?";
}

export default function SiteHeader(): JSX.Element {
  const { user, role, balance, signOutApp } = useAuth();
  const loc = useLocation();
  const at = (path: string): boolean => loc.pathname === path;

  return (
    <header className="site-header">
      <nav className="nav container">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-text">Eventra</span>
        </Link>
        <div className="nav-actions">
          <Link className={"btn btn-ghost" + (at("/events") ? " active" : "")} to="/events">Markets</Link>
          <Link className={"btn btn-ghost" + (at("/wallet") ? " active" : "")} to="/wallet">Wallet</Link>
          <Link className={"btn btn-ghost" + (at("/social") ? " active" : "")} to="/social">Social</Link>
          {role === "admin" ? (
            <Link className={"btn btn-ghost" + (at("/admin") ? " active" : "")} to="/admin">Admin</Link>
          ) : null}
          {user ? (
            <>
              <Link to={`/profile/${user.uid}`} className="nav-user-chip" aria-label="Your profile">
                <span className="nav-balance">${balance.toFixed(2)}</span>
                <span className="nav-avatar-pill">{initials(user)}</span>
                <span className="nav-display-name">{user.displayName || ""}</span>
              </Link>
              <button type="button" className="btn btn-ghost" onClick={() => void signOutApp()}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login">Log in</Link>
              <Link className="btn btn-primary" to="/signup">Sign up</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
