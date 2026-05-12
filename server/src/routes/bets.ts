import { Router } from "express";
import { admin, adminDb } from "../firebaseAdmin.js";
import { placeBetCore } from "../lib/placeBet.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const uid = req.uid!;
  const { marketId, side, shares } = req.body as {
    marketId?: string;
    side?: "yes" | "no";
    shares?: number;
  };

  if (!marketId || (side !== "yes" && side !== "no")) {
    res.status(400).json({ error: "marketId and side ('yes'|'no') are required" });
    return;
  }
  const n = Math.max(1, Math.floor(Number(shares) || 0));
  if (n < 1) {
    res.status(400).json({ error: "shares must be >= 1" });
    return;
  }

  try {
    const result = await placeBetCore({ uid, marketId, side, shares: n });
    res.json({
      newBalance: result.newBalance,
      yesShares: result.yesShares,
      noShares: result.noShares,
      cost: result.cost,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Trade failed.";
    res.status(400).json({ error: msg });
  }
});

router.post("/sell", requireAuth, async (req, res) => {
  const uid = req.uid!;
  const { marketId, side, shares } = req.body as {
    marketId?: string;
    side?: "yes" | "no";
    shares?: number;
  };

  if (!marketId || (side !== "yes" && side !== "no")) {
    res.status(400).json({ error: "marketId and side ('yes'|'no') are required" });
    return;
  }
  const n = Math.max(1, Math.floor(Number(shares) || 0));
  if (n < 1) {
    res.status(400).json({ error: "shares must be >= 1" });
    return;
  }

  const userRef = adminDb.doc(`users/${uid}`);
  const marketRef = adminDb.doc(`markets/${marketId}`);
  const posRef = adminDb.doc(`users/${uid}/positions/${marketId}`);

  try {
    const result = await adminDb.runTransaction(async (t) => {
      const [userSnap, marketSnap, posSnap] = await Promise.all([
        t.get(userRef),
        t.get(marketRef),
        t.get(posRef),
      ]);

      if (!marketSnap.exists) throw new Error("Market not found.");
      const market = marketSnap.data() as {
        title?: string;
        status?: string;
        yesPrice?: number;
        noPrice?: number;
        totalTrades?: number;
      };
      if (market.status === "resolved") throw new Error("Market is already resolved.");
      if (!posSnap.exists) throw new Error("No position to sell.");

      const posData = posSnap.data() as Record<string, unknown>;
      const owned = Number(side === "yes" ? posData.yesShares : posData.noShares) || 0;
      if (n > owned) throw new Error(`You only own ${owned} ${side.toUpperCase()} share${owned === 1 ? "" : "s"}.`);

      const price = Number(side === "yes" ? market.yesPrice : market.noPrice) || 0;
      if (price <= 0) throw new Error("Invalid market price.");
      const proceeds = parseFloat((price * n).toFixed(2));

      const bal = userSnap.exists ? Number(userSnap.data()?.walletBalance) || 0 : 0;
      const newBalance = parseFloat((bal + proceeds).toFixed(2));
      const title = market.title ?? marketId;
      const actorName = userSnap.data()?.displayName ?? "Anonymous";

      const yesSharesOld = Number(posData.yesShares) || 0;
      const noSharesOld = Number(posData.noShares) || 0;
      const yesCostOld = Number(posData.yesCost) || 0;
      const noCostOld = Number(posData.noCost) || 0;
      const newYes = yesSharesOld - (side === "yes" ? n : 0);
      const newNo = noSharesOld - (side === "no" ? n : 0);

      // Reduce cost basis proportionally to the shares sold (average cost method).
      const newYesCost =
        side === "yes" && yesSharesOld > 0
          ? parseFloat((yesCostOld * (Math.max(0, newYes) / yesSharesOld)).toFixed(2))
          : yesCostOld;
      const newNoCost =
        side === "no" && noSharesOld > 0
          ? parseFloat((noCostOld * (Math.max(0, newNo) / noSharesOld)).toFixed(2))
          : noCostOld;

      const realizedCost =
        side === "yes"
          ? parseFloat((yesCostOld - newYesCost).toFixed(2))
          : parseFloat((noCostOld - newNoCost).toFixed(2));
      const realizedPL = parseFloat((proceeds - realizedCost).toFixed(2));

      const trades = Number(market.totalTrades) || 0;

      t.update(userRef, { walletBalance: newBalance });
      t.set(
        posRef,
        {
          marketId,
          yesShares: Math.max(0, newYes),
          noShares: Math.max(0, newNo),
          yesCost: newYesCost,
          noCost: newNoCost,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      const txRef = adminDb.collection(`users/${uid}/transactions`).doc();
      const plLabel = realizedPL >= 0 ? `+$${realizedPL.toFixed(2)}` : `-$${Math.abs(realizedPL).toFixed(2)}`;
      t.set(txRef, {
        type: "sell",
        amount: proceeds,
        description: `Sold ${n} ${side.toUpperCase()} on: ${title} (P/L ${plLabel})`,
        balance: newBalance,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      t.update(marketRef, { totalTrades: trades + 1 });

      const activityRef = adminDb.collection("activity").doc();
      t.set(activityRef, {
        type: "sell",
        uid,
        actorName,
        side,
        shares: n,
        proceeds,
        realizedPL,
        marketId,
        marketTitle: title,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        newBalance,
        yesShares: Math.max(0, newYes),
        noShares: Math.max(0, newNo),
        proceeds,
        realizedPL,
      };
    });

    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sell failed.";
    res.status(400).json({ error: msg });
  }
});

export default router;
