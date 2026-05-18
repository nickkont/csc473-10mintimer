import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export async function deposit(amount: number, paymentMethod: string): Promise<{ newBalance: number }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const uid = user.uid;
  const userRef = doc(db, "users", uid);
  const newBalance = await runTransaction(db, async (t) => {
    const snap = await t.get(userRef);
    const cur = snap.exists() ? Number(snap.data().walletBalance) || 0 : 0;
    const nb = parseFloat((cur + amount).toFixed(2));
    t.set(userRef, { walletBalance: nb }, { merge: true });
    const txRef = doc(collection(db, "users", uid, "transactions"));
    t.set(txRef, { type: "deposit", amount, description: `Deposit via ${paymentMethod}`, balance: nb, timestamp: serverTimestamp() });
    return nb;
  });
  return { newBalance };
}

export async function withdraw(amount: number): Promise<{ newBalance: number }> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const uid = user.uid;
  const userRef = doc(db, "users", uid);
  const newBalance = await runTransaction(db, async (t) => {
    const snap = await t.get(userRef);
    const cur = snap.exists() ? Number(snap.data().walletBalance) || 0 : 0;
    if (amount > cur) throw new Error("Insufficient balance.");
    const nb = parseFloat((cur - amount).toFixed(2));
    t.set(userRef, { walletBalance: nb }, { merge: true });
    const txRef = doc(collection(db, "users", uid, "transactions"));
    t.set(txRef, { type: "withdrawal", amount: -amount, description: "Withdrawal", balance: nb, timestamp: serverTimestamp() });
    return nb;
  });
  return { newBalance };
}
