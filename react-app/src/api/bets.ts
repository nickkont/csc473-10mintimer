import { apiRequest } from "./client";

export interface PlaceBetResponse {
  newBalance: number; yesShares: number; noShares: number; cost: number;
}

export interface SellSharesResponse {
  newBalance: number; yesShares: number; noShares: number; proceeds: number;
  realizedPL?: number;
}

export async function placeBet(input: {
  marketId: string; side: "yes" | "no"; shares: number;
}): Promise<PlaceBetResponse> {
  return apiRequest<PlaceBetResponse>("/bets", {
    method: "POST",
    body: input,
    auth: true,
  });
}

export async function sellShares(input: {
  marketId: string; side: "yes" | "no"; shares: number;
}): Promise<SellSharesResponse> {
  return apiRequest<SellSharesResponse>("/bets/sell", {
    method: "POST",
    body: input,
    auth: true,
  });
}
