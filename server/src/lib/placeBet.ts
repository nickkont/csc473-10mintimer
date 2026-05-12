import { admin, adminDb } from "../firebaseAdmin.js";

export interface PlaceBetInput {
  uid: string;
  marketId: string;
  side: "yes" | "no";
  shares: number;
  actorName?: string;
}

export interface PlaceBetResult {
  newBalance: number;
  yesShares: number;
  noShares: number;
  cost: number;
  marketTitle: string;
  price: number;
}

export async function placeBetCore(input: PlaceBetInput): Promise<PlaceBetResult> {
  const { uid, marketId, side } = input;
  const n = Math.max(1, Math.floor(Number(input.shares) || 0));
  if (n < 1) throw new Error("shares must be >= 1");

  const userRef = adminDb.doc(`users/${uid}`);
  const marketRef = adminDb.doc(`markets/${marketId}`);
  const posRef = adminDb.doc(`users/${uid}/positions/${marketId}`);

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

    const price = Number(side === "yes" ? market.yesPrice : market.noPrice) || 0;
    if (price <= 0) throw new Error("Invalid market price.");
    const cost = parseFloat((price * n).toFixed(2));

    const bal = userSnap.exists ? Number(userSnap.data()?.walletBalance) || 0 : 0;
    if (cost > bal) throw new Error("Insufficient balance.");
    const newBalance = parseFloat((bal - cost).toFixed(2));

    const posData = posSnap.exists ? (posSnap.data() as Record<string, unknown>) : {};
    const yesShares = Number(posData.yesShares) || 0;
    const noShares = Number(posData.noShares) || 0;
    const yesCost = Number(posData.yesCost) || 0;
    const noCost = Number(posData.noCost) || 0;
    const newYes = yesShares + (side === "yes" ? n : 0);
    const newNo = noShares + (side === "no" ? n : 0);
    const newYesCost = parseFloat((yesCost + (side === "yes" ? cost : 0)).toFixed(2));
    const newNoCost = parseFloat((noCost + (side === "no" ? cost : 0)).toFixed(2));
    const trades = Number(market.totalTrades) || 0;
    const title = market.title ?? marketId;
    const actorName = input.actorName ?? userSnap.data()?.displayName ?? "Anonymous";

    t.update(userRef, { walletBalance: newBalance });
    t.set(
      posRef,
      {
        marketId,
        yesShares: newYes,
        noShares: newNo,
        yesCost: newYesCost,
        noCost: newNoCost,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    const txRef = adminDb.collection(`users/${uid}/transactions`).doc();
    t.set(txRef, {
      type: "trade",
      amount: -cost,
      description: `Bought ${n} ${side.toUpperCase()} on: ${title}`,
      balance: newBalance,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    t.update(marketRef, { totalTrades: trades + 1 });

    const activityRef = adminDb.collection("activity").doc();
    t.set(activityRef, {
      type: "bet",
      uid,
      actorName,
      side,
      shares: n,
      cost,
      marketId,
      marketTitle: title,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      newBalance,
      yesShares: newYes,
      noShares: newNo,
      cost,
      marketTitle: title,
      price,
    };
  });

  return result;
}
