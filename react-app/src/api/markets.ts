import { api } from "./client";

export interface MarketDoc {
  id: string;
  title: string;
  category: string;
  closesAt?: { seconds: number };
  status: string;
  outcome?: "yes" | "no";
  yesPrice: number;
  noPrice: number;
  totalTrades: number;
  createdAt?: { seconds: number };
}

export async function listMarkets(): Promise<MarketDoc[]> {
  const { data } = await api.get<{ markets: MarketDoc[] }>("/markets");
  return data.markets;
}

export async function getMarket(marketId: string): Promise<MarketDoc> {
  const { data } = await api.get<MarketDoc>(`/markets/${marketId}`);
  return data;
}

export interface PriceTick {
  id: string;
  yesPrice: number;
  noPrice: number;
  timestamp?: { seconds: number; nanoseconds?: number };
}

export async function getPriceHistory(marketId: string, limit = 100): Promise<PriceTick[]> {
  const { data } = await api.get<{ history: PriceTick[] }>(`/markets/${marketId}/history?limit=${limit}`);
  return data.history;
}

export async function createMarket(input: {
  title: string;
  category: string;
  closesAt: string;
  yesPrice: number;
}): Promise<MarketDoc> {
  const { data } = await api.post<MarketDoc>("/markets", input);
  return data;
}

export async function deleteMarket(marketId: string): Promise<void> {
  await api.delete(`/markets/${marketId}`);
}

export async function resolveMarket(marketId: string, outcome: "yes" | "no"): Promise<{ ok: boolean; outcome: "yes" | "no" }> {
  const { data } = await api.post<{ ok: boolean; outcome: "yes" | "no" }>(`/markets/${marketId}/resolve`, { outcome });
  return data;
}

export async function claimPayout(marketId: string): Promise<{ newBalance: number; payout: number }> {
  const { data } = await api.post<{ newBalance: number; payout: number }>(`/markets/${marketId}/claim`);
  return data;
}
