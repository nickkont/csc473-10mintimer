import { api } from "./client";

export interface PlaceBetResponse {
  newBalance: number;
  yesShares: number;
  noShares: number;
  cost: number;
}

export async function placeBet(input: {
  marketId: string;
  side: "yes" | "no";
  shares: number;
}): Promise<PlaceBetResponse> {
  const { data } = await api.post<PlaceBetResponse>("/bets", input);
  return data;
}

export interface SellSharesResponse {
  newBalance: number;
  yesShares: number;
  noShares: number;
  proceeds: number;
}

export async function sellShares(input: {
  marketId: string;
  side: "yes" | "no";
  shares: number;
}): Promise<SellSharesResponse> {
  const { data } = await api.post<SellSharesResponse>("/bets/sell", input);
  return data;
}
