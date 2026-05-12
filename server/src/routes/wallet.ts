import { Router } from "express";
import { admin, adminDb } from "../firebaseAdmin.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function parseAmount(raw: unknown): number | null {
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return null;
  return parseFloat(n.toFixed(2));
}

router.post("/deposit", requireAuth, async (req, res) => {
  const uid = req.uid!;
  const amount = parseAmount((req.body as { amount?: unknown }).amount);
  const paymentMethod = String((req.body as { paymentMethod?: unknown }).paymentMethod ?? "");
  if (amount === null) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }

  const userRef = adminDb.doc(`users/${uid}`);
  try {
    const newBalance = await adminDb.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      const cur = snap.exists ? Number(snap.data()?.walletBalance) || 0 : 0;
      const nb = parseFloat((cur + amount).toFixed(2));
      t.set(userRef, { walletBalance: nb }, { merge: true });
      const txRef = adminDb.collection(`users/${uid}/transactions`).doc();
      t.set(txRef, {
        type: "deposit",
        amount,
        description: paymentMethod ? `Deposit via ${paymentMethod}` : "Deposit",
        balance: nb,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return nb;
    });
    res.json({ newBalance });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Deposit failed.";
    res.status(400).json({ error: msg });
  }
});

router.post("/withdraw", requireAuth, async (req, res) => {
  const uid = req.uid!;
  const amount = parseAmount((req.body as { amount?: unknown }).amount);
  if (amount === null) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }

  const userRef = adminDb.doc(`users/${uid}`);
  try {
    const newBalance = await adminDb.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      const cur = snap.exists ? Number(snap.data()?.walletBalance) || 0 : 0;
      if (amount > cur) throw new Error("Insufficient balance.");
      const nb = parseFloat((cur - amount).toFixed(2));
      t.update(userRef, { walletBalance: nb });
      const txRef = adminDb.collection(`users/${uid}/transactions`).doc();
      t.set(txRef, {
        type: "withdrawal",
        amount: -amount,
        description: "Withdrawal",
        balance: nb,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return nb;
    });
    res.json({ newBalance });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Withdrawal failed.";
    res.status(400).json({ error: msg });
  }
});

export default router;
