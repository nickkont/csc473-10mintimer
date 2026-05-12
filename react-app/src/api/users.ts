import { api } from "./client";

export interface MeDoc {
  uid: string;
  walletBalance?: number;
  role?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  email?: string;
  [k: string]: unknown;
}

export interface PositionDoc {
  id: string;
  marketId: string;
  yesShares: number;
  noShares: number;
  yesCost?: number;
  noCost?: number;
  payoutClaimed?: boolean;
  claimedAmount?: number;
}

export interface TransactionDoc {
  id: string;
  type: string;
  amount: number;
  description: string;
  balance?: number;
  timestamp?: { seconds: number };
}

export interface PublicProfile {
  uid: string;
  firstName: string;
  lastName: string;
  username: string;
  bio: string;
  role: string;
}

export async function getMe(): Promise<MeDoc> {
  const { data } = await api.get<MeDoc>("/users/me");
  return data;
}

export async function getMyPositions(): Promise<PositionDoc[]> {
  const { data } = await api.get<{ positions: PositionDoc[] }>("/users/me/positions");
  return data.positions;
}

export async function getMyTransactions(limit = 50): Promise<TransactionDoc[]> {
  const { data } = await api.get<{ transactions: TransactionDoc[] }>(`/users/me/transactions?limit=${limit}`);
  return data.transactions;
}

export async function getPublicProfile(uid: string): Promise<PublicProfile> {
  const { data } = await api.get<PublicProfile>(`/users/${uid}/profile`);
  return data;
}

export async function createMe(input: { email: string; displayName: string }): Promise<void> {
  await api.post("/users", input);
}

export async function updateMe(updates: Partial<Omit<MeDoc, "uid" | "walletBalance" | "role">>): Promise<void> {
  await api.patch("/users/me", updates);
}

export async function deleteMe(): Promise<void> {
  await api.delete("/users/me");
}
