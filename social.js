const db = firebase.firestore();
const authApi = window.EventraAuth || null;

let postsData = [];
let activeFilter = "Now";
let pendingImageDataUrl = null;
let currentUser = null;
let unsubscribeFeed = null;

function getInitials(user) {
  if (!user) return "?";
  if (user.displayName) {
    return user.displayName
      .trim()
      .split(/\s+/)
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  if (user.email) return user.email[0].toUpperCase();
  return "?";
}

function getAuthorName(user) {
  if (!user) return "Anonymous";
  if (user.displayName) return user.displayName;
  if (user.email) return user.email.split("@")[0];
  return "Anonymous";
}

function escapeHTML(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(minutesAgo) {
  if (minutesAgo < 1) return "now";
  if (minutesAgo < 60) return `${minutesAgo}m`;
  if (minutesAgo < 1440) return `${Math.floor(minutesAgo / 60)}h`;
  return `${Math.floor(minutesAgo / 1440)}d`;
}

function timestampToMinutesAgo(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") return 0;
  const diffMs = Date.now() - timestamp.toDate().getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

function filterPosts(posts) {
  const limits = {
    "Now": 60,
    "Today": 1440,
    "This Week": 10080,
    "This Month": 43200,
  };
  const limit = limits[activeFilter] ?? Infinity;
  return posts.filter((p) => p.minutesAgo <= limit);
}

function showPostMessage(text, type) {
  const el = document.getElementById("post-message");
  if (!el) return;
  if (!text) {
    el.className = "post-message";
    el.textContent = "";
    return;
  }
  el.textContent = text;
  el.className = `post-message show ${type || ""}`.trim();
}

function buildPostHTML(post) {
  const heartFill = post.liked ? "red" : "none";
  const heartStroke = post.liked ? "red" : "currentColor";
  const prob = Math.min(100, Math.max(0, post.market.currProb));
  const commentCount = typeof post.comments === "number" ? post.comments : 0;
  const imageHTML = post.image
    ? `<div class="post-images"><img src="${escapeHTML(post.image)}" alt="post image"/></div>`
    : "";
  const marketHTML = post.market.question !== "No market attached"
    ? `<div class="market-card">
        <a href="#" class="market-link">
          <div class="market-name">${escapeHTML(post.market.question)}</div>
        </a>
        <div class="market-meta">
          ${escapeHTML(post.market.side)} · ${escapeHTML(post.market.category)} ·
          was ${post.market.prevProb}% → now ${prob}%
        </div>
        <div class="prob-bar"><div class="prob-fill" style="width:${prob}%;"></div></div>
       </div>`
    : "";
  const buyHTML = post.market.question !== "No market attached"
    ? `<button class="btn-buy" data-id="${post.id}">Buy</button>`
    : "";
  return `
    <div class="post-row" data-post-id="${post.id}">
      <div class="avatar">${escapeHTML(post.initials)}</div>
      <div class="field">
        <div class="post-header">
          <strong>${escapeHTML(post.name)}</strong>
          <span class="post-time">${formatTime(post.minutesAgo)}</span>
        </div>
        <div class="post-content">
          <p class="post-text">${escapeHTML(post.text)}</p>
          ${imageHTML}
          ${marketHTML}
          <hr class="divider">
          <div class="post-actions">
            <div class="post-action-row">
              <button class="action-btn" id="comment_btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p id="reply_count" data-id="${post.id}">${commentCount}</p>
              </button>
              <button class="action-btn" id="like_btn" data-action="like" data-id="${post.id}">
                <svg viewBox="0 0 24 24" fill="${heartFill}" stroke="${heartStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <p id="like_count" class="like_count" data-id="${post.id}">${post.likes}</p>
              </button>
              <button class="action-btn" data-id="${post.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </button>
            </div>
            <div class="buy-row">${buyHTML}</div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderFeed() {
  const feedContainer = document.querySelector(".posts-feed .container");
  if (!feedContainer) return;
  const visible = filterPosts(postsData);
  if (!visible.length) {
    feedContainer.innerHTML = '<p class="empty-feed">No posts in this time range yet.</p>';
    return;
  }
  feedContainer.innerHTML = visible.map(buildPostHTML).join("");
}

function startRealtimeFeed() {
  if (unsubscribeFeed) unsubscribeFeed();
  unsubscribeFeed = db.collection("socialPosts")
    .orderBy("createdAt", "desc")
    .limit(200)
    .onSnapshot((snapshot) => {
      postsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: data.uid || "",
          name: data.authorName || "Anonymous",
          initials: data.authorInitials || "?",
          minutesAgo: timestampToMinutesAgo(data.createdAt),
          text: data.text || "",
          image: data.image || null,
          liked: false,
          likes: Number(data.likes || 0),
          comments: Number(data.comments || 0),
          market: {
            question: "No market attached",
            side: "",
            category: "",
            prevProb: 0,
            currProb: 0,
          },
        };
      });
      renderFeed();
    }, () => {
      showPostMessage("Could not load social posts right now.", "error");
    });
}

function handleFeedClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const post = postsData.find((p) => String(p.id) === String(id));
  if (action === "like" && post) {
    post.liked = !post.liked;
    post.likes += post.liked ? 1 : -1;
    const likeEl = document.querySelector(`.like_count[data-id="${id}"]`);
    if (likeEl) likeEl.textContent = String(post.likes);
    const svg = btn.querySelector("svg");
    if (svg) {
      svg.setAttribute("fill", post.liked ? "red" : "none");
      svg.setAttribute("stroke", post.liked ? "red" : "currentColor");
    }
  }
}

function handleTabClick(e) {
  const tab = e.target.closest(".time-tab");
  if (!tab) return;
  activeFilter = tab.textContent.trim();
  localStorage.setItem("activeTab", activeFilter);
  document.querySelectorAll(".time-tab").forEach((t) => {
    t.classList.toggle("active", t === tab);
  });
  renderFeed();
}

function redirectToLogin() {
  const redirect = encodeURIComponent("react-dist/index.html#/social");
  window.location.href = `login.html?redirect=${redirect}`;
}

function handleImageUpload(e) {
  const input = e.target;
  const file = input.files && input.files[0];
  if (!file) {
    pendingImageDataUrl = null;
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingImageDataUrl = typeof reader.result === "string" ? reader.result : null;
    showPostMessage("Image attached.", "success");
  };
  reader.onerror = () => {
    pendingImageDataUrl = null;
    showPostMessage("Could not read selected image.", "error");
  };
  reader.readAsDataURL(file);
}

function handleNewPost() {
  const textarea = document.querySelector(".user-post-row textarea");
  const postBtn = document.querySelector(".btn-post");
  const fileInput = document.getElementById("file-upload");
  const text = textarea ? textarea.value.trim() : "";
  if (!text) return;
  if (!currentUser) {
    showPostMessage("Log in to post. Redirecting…", "error");
    setTimeout(redirectToLogin, 600);
    return;
  }
  if (postBtn) postBtn.disabled = true;
  db.collection("socialPosts").add({
    uid: currentUser.uid,
    authorName: getAuthorName(currentUser),
    authorInitials: getInitials(currentUser),
    text,
    image: pendingImageDataUrl || null,
    likes: 0,
    comments: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  })
    .then(() => {
      if (textarea) textarea.value = "";
      if (fileInput) fileInput.value = "";
      pendingImageDataUrl = null;
      showPostMessage("Posted successfully.", "success");
    })
    .catch((err) => {
      showPostMessage(err.message || "Could not post right now.", "error");
    })
    .finally(() => {
      if (postBtn) postBtn.disabled = false;
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("activeTab");
  if (saved) {
    const matchingTab = [...document.querySelectorAll(".time-tab")]
      .find((t) => t.textContent.trim() === saved);
    if (matchingTab) {
      activeFilter = saved;
      document.querySelectorAll(".time-tab").forEach((t) => {
        t.classList.toggle("active", t === matchingTab);
      });
    }
  }
  document.querySelector(".posts-feed")?.addEventListener("click", handleFeedClick);
  document.querySelector(".btn-post")?.addEventListener("click", handleNewPost);
  document.querySelector(".time-tabs")?.addEventListener("click", handleTabClick);
  document.getElementById("file-upload")?.addEventListener("change", handleImageUpload);
  if (authApi && typeof authApi.onAuthStateChanged === "function") {
    authApi.onAuthStateChanged((user) => {
      currentUser = user;
    });
  }
  startRealtimeFeed();
});




