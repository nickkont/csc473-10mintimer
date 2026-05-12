import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { auth } from "../firebase";
import { createPost, listPosts } from "../api/posts";
import { loginWithRedirect } from "../lib/siteUrls";
import "../../../styles.css";
import "../../../socialv2.css";

type TimeFilter = "Now" | "Today" | "This Week" | "This Month";

interface PostVM {
  id: string;
  name: string;
  initials: string;
  minutesAgo: number;
  text: string;
  image: string | null;
  liked: boolean;
  likes: number;
  comments: number;
}

function escapeHTML(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(minutesAgo: number): string {
  if (minutesAgo < 1) return "now";
  if (minutesAgo < 60) return `${minutesAgo}m`;
  if (minutesAgo < 1440) return `${Math.floor(minutesAgo / 60)}h`;
  return `${Math.floor(minutesAgo / 1440)}d`;
}

function timestampToMinutesAgo(ts: { seconds?: number } | null | undefined): number {
  if (!ts || typeof ts.seconds !== "number") return 0;
  const diffMs = Date.now() - ts.seconds * 1000;
  return Math.max(0, Math.floor(diffMs / 60000));
}

function filterPosts(posts: PostVM[], activeFilter: TimeFilter): PostVM[] {
  const limits: Record<TimeFilter, number> = {
    Now: 60,
    Today: 1440,
    "This Week": 10080,
    "This Month": 43200,
  };
  const limit = limits[activeFilter] ?? Infinity;
  return posts.filter((p) => p.minutesAgo <= limit);
}

function getInitials(u: User | null): string {
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

function getAuthorName(u: User | null): string {
  if (!u) return "Anonymous";
  if (u.displayName) return u.displayName;
  if (u.email) return u.email.split("@")[0];
  return "Anonymous";
}

export default function SocialPage(): JSX.Element {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostVM[]>([]);
  const [activeFilter, setActiveFilter] = useState<TimeFilter>("Now");
  const [user, setUser] = useState<User | null>(null);
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("activeTab") as TimeFilter | null;
    if (saved && ["Now", "Today", "This Week", "This Month"].includes(saved)) {
      setActiveFilter(saved);
    }
  }, []);

  const loadPosts = useCallback(async (): Promise<void> => {
    try {
      const list = await listPosts(100);
      setPosts(
        list.map((p) => ({
          id: p.id,
          name: String(p.authorName || "Anonymous"),
          initials: String(p.authorInitials || "?"),
          minutesAgo: timestampToMinutesAgo(p.createdAt),
          text: String(p.text || ""),
          image: p.image ?? null,
          liked: false,
          likes: Number(p.likes || 0),
          comments: Number(p.comments || 0),
        }))
      );
    } catch {
      setMsg("Could not load social posts right now.");
    }
  }, []);

  useEffect(() => {
    void loadPosts();
    const interval = setInterval(() => void loadPosts(), 15000);
    return () => clearInterval(interval);
  }, [loadPosts]);

  const visible = filterPosts(posts, activeFilter);

  const likePost = useCallback((id: string): void => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const liked = !p.liked;
        return { ...p, liked, likes: p.likes + (liked ? 1 : -1) };
      })
    );
  }, []);

  const onPost = (): void => {
    const t = text.trim();
    if (!t) return;
    if (!user) {
      setMsg("Log in to post. Redirecting…");
      setMsgOk(false);
      setTimeout(() => navigate(loginWithRedirect("/social")), 600);
      return;
    }
    void createPost({
      text: t,
      image: pendingImage || null,
      authorName: getAuthorName(user),
      authorInitials: getInitials(user),
    })
      .then(() => {
        setText("");
        setPendingImage(null);
        setMsg("Posted successfully.");
        setMsgOk(true);
        void loadPosts();
      })
      .catch((e) => {
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        setMsg(err.response?.data?.error ?? err.message ?? "Could not post right now.");
        setMsgOk(false);
      });
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) {
      setPendingImage(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage(typeof reader.result === "string" ? reader.result : null);
      setMsg("Image attached.");
      setMsgOk(true);
    };
    reader.onerror = () => {
      setPendingImage(null);
      setMsg("Could not read selected image.");
      setMsgOk(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <AppLayout>
      <main className="page">
        <div className="container">
          <div className="post-section">
            <div className="page-title">Community Feed</div>
            <div className="section">
              <div className="user-post-row">
                <div className="avatar">{user ? getInitials(user) : "?"}</div>
                <div className="field">
                  <textarea
                    placeholder="Write something..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>
              </div>
              <div className="save-row">
                <button type="button" className="btn-post" onClick={onPost}>
                  Post
                </button>
                <div className="btn-ghost">
                  <label htmlFor="file-upload">Upload Images</label>
                  <input id="file-upload" type="file" accept="image/png, image/jpeg, image/gif" onChange={onFile} />
                </div>
              </div>
              {msg ? (
                <div className={"post-message show" + (msgOk ? " success" : " error")} id="post-message">
                  {msg}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="time-tabs container">
          {(["Now", "Today", "This Week", "This Month"] as TimeFilter[]).map((tab) => (
            <div
              key={tab}
              className={"time-tab" + (activeFilter === tab ? " active" : "")}
              role="button"
              tabIndex={0}
              onClick={() => {
                setActiveFilter(tab);
                localStorage.setItem("activeTab", tab);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveFilter(tab);
                  localStorage.setItem("activeTab", tab);
                }
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        <div className="posts-feed">
          <div className="container">
            {!visible.length ? (
              <p className="empty-feed">No posts in this time range yet.</p>
            ) : (
              visible.map((post) => {
                const heartFill = post.liked ? "red" : "none";
                const heartStroke = post.liked ? "red" : "currentColor";
                return (
                  <div key={post.id} className="post-row" data-post-id={post.id}>
                    <div className="avatar">{escapeHTML(post.initials)}</div>
                    <div className="field">
                      <div className="post-header">
                        <strong>{escapeHTML(post.name)}</strong>
                        <span className="post-time">{formatTime(post.minutesAgo)}</span>
                      </div>
                      <div className="post-content">
                        <p className="post-text">{post.text}</p>
                        {post.image ? (
                          <div className="post-images">
                            <img src={post.image} alt="" />
                          </div>
                        ) : null}
                        <hr className="divider" />
                        <div className="post-actions">
                          <div className="post-action-row">
                            <button type="button" className="action-btn" aria-label="Comments">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                              <p>{post.comments}</p>
                            </button>
                            <button
                              type="button"
                              className="action-btn"
                              data-action="like"
                              data-id={post.id}
                              onClick={() => likePost(post.id)}
                              aria-label="Like"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill={heartFill}
                                stroke={heartStroke}
                                strokeWidth="2"
                              >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                              </svg>
                              <p className="like_count">{post.likes}</p>
                            </button>
                            <button type="button" className="action-btn" aria-label="Share">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="18" cy="5" r="3" />
                                <circle cx="6" cy="12" r="3" />
                                <circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                              </svg>
                            </button>
                          </div>
                          <div className="buy-row" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

    </AppLayout>
  );
}
