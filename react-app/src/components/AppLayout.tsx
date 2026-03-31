import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { siteHomeHref, siteRootPage } from "../lib/siteUrls";

type NavKey = "events" | "social" | "account";

export default function AppLayout({
  active,
  children,
}: {
  active: NavKey;
  children: React.ReactNode;
}): JSX.Element {
  const { user, balance, role, signOutApp } = useAuth();
  const loc = useLocation();
  const path = loc.pathname.replace(/^\//, "") || "events";
  const is = (k: NavKey): boolean => (active ? active === k : path === k);

  function initials(u: typeof user): string {
    if (!u) return "?";
    if (u.displayName) {
      return u.displayName
        .trim()
        .split(/\s+/)
        .map((s) => s[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
    if (u.email) return u.email[0].toUpperCase();
    return "?";
  }

  return (
    <>
      <div className="bg-glow bg-glow-1" aria-hidden="true" />
      <div className="bg-glow bg-glow-2" aria-hidden="true" />
      <header className="site-header">
        <nav className="nav">
          <a className="brand" href={siteHomeHref()}>
            <span className="brand-mark" aria-hidden="true" />
            Eventra
          </a>
          <div className="nav-links">
            <Link to="/events" className={is("events") ? "active" : undefined}>
              Markets
            </Link>
            <Link to="/social" className={is("social") ? "active" : undefined}>
              Social
            </Link>
            <a href={siteRootPage("wallet.html")}>Wallet</a>
            <Link to="/account" className={is("account") ? "active" : undefined}>
              Account
            </Link>
          </div>
          <div className="nav-account">
            <a
              id="nav-admin-link"
              href={siteRootPage("admin.html")}
              className="btn-admin-pill"
              style={{ display: role === "admin" ? "inline-flex" : "none" }}
            >
              Admin
            </a>
            <span className="nav-bal" id="nav-balance">
              {user ? `$${balance.toFixed(2)}` : "—"}
            </span>
            <span className="user-email" id="nav-user-email">
              {user?.email ?? ""}
            </span>
            {user ? (
              <button type="button" className="btn-logout" id="btn-logout" onClick={() => void signOutApp()}>
                Log out
              </button>
            ) : null}
            <div className="avatar" id="nav-avatar">
              {initials(user)}
            </div>
          </div>
        </nav>
      </header>
      {children}
    </>
  );
}
