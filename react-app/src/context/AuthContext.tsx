import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import { siteHomeHref } from "../lib/siteUrls";

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

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setBalance(0);
        setRole("user");
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const data = snap.exists() ? snap.data() : {};
        setBalance(typeof data.walletBalance === "number" ? data.walletBalance : 0);
        setRole(typeof data.role === "string" ? data.role : "user");
      } catch {
        setBalance(0);
        setRole("user");
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    (): AuthCtx => ({
      user,
      balance,
      role,
      loading,
      signOutApp: () => signOut(auth).then(() => {
        window.location.href = siteHomeHref();
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
