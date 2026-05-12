import { Router } from "express";
import { admin, adminAuth, adminDb } from "../firebaseAdmin.js";
import { serializeDoc } from "../lib/serialize.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const EDITABLE_PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "username",
  "phone",
  "dob",
  "timezone",
  "language",
  "bio",
  "displayName",
] as const;

router.post("/", requireAuth, async (req, res) => {
  const uid = req.uid!;
  const body = req.body as { email?: unknown; displayName?: unknown };
  const userRef = adminDb.doc(`users/${uid}`);
  try {
    const existing = await userRef.get();
    if (existing.exists) {
      res.status(409).json({ error: "User already exists." });
      return;
    }
    await userRef.set({
      email: String(body.email ?? req.email ?? ""),
      displayName: String(body.displayName ?? ""),
      walletBalance: 0,
      role: "user",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ uid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create user.";
    res.status(400).json({ error: msg });
  }
});

router.patch("/me", requireAuth, async (req, res) => {
  const uid = req.uid!;
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE_PROFILE_FIELDS) {
    if (key in body) updates[key] = String(body[key] ?? "");
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No editable fields provided." });
    return;
  }
  try {
    await adminDb.doc(`users/${uid}`).set(updates, { merge: true });
    res.json({ ok: true, updated: Object.keys(updates) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update profile.";
    res.status(400).json({ error: msg });
  }
});

async function deleteSubcollection(parentPath: string, name: string): Promise<void> {
  for (;;) {
    const snap = await adminDb.collection(`${parentPath}/${name}`).limit(500).get();
    if (snap.empty) return;
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

router.delete("/me", requireAuth, async (req, res) => {
  const uid = req.uid!;
  try {
    await deleteSubcollection(`users/${uid}`, "positions");
    await deleteSubcollection(`users/${uid}`, "transactions");
    await adminDb.doc(`users/${uid}`).delete();
    try {
      await adminAuth.deleteUser(uid);
    } catch {
      // auth user may already be gone; ignore
    }
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete account.";
    res.status(400).json({ error: msg });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const uid = req.uid!;
  try {
    const snap = await adminDb.doc(`users/${uid}`).get();
    if (!snap.exists) {
      res.json({ uid, walletBalance: 0, role: "user" });
      return;
    }
    res.json({ uid, ...serializeDoc(snap.data()) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load user.";
    res.status(500).json({ error: msg });
  }
});

router.get("/me/positions", requireAuth, async (req, res) => {
  const uid = req.uid!;
  try {
    const snap = await adminDb.collection(`users/${uid}/positions`).get();
    const positions = snap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) }));
    res.json({ positions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load positions.";
    res.status(500).json({ error: msg });
  }
});

router.get("/me/transactions", requireAuth, async (req, res) => {
  const uid = req.uid!;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  try {
    const snap = await adminDb
      .collection(`users/${uid}/transactions`)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    const transactions = snap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) }));
    res.json({ transactions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load transactions.";
    res.status(500).json({ error: msg });
  }
});

router.get("/:uid/profile", async (req, res) => {
  const uid = req.params.uid;
  try {
    const snap = await adminDb.doc(`users/${uid}`).get();
    if (!snap.exists) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    const data = snap.data() as Record<string, unknown>;
    res.json({
      uid,
      firstName: String(data.firstName ?? ""),
      lastName: String(data.lastName ?? ""),
      username: String(data.username ?? ""),
      bio: String(data.bio ?? ""),
      role: String(data.role ?? "user"),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load profile.";
    res.status(500).json({ error: msg });
  }
});

export default router;
