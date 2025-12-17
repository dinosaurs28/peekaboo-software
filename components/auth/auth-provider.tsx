"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

const DEFAULT_ROLE: UserRole = "cashier";

const ROUTES = {
  LOGIN: "/login",
  ADMIN_HOME: "/dashboard",
  CASHIER_HOME: "/pos",
  CASHIER_ALLOWED: ["/pos", "/invoices", "/settings/barcodes/print"],
} as const;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }

    const unsub = listenToAuthState(async (u) => {
      setUser(u);
      if (u) {
        try {
          await ensureUserDocument(u);
          const userRole = await getUserRole(u.uid);
          setRole((userRole as UserRole) || DEFAULT_ROLE);
        } catch (err) {
          console.error("Auth error:", err);
          setRole(DEFAULT_ROLE);
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

export const AuthRedirector: React.FC = () => {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (pathname !== ROUTES.LOGIN) {
        router.replace(ROUTES.LOGIN);
      }
      return;
    }

    if (role === "admin" && ["/", ROUTES.LOGIN].includes(pathname)) {
      router.replace(ROUTES.ADMIN_HOME);
      return;
    }

    if (role === "cashier") {
      if (pathname === ROUTES.LOGIN) {
        router.replace(ROUTES.CASHIER_HOME);
        return;
      }
      const isAllowed = ROUTES.CASHIER_ALLOWED.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
      );
      if (!isAllowed) {
        router.replace(ROUTES.CASHIER_HOME);
      }
    }
  }, [user, role, loading, router, pathname]);

  return null;
};
