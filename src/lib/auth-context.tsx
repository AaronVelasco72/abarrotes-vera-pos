"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User, signOut as fbSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseConfigured, getFirebase } from "./firebase";

export type Role = "cashier" | "admin";

type AuthState = {
  user: User | null;
  role: Role | null;
  loading: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState>({
  user: null,
  role: null,
  loading: true,
  configured: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(fb.auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(fb.db, "users", u.uid));
          const r = (snap.data()?.role as Role) ?? "cashier";
          setRole(r);
        } catch {
          setRole("cashier");
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        user,
        role,
        loading,
        configured: firebaseConfigured,
        signOut: async () => {
          const fb = getFirebase();
          if (fb) await fbSignOut(fb.auth);
        },
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
