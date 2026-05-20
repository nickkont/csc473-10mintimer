import { signOut } from "firebase/auth";
import {
  collection, doc, getDoc, getDocs,
  limit as fsLimit, orderBy, query,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { apiRequest } from "./client";

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

// ── Reads (kept on the client via Firestore SDK) ─────────────────────────────

export async function getMe(): Promise<MeDoc> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const snap = await getDoc(doc(db, "users", user.uid));
  return { uid: user.uid, ...(snap.exists() ? snap.data() : {}) } as MeDoc;
}

export async function getMyPositions(): Promise<PositionDoc[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const snap = await getDocs(collection(db, "users", user.uid, "positions"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PositionDoc));
}

export async function getMyTransactions(lim = 50): Promise<TransactionDoc[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const snap = await getDocs(
    query(collection(db, "users", user.uid, "transactions"), orderBy("timestamp", "desc"), fsLimit(lim))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TransactionDoc));
}

export async function getPublicProfile(uid: string): Promise<PublicProfile> {
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.exists() ? snap.data() : {};
  return {
    uid,
    firstName: String(data.firstName ?? ""),
    lastName: String(data.lastName ?? ""),
    username: String(data.username ?? ""),
    bio: String(data.bio ?? ""),
    role: String(data.role ?? "user"),
  };
}

// ── Mutations (via API server) ───────────────────────────────────────────────

export async function createMe(input: { email: string; displayName: string }): Promise<void> {
  await apiRequest<{ uid: string }>("/users", {
    method: "POST",
    body: input,
    auth: true,
  });
}

export async function updateMe(updates: Partial<Omit<MeDoc, "uid" | "walletBalance" | "role">>): Promise<void> {
  await apiRequest<{ ok: true; updated: string[] }>("/users/me", {
    method: "PATCH",
    body: updates,
    auth: true,
  });
}

export async function deleteMe(): Promise<void> {
  if (!auth.currentUser) throw new Error("Not authenticated");
  await apiRequest<{ ok: true }>("/users/me", { method: "DELETE", auth: true });
  await signOut(auth);
}

// ── Admin: user management ───────────────────────────────────────────────────

export interface AdminUserRow {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  banned: boolean;
  approved: boolean;
  walletBalance: number;
  isBot: boolean;
}

export async function listUsers(): Promise<AdminUserRow[]> {
  const res = await apiRequest<{ users: AdminUserRow[] }>("/users", {
    method: "GET",
    auth: true,
  });
  return res.users;
}

export async function banUser(uid: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/users/${uid}/ban`, { method: "POST", auth: true });
}

export async function unbanUser(uid: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/users/${uid}/unban`, { method: "POST", auth: true });
}

export async function setUserRole(uid: string, role: "admin" | "user"): Promise<void> {
  await apiRequest<{ ok: true; role: string }>(`/users/${uid}/role`, {
    method: "POST",
    body: { role },
    auth: true,
  });
}

export async function approveUser(uid: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/users/${uid}/approve`, { method: "POST", auth: true });
}

export async function unapproveUser(uid: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/users/${uid}/unapprove`, { method: "POST", auth: true });
}
