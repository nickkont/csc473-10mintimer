import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import "../../../styles.css";

export default function ClaimAdminPage(): JSX.Element {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  const claim = async (): Promise<void> => {
    if (!user) { setMsg("You must be logged in first."); return; }
    try {
      await setDoc(doc(db, "users", user.uid), { role: "admin" }, { merge: true });
      setDone(true);
      setMsg("Done! You are now an admin. Redirecting…");
      setTimeout(() => navigate("/admin"), 1500);
    } catch (e) {
      setMsg((e as Error).message || "Failed — check Firestore rules.");
    }
  };

  return (
    <>
      <SiteHeader />
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: "0 24px" }}>
          <div style={{ fontSize: "2rem", marginBottom: 16 }}>🔑</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>Claim Admin</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", marginBottom: 24 }}>
            {loading ? "Loading…" : user ? `Logged in as ${user.email}` : "Not logged in"}
          </p>
          {!done && (
            <button
              onClick={() => void claim()}
              disabled={!user || loading}
              style={{
                padding: "12px 32px", background: "#a78bfa", color: "#000",
                fontWeight: 800, fontSize: "0.95rem", border: "none",
                borderRadius: 10, cursor: "pointer",
              }}
            >
              Make me admin
            </button>
          )}
          {msg && (
            <p style={{ marginTop: 16, color: done ? "#4ade80" : "#f87171", fontSize: "0.9rem" }}>
              {msg}
            </p>
          )}
        </div>
      </main>
    </>
  );
}
