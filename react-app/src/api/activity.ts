import { api } from "./client";

export interface ActivityItem {
  id: string;
  type: "bet" | "payout" | "resolve";
  actorName?: string;
  side?: "yes" | "no";
  shares?: number;
  cost?: number;
  amount?: number;
  outcome?: "yes" | "no";
  marketId: string;
  marketTitle: string;
  timestamp?: { seconds: number; nanoseconds?: number };
}

export async function listActivity(limit = 25): Promise<ActivityItem[]> {
  const { data } = await api.get<{ items: ActivityItem[] }>(`/activity?limit=${limit}`);
  return data.items;
}
