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
    imageUrl?: unknown;
  };
  const title = String(body.title ?? "").trim();
  const category = String(body.category ?? "").trim();
  const closesAtRaw = body.closesAt;
  const yesPrice = Number(body.yesPrice);
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() || null : null;

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

  const yp = parseFloat(yesPrice.toFixed(2));
  const np = parseFloat((1 - yesPrice).toFixed(2));

  try {
    const docRef = await adminDb.collection("markets").add({
      title,
      category,
      imageUrl,
      closesAt: admin.firestore.Timestamp.fromDate(closesAtDate),
      yesPrice: yp,
      noPrice: np,
      status: "open",
      totalTrades: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await adminDb.collection(`markets/${docRef.id}/priceHistory`).add({
      yesPrice: yp,
      noPrice: np,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
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

// ── Admin: demo seed ────────────────────────────────────────────────────────
const W  = "https://upload.wikimedia.org/wikipedia/commons/thumb";
const WE = "https://upload.wikimedia.org/wikipedia/en/thumb";
const lf = (kw: string, lock: number) => `https://loremflickr.com/100/100/${kw}?lock=${lock}`;

const SEED_MARKETS = [
  { title: "Will CCNY cancel classes for a snow day before May?",            category: "ccny",      yesPrice: 0.58, closesIn: 60,  imageUrl: lf("snowstorm", 240) },
  { title: "Will the CCNY cafeteria add a vegan station this semester?",     category: "ccny",      yesPrice: 0.34, closesIn: 90,  imageUrl: lf("salad", 250) },
  { title: "Will student council elections see record turnout?",             category: "ccny",      yesPrice: 0.47, closesIn: 45,  imageUrl: lf("election", 260) },
  { title: "Will the Yankees win the World Series this year?",               category: "sports",    yesPrice: 0.28, closesIn: 180, imageUrl: `${W}/f/f0/New_York_Yankees_Primary_Logo.svg/100px-New_York_Yankees_Primary_Logo.svg.png` },
  { title: "Will LeBron James retire before 2026?",                          category: "sports",    yesPrice: 0.15, closesIn: 200, imageUrl: `${WE}/0/03/National_Basketball_Association_logo.svg/100px-National_Basketball_Association_logo.svg.png` },
  { title: "Will the USMNT reach the knockout stage of the 2026 World Cup?", category: "sports",    yesPrice: 0.66, closesIn: 365, imageUrl: lf("soccer", 270) },
  { title: "Will Congress pass a new budget before the next deadline?",      category: "politics",  yesPrice: 0.48, closesIn: 60,  imageUrl: `${W}/4/4f/US_Capitol_west_side.JPG/100px-US_Capitol_west_side.JPG` },
  { title: "Will a third-party candidate win any electoral votes in 2028?",  category: "politics",  yesPrice: 0.21, closesIn: 365, imageUrl: lf("politics", 300) },
  { title: "Will the Fed cut rates at least twice before year end?",         category: "economics", yesPrice: 0.71, closesIn: 180, imageUrl: `${W}/b/be/Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg/100px-Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg` },
  { title: "Will US inflation stay below 4% this year?",                     category: "economics", yesPrice: 0.63, closesIn: 180, imageUrl: lf("currency", 170) },
  { title: "Will Bitcoin exceed $150k by end of 2025?",                      category: "economics", yesPrice: 0.44, closesIn: 200, imageUrl: `${W}/4/46/Bitcoin.svg/100px-Bitcoin.svg.png` },
  { title: "Will the S&P 500 hit a new all-time high before July?",          category: "economics", yesPrice: 0.58, closesIn: 60,  imageUrl: lf("stock-market", 190) },
  { title: "Will the US enter a recession in 2025?",                         category: "economics", yesPrice: 0.31, closesIn: 200, imageUrl: lf("recession", 210) },
  { title: "Will Taylor Swift release a new album in 2025?",                 category: "culture",   yesPrice: 0.78, closesIn: 180, imageUrl: lf("music-concert", 90) },
  { title: "Will a superhero movie win Best Picture at the Oscars?",         category: "culture",   yesPrice: 0.11, closesIn: 300, imageUrl: `${W}/6/66/OscarStatuette.jpg/100px-OscarStatuette.jpg` },
  { title: "Will GTA VI release in 2025?",                                   category: "culture",   yesPrice: 0.61, closesIn: 180, imageUrl: lf("video-game", 110) },
  { title: "Will 2025 be the hottest year on record?",                       category: "climate",   yesPrice: 0.73, closesIn: 200, imageUrl: lf("heatwave", 70) },
  { title: "Will California face a major wildfire emergency this summer?",   category: "climate",   yesPrice: 0.81, closesIn: 120, imageUrl: lf("wildfire", 10) },
  { title: "Will the US pass new federal clean energy legislation?",         category: "climate",   yesPrice: 0.29, closesIn: 300, imageUrl: lf("wind-turbine", 80) },
  { title: "Will a Category 5 hurricane hit the US mainland in 2025?",       category: "climate",   yesPrice: 0.42, closesIn: 150, imageUrl: `${W}/1/10/Hurricane_Isabel_from_ISS.jpg/100px-Hurricane_Isabel_from_ISS.jpg` },
] as const;

function pickImage(title: string, category: string): string {
  const t = title.toLowerCase();
  if (t.includes("bitcoin"))                                return `${W}/4/46/Bitcoin.svg/100px-Bitcoin.svg.png`;
  if (t.includes("ethereum"))                               return `${W}/0/05/Ethereum_logo_2014.svg/100px-Ethereum_logo_2014.svg.png`;
  if (t.includes("apple"))                                  return `${W}/f/fa/Apple_logo_black.svg/100px-Apple_logo_black.svg.png`;
  if (t.includes("yankee"))                                 return `${W}/f/f0/New_York_Yankees_Primary_Logo.svg/100px-New_York_Yankees_Primary_Logo.svg.png`;
  if (t.includes("hurricane"))                              return `${W}/1/10/Hurricane_Isabel_from_ISS.jpg/100px-Hurricane_Isabel_from_ISS.jpg`;
  if (t.includes("oscar") || t.includes("best picture"))    return `${W}/6/66/OscarStatuette.jpg/100px-OscarStatuette.jpg`;
  if (t.includes("congress") || t.includes("budget"))       return `${W}/4/4f/US_Capitol_west_side.JPG/100px-US_Capitol_west_side.JPG`;
  if (t.includes("fed cut") || t.includes("interest rate")) return `${W}/b/be/Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg/100px-Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg`;
  if (t.includes("wildfire"))   return lf("wildfire", 10);
  if (t.includes("solar"))      return lf("solar-energy", 20);
  if (t.includes("heatwave") || t.includes("hottest")) return lf("heatwave", 70);
  if (t.includes("soccer") || t.includes("world cup"))     return lf("soccer", 270);
  if (t.includes("snow"))       return lf("snowstorm", 240);
  if (t.includes("vegan"))      return lf("salad", 250);
  if (t.includes("election"))   return lf("election", 260);
  if (t.includes("taylor swift") || t.includes("album")) return lf("music-concert", 90);
  if (t.includes("gta") || t.includes("video game"))     return lf("video-game", 110);
  if (t.includes("inflation"))  return lf("currency", 170);
  if (t.includes("s&p") || t.includes("stock"))          return lf("stock-market", 190);
  if (t.includes("recession"))  return lf("recession", 210);
  const fallbacks: Record<string, string> = {
    ccny: lf("college-campus", 1), sports: lf("sports", 2),
    politics: lf("politics", 3),   economics: lf("finance", 4),
    culture: lf("culture", 5),     climate: lf("climate", 6),
  };
  return fallbacks[category] ?? lf("market", 7);
}

router.post("/seed-demo", requireAuth, requireAdmin, async (_req, res) => {
  try {
    let added = 0;
    for (const m of SEED_MARKETS) {
      const np = parseFloat((1 - m.yesPrice).toFixed(2));
      const closes = new Date(Date.now() + m.closesIn * 86400000);
      const ref = await adminDb.collection("markets").add({
        title: m.title,
        category: m.category,
        imageUrl: m.imageUrl,
        closesAt: admin.firestore.Timestamp.fromDate(closes),
        yesPrice: m.yesPrice,
        noPrice: np,
        status: "open",
        totalTrades: Math.floor(Math.random() * 200 + 20),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await adminDb.collection(`markets/${ref.id}/priceHistory`).add({
        yesPrice: m.yesPrice,
        noPrice: np,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      added += 1;
    }
    res.json({ ok: true, added });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Seed failed.";
    res.status(400).json({ error: msg });
  }
});

router.post("/patch-images", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const snap = await adminDb.collection("markets").get();
    let updated = 0;
    for (const d of snap.docs) {
      const data = d.data() as { title?: string; category?: string };
      await d.ref.update({
        imageUrl: pickImage(String(data.title || ""), String(data.category || "")),
      });
      updated += 1;
    }
    res.json({ ok: true, updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Patch failed.";
    res.status(400).json({ error: msg });
  }
});

router.post("/clear-images", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const snap = await adminDb.collection("markets").get();
    let cleared = 0;
    for (const d of snap.docs) {
      await d.ref.update({ imageUrl: null });
      cleared += 1;
    }
    res.json({ ok: true, cleared });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Clear failed.";
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
