import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { createComment, createPost } from "../api/posts";
import { useToast } from "../context/ToastContext";
import { auth, db } from "../firebase";
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

interface CommentVM {
  id: string;
  name: string;
  initials: string;
  text: string;
  minutesAgo: number;
}

function formatTime(minutesAgo: number): string {
  if (minutesAgo < 1) return "now";
  if (minutesAgo < 60) return `${minutesAgo}m`;
  if (minutesAgo < 1440) return `${Math.floor(minutesAgo / 60)}h`;
  return `${Math.floor(minutesAgo / 1440)}d`;
}

function timestampToMinutesAgo(ts: { toDate?: () => Date } | null | undefined): number {
  if (!ts || typeof ts.toDate !== "function") return 0;
  const diffMs = Date.now() - ts.toDate().getTime();
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
    return u.displayName.trim().split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
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

// ── Comments panel ────────────────────────────────────────────────────────────

function CommentsPanel({
  postId,
  user,
  onCountChange,
}: {
  postId: string;
  user: User | null;
  onCountChange: (postId: string, delta: number) => void;
}): JSX.Element {
  const [comments, setComments] = useState<CommentVM[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "socialPosts", postId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(
        snap.docs.map((d) => ({
          id: d.id,
          name: String(d.data().authorName || "Anonymous"),
          initials: String(d.data().authorInitials || "?"),
          text: String(d.data().text || ""),
          minutesAgo: timestampToMinutesAgo(d.data().createdAt),
        }))
      );
      setLoadingComments(false);
    });
    return () => unsub();
  }, [postId]);

  const submitComment = async (): Promise<void> => {
    const t = commentText.trim();
    if (!t || !user || submitting) return;
    setSubmitting(true);
    setCommentText("");
    try {
      await createComment(postId, {
        text: t,
        authorName: getAuthorName(user),
        authorInitials: getInitials(user),
      });
      onCountChange(postId, 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="comments-section">
      {loadingComments ? (
        <p className="comments-loading">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="comments-empty">No comments yet. Be the first!</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="comment-row">
            <div className="avatar comment-avatar">{c.initials}</div>
            <div className="comment-body">
              <div className="comment-header">
                <strong>{c.name}</strong>
                <span className="post-time">{formatTime(c.minutesAgo)}</span>
              </div>
              <p className="comment-text">{c.text}</p>
            </div>
          </div>
        ))
      )}
      {user ? (
        <div className="comment-compose">
          <div className="avatar comment-avatar">{getInitials(user)}</div>
          <input
            type="text"
            className="comment-input"
            placeholder="Write a comment…"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitComment();
              }
            }}
          />
          <button
            type="button"
            className="comment-submit-btn"
            disabled={submitting || !commentText.trim()}
            onClick={() => void submitComment()}
          >
            Reply
          </button>
        </div>
      ) : (
        <p className="comments-login">
          <a href="#/login">Log in</a> to leave a comment.
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SocialPage(): JSX.Element {
  const navigate = useNavigate();
  const toast = useToast();
  const [posts, setPosts] = useState<PostVM[]>([]);
  const [activeFilter, setActiveFilter] = useState<TimeFilter>("Now");
  const [user, setUser] = useState<User | null>(null);
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("activeTab") as TimeFilter | null;
    if (saved && ["Now", "Today", "This Week", "This Month"].includes(saved)) {
      setActiveFilter(saved);
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, "socialPosts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: PostVM[] = snap.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: String(data.authorName || "Anonymous"),
            initials: String(data.authorInitials || "?"),
            minutesAgo: timestampToMinutesAgo(data.createdAt),
            text: String(data.text || ""),
            image: data.image ? String(data.image) : null,
            liked: false,
            likes: Number(data.likes || 0),
            comments: Number(data.comments || 0),
          };
        });
        setPosts(list);
      },
      (err) => {
        console.error("socialPosts snapshot error:", err);
        setMsg((err as Error).message || "Could not load social posts right now.");
      }
    );
    return () => unsub();
  }, []);

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

  const handleCommentCountChange = useCallback((postId: string, delta: number): void => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: p.comments + delta } : p))
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
        toast("Post published!");
      })
      .catch((e) => {
        const m = (e as Error).message || "Could not post right now.";
        setMsg(m);
        setMsgOk(false);
        toast(m, "error");
      });
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) { setPendingImage(null); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage(typeof reader.result === "string" ? reader.result : null);
      setMsg("");
      setMsgOk(false);
    };
    reader.onerror = () => {
      setPendingImage(null);
      setMsg("Could not read selected image.");
      setMsgOk(false);
    };
    reader.readAsDataURL(file);
  };

  const clearPendingImage = (): void => {
    setPendingImage(null);
    const input = document.getElementById("file-upload") as HTMLInputElement | null;
    if (input) input.value = "";
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
                  <label htmlFor="file-upload">{pendingImage ? "Replace image" : "Upload image"}</label>
                  <input id="file-upload" type="file" accept="image/png, image/jpeg, image/gif, image/webp" onChange={onFile} />
                </div>
              </div>
              {pendingImage ? (
                <div
                  style={{
                    marginTop: 12,
                    position: "relative",
                    display: "inline-block",
                    maxWidth: 240,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <img
                    src={pendingImage}
                    alt="Selected attachment preview"
                    style={{ display: "block", width: "100%", height: "auto", maxHeight: 240, objectFit: "cover" }}
                  />
                  <button
                    type="button"
                    onClick={clearPendingImage}
                    aria-label="Remove image"
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      border: "none",
                      background: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      fontSize: "0.95rem",
                      lineHeight: 1,
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : null}
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
              onClick={() => { setActiveFilter(tab); localStorage.setItem("activeTab", tab); }}
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
                const commentsOpen = openCommentId === post.id;
                return (
                  <div key={post.id} className="post-row" data-post-id={post.id}>
                    <div className="avatar">{post.initials}</div>
                    <div className="field">
                      <div className="post-header">
                        <strong>{post.name}</strong>
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
                            <button
                              type="button"
                              className={"action-btn" + (commentsOpen ? " active" : "")}
                              aria-label="Comments"
                              onClick={() => setOpenCommentId(commentsOpen ? null : post.id)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                              <p>{post.comments}</p>
                            </button>
                            <button
                              type="button"
                              className="action-btn"
                              onClick={() => likePost(post.id)}
                              aria-label="Like"
                            >
                              <svg viewBox="0 0 24 24" fill={heartFill} stroke={heartStroke} strokeWidth="2">
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
                        </div>
                        {commentsOpen ? (
                          <CommentsPanel
                            postId={post.id}
                            user={user}
                            onCountChange={handleCommentCountChange}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>Eventra · Community</span>
        </div>
      </footer>
    </AppLayout>
  );
}
