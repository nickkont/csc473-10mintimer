import {
  Timestamp, addDoc, collection, deleteDoc, doc,
  getDoc, getDocs, limit as fsLimit, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

export interface MarketDoc {
  id: string;
  title: string;
  category: string;
  imageUrl?: string;
  closesAt?: { seconds: number };
  status: string;
  outcome?: "yes" | "no";
  yesPrice: number;
  noPrice: number;
  totalTrades: number;
  createdAt?: { seconds: number };
}

export interface PriceTick {
  id: string;
  yesPrice: number;
  noPrice: number;
  timestamp?: { seconds: number; nanoseconds?: number };
}

export async function listMarkets(): Promise<MarketDoc[]> {
  const snap = await getDocs(query(collection(db, "markets"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MarketDoc));
}

export async function getMarket(marketId: string): Promise<MarketDoc> {
  const snap = await getDoc(doc(db, "markets", marketId));
  if (!snap.exists()) throw new Error("Market not found");
  return { id: snap.id, ...snap.data() } as MarketDoc;
}

export async function getPriceHistory(marketId: string, lim = 100): Promise<PriceTick[]> {
  const snap = await getDocs(
    query(collection(db, "markets", marketId, "priceHistory"), orderBy("timestamp", "asc"), fsLimit(lim))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PriceTick));
}

export async function createMarket(input: {
  title: string; category: string; closesAt: string; yesPrice: number;
}): Promise<MarketDoc> {
  const np = parseFloat((1 - input.yesPrice).toFixed(2));
  const ref = await addDoc(collection(db, "markets"), {
    title: input.title,
    category: input.category,
    closesAt: Timestamp.fromDate(new Date(input.closesAt)),
    yesPrice: input.yesPrice,
    noPrice: np,
    status: "open",
    totalTrades: 0,
    createdAt: serverTimestamp(),
  });
  await addDoc(collection(db, "markets", ref.id, "priceHistory"), {
    yesPrice: input.yesPrice, noPrice: np, timestamp: serverTimestamp(),
  });
  return getMarket(ref.id);
}

export async function deleteMarket(marketId: string): Promise<void> {
  await deleteDoc(doc(db, "markets", marketId));
}

export async function resolveMarket(marketId: string, outcome: "yes" | "no"): Promise<{ ok: boolean; outcome: "yes" | "no" }> {
  await updateDoc(doc(db, "markets", marketId), { status: "resolved", outcome });
  return { ok: true, outcome };
}

export async function claimPayout(marketId: string): Promise<{ newBalance: number; payout: number }> {
  const { auth, db: firestoreDb } = await import("../firebase");
  const { runTransaction, doc: fsDoc, collection: fsCol, serverTimestamp: fsST } = await import("firebase/firestore");
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const uid = user.uid;
  const userRef = fsDoc(firestoreDb, "users", uid);
  const posRef = fsDoc(firestoreDb, "users", uid, "positions", marketId);
  const marketRef = fsDoc(firestoreDb, "markets", marketId);
  return runTransaction(firestoreDb, async (t) => {
    const [uSnap, pSnap, mSnap] = await Promise.all([t.get(userRef), t.get(posRef), t.get(marketRef)]);
    if (!pSnap.exists()) throw new Error("Position not found.");
    if (!mSnap.exists()) throw new Error("Market not found.");
    const mdata = mSnap.data() as { status?: string; outcome?: string; title?: string };
    if (mdata.status !== "resolved" || !mdata.outcome) throw new Error("Market not resolved.");
    const posData = pSnap.data() as Record<string, unknown>;
    if (posData.payoutClaimed === true) throw new Error("Already claimed.");
    const outcome = mdata.outcome as "yes" | "no";
    const winShares = outcome === "yes" ? Number(posData.yesShares) || 0 : Number(posData.noShares) || 0;
    if (winShares <= 0) throw new Error("No winning shares.");
    const payout = parseFloat(winShares.toFixed(2));
    const bal = uSnap.exists() ? Number(uSnap.data()?.walletBalance) || 0 : 0;
    const nb = parseFloat((bal + payout).toFixed(2));
    t.update(userRef, { walletBalance: nb });
    t.set(posRef, { payoutClaimed: true, claimedAmount: payout, claimedAt: fsST() }, { merge: true });
    const txRef = fsDoc(fsCol(firestoreDb, "users", uid, "transactions"));
    t.set(txRef, { type: "payout", amount: payout, description: `Payout from: ${mdata.title ?? marketId}`, balance: nb, timestamp: fsST() });
    return { newBalance: nb, payout };
  });
}
