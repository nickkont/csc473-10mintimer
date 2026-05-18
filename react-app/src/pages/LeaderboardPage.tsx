import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import "../../../styles.css";
import "../../../leaderboard.css";

interface Leader {
  uid: string;
  displayName: string;
  email: string;
  walletBalance: number;
  role: string;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function initials(name: string, email: string): string {
  if (name) return name.trim().split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  if (email) return email[0].toUpperCase();
  return "?";
}

export default function LeaderboardPage(): JSX.Element {
  const { user } = useAuth();
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "users"), orderBy("walletBalance", "desc"), limit(20))
        );
        setLeaders(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              uid: d.id,
              displayName: String(data.displayName || ""),
              email: String(data.email || ""),
              walletBalance: Number(data.walletBalance) || 0,
              role: String(data.role || "user"),
            };
          })
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppLayout>
      <div className="lb-page">
        <div className="lb-container">
          <div className="lb-header">
            <h1 className="lb-title">Leaderboard</h1>
            <p className="lb-sub">Top traders ranked by wallet balance</p>
          </div>

          {loading ? (
            <p className="lb-loading">Loading…</p>
          ) : leaders.length === 0 ? (
            <p className="lb-loading">No traders yet. Be the first!</p>
          ) : (
            <>
              {/* Top 3 podium */}
              {leaders.length >= 3 && (
                <div className="lb-podium">
                  {[leaders[1], leaders[0], leaders[2]].map((l, i) => {
                    const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
                    return (
                      <div key={l.uid} className={`lb-podium-slot rank-${rank}`}>
                        <Link to={`/profile/${l.uid}`} className="lb-avatar lb-avatar-lg">
                          {initials(l.displayName, l.email)}
                        </Link>
                        <div className="lb-podium-medal">{MEDALS[rank - 1]}</div>
                        <div className="lb-podium-name">{l.displayName || l.email.split("@")[0]}</div>
                        <div className="lb-podium-bal">${l.walletBalance.toFixed(2)}</div>
                        <div className={`lb-podium-bar bar-${rank}`} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Full table */}
              <div className="lb-table">
                {leaders.map((l, i) => {
                  const isMe = user?.uid === l.uid;
                  return (
                    <div key={l.uid} className={"lb-row" + (isMe ? " lb-row-me" : "")}>
                      <div className="lb-rank">
                        {i < 3 ? MEDALS[i] : <span className="lb-rank-num">#{i + 1}</span>}
                      </div>
                      <Link to={`/profile/${l.uid}`} className="lb-avatar">
                        {initials(l.displayName, l.email)}
                      </Link>
                      <div className="lb-info">
                        <div className="lb-name">
                          {l.displayName || l.email.split("@")[0]}
                          {isMe && <span className="lb-you-badge">you</span>}
                          {l.role === "admin" && <span className="lb-admin-badge">admin</span>}
                        </div>
                      </div>
                      <div className="lb-balance">${l.walletBalance.toFixed(2)}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
