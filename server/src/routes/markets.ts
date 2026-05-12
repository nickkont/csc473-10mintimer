import { Router } from "express";
import { admin, adminDb } from "../firebaseAdmin.js";
import { serializeDoc } from "../lib/serialize.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const snap = await adminDb.collection("markets").orderBy("createdAt", "desc").get();
    const markets = snap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) }));
    res.json({ markets });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load markets.";
    res.status(500).json({ error: msg });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const snap = await adminDb.doc(`markets/${req.params.id}`).get();
    if (!snap.exists) {
      res.status(404).json({ error: "Market not found." });
      return;
    }
    res.json({ id: snap.id, ...serializeDoc(snap.data()) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load market.";
    res.status(500).json({ error: msg });
  }
});

router.get("/:id/history", async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  try {
    const snap = await adminDb
      .collection(`markets/${req.params.id}/priceHistory`)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    const history = snap.docs
      .map((d) => ({ id: d.id, ...serializeDoc(d.data()) }))
      .reverse();
    res.json({ history });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load history.";
    res.status(500).json({ error: msg });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const body = req.body as {
    title?: unknown;
    category?: unknown;
    closesAt?: unknown;
    yesPrice?: unknown;
  };
  const title = String(body.title ?? "").trim();
  const category = String(body.category ?? "").trim();
  const closesAtRaw = body.closesAt;
  const yesPrice = Number(body.yesPrice);

  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (!category) {
    res.status(400).json({ error: "category is required" });
    return;
  }
  if (!isFinite(yesPrice) || yesPrice <= 0 || yesPrice >= 1) {
    res.status(400).json({ error: "yesPrice must be between 0 and 1 (exclusive)" });
    return;
  }
  const closesAtDate = closesAtRaw ? new Date(String(closesAtRaw)) : null;
  if (!closesAtDate || isNaN(closesAtDate.getTime())) {
    res.status(400).json({ error: "closesAt must be a valid date" });
    return;
  }

  try {
    const docRef = await adminDb.collection("markets").add({
      title,
      category,
      closesAt: admin.firestore.Timestamp.fromDate(closesAtDate),
      yesPrice: parseFloat(yesPrice.toFixed(2)),
      noPrice: parseFloat((1 - yesPrice).toFixed(2)),
      status: "open",
      totalTrades: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const snap = await docRef.get();
    res.status(201).json({ id: docRef.id, ...serializeDoc(snap.data()) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create market.";
    res.status(400).json({ error: msg });
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const ref = adminDb.doc(`markets/${req.params.id}`);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: "Market not found." });
      return;
    }
    await ref.delete();
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete market.";
    res.status(400).json({ error: msg });
  }
});

router.post("/:id/resolve", requireAuth, requireAdmin, async (req, res) => {
  const marketId = req.params.id;
  const { outcome } = req.body as { outcome?: "yes" | "no" };
  if (outcome !== "yes" && outcome !== "no") {
    res.status(400).json({ error: "outcome must be 'yes' or 'no'" });
    return;
  }

  const marketRef = adminDb.doc(`markets/${marketId}`);
  try {
    await adminDb.runTransaction(async (t) => {
      const snap = await t.get(marketRef);
      if (!snap.exists) throw new Error("Market not found.");
      const m = snap.data() as { status?: string; title?: string };
      if (m.status === "resolved") throw new Error("Market is already resolved.");
      t.update(marketRef, {
        status: "resolved",
        outcome,
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const activityRef = adminDb.collection("activity").doc();
      t.set(activityRef, {
        type: "resolve",
        outcome,
        marketId,
        marketTitle: m.title ?? marketId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    res.json({ ok: true, outcome });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to resolve market.";
    res.status(400).json({ error: msg });
  }
});

router.post("/:id/claim", requireAuth, async (req, res) => {
  const uid = req.uid!;
  const marketId = req.params.id;

  const userRef = adminDb.doc(`users/${uid}`);
  const posRef = adminDb.doc(`users/${uid}/positions/${marketId}`);
  const marketRef = adminDb.doc(`markets/${marketId}`);

  try {
    const result = await adminDb.runTransaction(async (t) => {
      const [userSnap, posSnap, marketSnap] = await Promise.all([
        t.get(userRef),
        t.get(posRef),
        t.get(marketRef),
      ]);
      if (!posSnap.exists) throw new Error("Position not found.");
      if (!marketSnap.exists) throw new Error("Market not found.");
      const mdata = marketSnap.data() as { status?: string; outcome?: string; title?: string };
      if (mdata.status !== "resolved" || !mdata.outcome) {
        throw new Error("Market is not resolved yet.");
      }
      const posData = posSnap.data() as Record<string, unknown>;
      if (posData.payoutClaimed === true) throw new Error("Payout already claimed.");
      const outcome = mdata.outcome as "yes" | "no";
      const winShares =
        outcome === "yes" ? Number(posData.yesShares) || 0 : Number(posData.noShares) || 0;
      if (winShares <= 0) throw new Error("No winning shares to claim.");
      const payout = parseFloat(winShares.toFixed(2));
      const bal = userSnap.exists ? Number(userSnap.data()?.walletBalance) || 0 : 0;
      const nb = parseFloat((bal + payout).toFixed(2));
      const title = mdata.title || marketId;

      const posUpdate: Record<string, unknown> = {
        payoutClaimed: true,
        claimedAmount: payout,
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (outcome === "yes") posUpdate.yesShares = 0;
      else posUpdate.noShares = 0;

      const actorName = userSnap.data()?.displayName ?? "Someone";
      t.update(userRef, { walletBalance: nb });
      t.set(posRef, posUpdate, { merge: true });
      const txRef = adminDb.collection(`users/${uid}/transactions`).doc();
      t.set(txRef, {
        type: "payout",
        amount: payout,
        description: `Payout from: ${title}`,
        balance: nb,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      const activityRef = adminDb.collection("activity").doc();
      t.set(activityRef, {
        type: "payout",
        uid,
        actorName,
        amount: payout,
        marketId,
        marketTitle: title,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { newBalance: nb, payout };
    });
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Claim failed.";
    res.status(400).json({ error: msg });
  }
});

export default router;
