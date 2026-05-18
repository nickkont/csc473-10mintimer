import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../firebase";

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

export async function listActivity(lim = 25): Promise<ActivityItem[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "activity"), orderBy("timestamp", "desc"), fsLimit(lim))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityItem));
  } catch {
    return [];
  }
}
