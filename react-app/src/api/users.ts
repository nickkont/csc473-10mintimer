import { deleteUser } from "firebase/auth";
import {
  collection, deleteDoc, doc, getDoc, getDocs,
  limit as fsLimit, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";

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

export async function createMe(input: { email: string; displayName: string }): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await setDoc(doc(db, "users", user.uid), {
    email: input.email,
    displayName: input.displayName,
    walletBalance: 0,
    role: "user",
    createdAt: serverTimestamp(),
  }, { merge: true });
}

export async function updateMe(updates: Partial<Omit<MeDoc, "uid" | "walletBalance" | "role">>): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(db, "users", user.uid), updates as any);
}

export async function deleteMe(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  await deleteDoc(doc(db, "users", user.uid));
  await deleteUser(user);
}
