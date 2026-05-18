import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "../firebase";

type AuthCtx = {
  user: User | null;
  balance: number;
  role: string;
  loading: boolean;
  signOutApp: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState(0);
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(true);
  const unsubUserDoc = useRef<(() => void) | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);

      // Cancel any previous user-doc listener
      if (unsubUserDoc.current) {
        unsubUserDoc.current();
        unsubUserDoc.current = null;
      }

      if (!u) {
        setBalance(0);
        setRole("user");
        setLoading(false);
        return;
      }

      // Live listener on the user doc — balance & role update instantly
      unsubUserDoc.current = onSnapshot(
        doc(db, "users", u.uid),
        (snap) => {
          const data = snap.exists() ? snap.data() : {};
          setBalance(typeof data.walletBalance === "number" ? data.walletBalance : 0);
          setRole(typeof data.role === "string" ? data.role : "user");
          setLoading(false);
        },
        () => {
          setBalance(0);
          setRole("user");
          setLoading(false);
        }
      );
    });
  }, []);

  const value = useMemo(
    (): AuthCtx => ({
      user,
      balance,
      role,
      loading,
      signOutApp: () => signOut(auth).then(() => {
        window.location.hash = "/";
      }),
    }),
    [user, balance, role, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
