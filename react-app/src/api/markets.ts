import {
  collection, doc, getDoc, getDocs, limit as fsLimit, orderBy, query,
} from "firebase/firestore";
import { db } from "../firebase";
import { apiRequest } from "./client";

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

// ── Reads (kept on the client via Firestore SDK) ─────────────────────────────

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

// ── Mutations (via API server) ───────────────────────────────────────────────

export async function createMarket(input: {
  title: string; category: string; closesAt: string; yesPrice: number; imageUrl?: string | null;
}): Promise<MarketDoc> {
  return apiRequest<MarketDoc>("/markets", {
    method: "POST",
    body: input,
    auth: true,
  });
}

export async function deleteMarket(marketId: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/markets/${marketId}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function resolveMarket(marketId: string, outcome: "yes" | "no"): Promise<{ ok: boolean; outcome: "yes" | "no" }> {
  return apiRequest<{ ok: boolean; outcome: "yes" | "no" }>(`/markets/${marketId}/resolve`, {
    method: "POST",
    body: { outcome },
    auth: true,
  });
}

export async function claimPayout(marketId: string): Promise<{ newBalance: number; payout: number }> {
  return apiRequest<{ newBalance: number; payout: number }>(`/markets/${marketId}/claim`, {
    method: "POST",
    auth: true,
  });
}

export async function seedDemoMarkets(): Promise<{ ok: true; added: number }> {
  return apiRequest<{ ok: true; added: number }>("/markets/seed-demo", {
    method: "POST",
    auth: true,
  });
}

export async function patchMarketImages(): Promise<{ ok: true; updated: number }> {
  return apiRequest<{ ok: true; updated: number }>("/markets/patch-images", {
    method: "POST",
    auth: true,
  });
}

export async function clearMarketImages(): Promise<{ ok: true; cleared: number }> {
  return apiRequest<{ ok: true; cleared: number }>("/markets/clear-images", {
    method: "POST",
    auth: true,
  });
}
