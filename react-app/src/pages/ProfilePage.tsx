import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import "../../../styles.css";
import "../../../account.css";

interface PublicProfile {
  firstName: string;
  lastName: string;
  username: string;
  bio: string;
  role: string;
}

type LoadState = "loading" | "found" | "missing";

export default function ProfilePage(): JSX.Element {
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!uid) {
      setState("missing");
      return;
    }
    setState("loading");
    void (async () => {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        setState("missing");
        return;
      }
      const data = snap.data() as Partial<PublicProfile>;
      setProfile({
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        username: data.username ?? "",
        bio: data.bio ?? "",
        role: data.role ?? "user",
      });
      setState("found");
    })();
  }, [uid]);

  const isOwn = user?.uid === uid;

  return (
    <AppLayout>
      <div className="page">
        <div className="container">
          <div className="page-title">Profile</div>

          {state === "loading" ? <p className="markets-loading">Loading…</p> : null}

          {state === "missing" ? (
            <div className="section">
              <div className="section-body">
                <p>No profile found for user <code>{uid}</code>.</p>
              </div>
            </div>
          ) : null}

          {state === "found" && profile ? (
            <div className="section">
              <div className="section-head">
                {(profile.firstName || profile.lastName)
                  ? `${profile.firstName} ${profile.lastName}`.trim()
                  : profile.username || "Eventra user"}
                {profile.role === "admin" ? <span className="lock"> admin</span> : null}
              </div>
              <div className="section-body">
                {profile.username ? <p><strong>@{profile.username}</strong></p> : null}
                {profile.bio ? <p>{profile.bio}</p> : <p className="lock">No bio yet.</p>}
                <p className="lock">User ID: {uid}</p>
                {isOwn ? (
                  <div className="save-row">
                    <Link to="/account" className="btn-save">Edit profile</Link>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
