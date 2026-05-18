import {
  collection, doc, runTransaction, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export interface PlaceBetResponse {
  newBalance: number; yesShares: number; noShares: number; cost: number;
}

export interface SellSharesResponse {
  newBalance: number; yesShares: number; noShares: number; proceeds: number;
}

export async function placeBet(input: {
  marketId: string; side: "yes" | "no"; shares: number;
}): Promise<PlaceBetResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const { marketId, side, shares: n } = input;
  const uid = user.uid;
  const userRef = doc(db, "users", uid);
  const marketRef = doc(db, "markets", marketId);
  const posRef = doc(db, "users", uid, "positions", marketId);

  return runTransaction(db, async (t) => {
    const [uSnap, pSnap, mSnap] = await Promise.all([t.get(userRef), t.get(posRef), t.get(marketRef)]);
    if (!mSnap.exists()) throw new Error("Market not found.");
    const mdata = mSnap.data() as { yesPrice: number; noPrice: number; totalTrades: number; title: string };
    const price = side === "yes" ? mdata.yesPrice : mdata.noPrice;
    const cost = parseFloat((price * n).toFixed(2));
    const bal = uSnap.exists() ? Number(uSnap.data()?.walletBalance) || 0 : 0;
    if (cost > bal) throw new Error("Insufficient balance.");
    const nb = parseFloat((bal - cost).toFixed(2));
    const posData = pSnap.exists() ? pSnap.data() : {};
    const newYes = Number(posData?.yesShares || 0) + (side === "yes" ? n : 0);
    const newNo  = Number(posData?.noShares  || 0) + (side === "no"  ? n : 0);
    // Accumulate cost basis per side so P/L can be computed
    const prevYesCost = Number(posData?.yesCost || 0);
    const prevNoCost  = Number(posData?.noCost  || 0);
    const newYesCost  = side === "yes" ? parseFloat((prevYesCost + cost).toFixed(2)) : prevYesCost;
    const newNoCost   = side === "no"  ? parseFloat((prevNoCost  + cost).toFixed(2)) : prevNoCost;

    t.update(userRef, { walletBalance: nb });
    t.set(posRef, {
      marketId, yesShares: newYes, noShares: newNo,
      yesCost: newYesCost, noCost: newNoCost,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    const txRef = doc(collection(db, "users", uid, "transactions"));
    t.set(txRef, { type: "trade", amount: -cost, description: `Bought ${n} ${side.toUpperCase()} on: ${mdata.title}`, balance: nb, timestamp: serverTimestamp() });
    t.update(marketRef, { totalTrades: (mdata.totalTrades || 0) + 1 });
    const snapRef = doc(collection(db, "markets", marketId, "priceHistory"));
    t.set(snapRef, { yesPrice: mdata.yesPrice, noPrice: mdata.noPrice, timestamp: serverTimestamp() });
    const actRef = doc(collection(db, "activity"));
    t.set(actRef, {
      type: "bet",
      actorName: user.displayName || user.email?.split("@")[0] || "Anonymous",
      actorUid: uid, side, shares: n, cost, marketId,
      marketTitle: mdata.title, timestamp: serverTimestamp(),
    });
    return { newBalance: nb, yesShares: newYes, noShares: newNo, cost };
  });
}

export async function sellShares(input: {
  marketId: string; side: "yes" | "no"; shares: number;
}): Promise<SellSharesResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const { marketId, side, shares: n } = input;
  const uid = user.uid;
  const userRef = doc(db, "users", uid);
  const marketRef = doc(db, "markets", marketId);
  const posRef = doc(db, "users", uid, "positions", marketId);

  return runTransaction(db, async (t) => {
    const [uSnap, pSnap, mSnap] = await Promise.all([t.get(userRef), t.get(posRef), t.get(marketRef)]);
    if (!mSnap.exists()) throw new Error("Market not found.");
    const mdata = mSnap.data() as { yesPrice: number; noPrice: number; totalTrades: number; title: string };
    const price = side === "yes" ? mdata.yesPrice : mdata.noPrice;
    const proceeds = parseFloat((price * n).toFixed(2));
    const bal = uSnap.exists() ? Number(uSnap.data()?.walletBalance) || 0 : 0;
    const nb = parseFloat((bal + proceeds).toFixed(2));
    const posData = pSnap.exists() ? pSnap.data() : {};
    const prevYes = Number(posData?.yesShares || 0);
    const prevNo  = Number(posData?.noShares  || 0);
    const newYes  = Math.max(0, prevYes - (side === "yes" ? n : 0));
    const newNo   = Math.max(0, prevNo  - (side === "no"  ? n : 0));
    // Reduce cost basis proportionally to shares sold
    const prevYesCost = Number(posData?.yesCost || 0);
    const prevNoCost  = Number(posData?.noCost  || 0);
    const newYesCost  = side === "yes" && prevYes > 0
      ? parseFloat(Math.max(0, prevYesCost * (newYes / prevYes)).toFixed(2))
      : prevYesCost;
    const newNoCost   = side === "no"  && prevNo  > 0
      ? parseFloat(Math.max(0, prevNoCost  * (newNo  / prevNo)).toFixed(2))
      : prevNoCost;

    t.update(userRef, { walletBalance: nb });
    t.set(posRef, {
      marketId, yesShares: newYes, noShares: newNo,
      yesCost: newYesCost, noCost: newNoCost,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    const txRef = doc(collection(db, "users", uid, "transactions"));
    t.set(txRef, { type: "trade", amount: proceeds, description: `Sold ${n} ${side.toUpperCase()} on: ${mdata.title}`, balance: nb, timestamp: serverTimestamp() });
    return { newBalance: nb, yesShares: newYes, noShares: newNo, proceeds };
  });
}
