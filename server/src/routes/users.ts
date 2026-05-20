import { Router } from "express";
import { admin, adminAuth, adminDb } from "../firebaseAdmin.js";
import { serializeDoc } from "../lib/serialize.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

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
      approved: false,
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

router.post("/me/claim-admin", requireAuth, async (req, res) => {
  if (process.env.ALLOW_ADMIN_CLAIM !== "true") {
    res.status(403).json({ error: "Admin claim is disabled on this server." });
    return;
  }
  const uid = req.uid!;
  try {
    await adminDb.doc(`users/${uid}`).set({ role: "admin" }, { merge: true });
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Claim failed.";
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

// ── Admin: list + ban + role ─────────────────────────────────────────────────
router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const snap = await adminDb.collection("users").get();
    const users = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      // Treat missing `approved` as true so existing accounts aren't locked out
      // by this newer field; only `approved === false` is treated as pending.
      const approved = data.approved === false ? false : true;
      return {
        uid: d.id,
        email: String(data.email ?? ""),
        displayName: String(data.displayName ?? ""),
        role: String(data.role ?? "user"),
        banned: data.banned === true,
        approved,
        walletBalance: Number(data.walletBalance) || 0,
        isBot: data.isBot === true,
      };
    });
    res.json({ users });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to list users.";
    res.status(500).json({ error: msg });
  }
});

router.post("/:uid/ban", requireAuth, requireAdmin, async (req, res) => {
  const targetUid = req.params.uid;
  if (targetUid === req.uid) {
    res.status(400).json({ error: "You can't ban yourself." });
    return;
  }
  try {
    await adminDb.doc(`users/${targetUid}`).set(
      {
        banned: true,
        bannedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ban failed.";
    res.status(400).json({ error: msg });
  }
});

router.post("/:uid/unban", requireAuth, requireAdmin, async (req, res) => {
  const targetUid = req.params.uid;
  try {
    await adminDb.doc(`users/${targetUid}`).set(
      {
        banned: false,
        bannedAt: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unban failed.";
    res.status(400).json({ error: msg });
  }
});

router.post("/:uid/approve", requireAuth, requireAdmin, async (req, res) => {
  const targetUid = req.params.uid;
  try {
    await adminDb.doc(`users/${targetUid}`).set(
      {
        approved: true,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Approval failed.";
    res.status(400).json({ error: msg });
  }
});

router.post("/:uid/unapprove", requireAuth, requireAdmin, async (req, res) => {
  const targetUid = req.params.uid;
  if (targetUid === req.uid) {
    res.status(400).json({ error: "You can't unapprove yourself." });
    return;
  }
  try {
    await adminDb.doc(`users/${targetUid}`).set(
      {
        approved: false,
        approvedAt: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unapprove failed.";
    res.status(400).json({ error: msg });
  }
});

router.post("/:uid/role", requireAuth, requireAdmin, async (req, res) => {
  const targetUid = req.params.uid;
  const { role } = req.body as { role?: string };
  if (role !== "admin" && role !== "user") {
    res.status(400).json({ error: "role must be 'admin' or 'user'" });
    return;
  }
  if (targetUid === req.uid && role !== "admin") {
    res.status(400).json({ error: "You can't demote yourself." });
    return;
  }
  try {
    await adminDb.doc(`users/${targetUid}`).set({ role }, { merge: true });
    res.json({ ok: true, role });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Role update failed.";
    res.status(400).json({ error: msg });
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
