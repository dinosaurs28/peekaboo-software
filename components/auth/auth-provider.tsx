"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { listenToAuthState, ensureUserDocument, getUserRole } from "@/lib/auth";
import { User as FirebaseUser } from "firebase/auth";
import { UserRole } from "@/lib/models";
import { auth as firebaseAuth } from "@/lib/firebase";

interface AuthContextValue {
  user: FirebaseUser | null;
  role: UserRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseAuth) {
      // Firebase not initialized; skip auth wiring but render app
      setLoading(false);
      return;
    }
    const unsub = listenToAuthState(async (u) => {
      setUser(u);
      if (u) {
        try {
          // Ensure user doc exists, then fetch role
          await ensureUserDocument(u);
          const r = await getUserRole(u.uid);
          // Default conservatively to 'cashier' if role not found to avoid exposing admin UI
          setRole((r as UserRole | null) || 'cashier');
        } catch (err) {
          console.error("Failed to ensure user document or get role:", err);
          // On error, restrict UI to cashier capabilities by default
          setRole('cashier');
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
