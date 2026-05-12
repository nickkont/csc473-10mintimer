import { Router } from "express";
import { adminDb } from "../firebaseAdmin.js";
import { serializeDoc } from "../lib/serialize.js";

const router = Router();

router.get("/", async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  try {
    const snap = await adminDb
      .collection("activity")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    const items = snap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) }));
    res.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load activity.";
    res.status(500).json({ error: msg });
  }
});

export default router;
