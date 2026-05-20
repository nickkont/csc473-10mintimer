import { Router } from "express";
import { admin, adminDb } from "../firebaseAdmin.js";
import { serializeDoc } from "../lib/serialize.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  try {
    const snap = await adminDb
      .collection("socialPosts")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    const posts = snap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) }));
    res.json({ posts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load posts.";
    res.status(500).json({ error: msg });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const uid = req.uid!;
  const body = req.body as {
    text?: unknown;
    image?: unknown;
    authorName?: unknown;
    authorInitials?: unknown;
  };
  const text = String(body.text ?? "").trim();
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  const image = body.image ? String(body.image) : null;
  if (image && image.length > 1_500_000) {
    res.status(400).json({ error: "image too large (max ~1MB data URL)" });
    return;
  }
  const authorName = String(body.authorName ?? "Anonymous");
  const authorInitials = String(body.authorInitials ?? "?").slice(0, 4);

  try {
    const ref = await adminDb.collection("socialPosts").add({
      uid,
      authorName,
      authorInitials,
      text,
      image,
      likes: 0,
      comments: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const snap = await ref.get();
    res.status(201).json({ id: ref.id, ...serializeDoc(snap.data()) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create post.";
    res.status(400).json({ error: msg });
  }
});

router.post("/:id/comments", requireAuth, async (req, res) => {
  const uid = req.uid!;
  const postId = req.params.id;
  const body = req.body as {
    text?: unknown;
    authorName?: unknown;
    authorInitials?: unknown;
  };
  const text = String(body.text ?? "").trim();
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  const authorName = String(body.authorName ?? "Anonymous");
  const authorInitials = String(body.authorInitials ?? "?").slice(0, 4);

  const postRef = adminDb.doc(`socialPosts/${postId}`);
  try {
    const result = await adminDb.runTransaction(async (t) => {
      const snap = await t.get(postRef);
      if (!snap.exists) throw new Error("Post not found.");
      const commentRef = adminDb.collection(`socialPosts/${postId}/comments`).doc();
      t.set(commentRef, {
        uid,
        authorName,
        authorInitials,
        text,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const current = Number(snap.data()?.comments) || 0;
      t.update(postRef, { comments: current + 1 });
      return { id: commentRef.id };
    });
    res.status(201).json({ id: result.id, uid, authorName, authorInitials, text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to add comment.";
    res.status(400).json({ error: msg });
  }
});

export default router;
