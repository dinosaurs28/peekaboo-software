"use client";

import { useEffect } from "react";
import { PosPanel } from "@/components/pos/pos-panel";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/components/auth/auth-provider";

export default function PosPage() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/auth/login";
    }
  }, [loading, user]);

  if (!user) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="flex min-h-screen w-full bg-gray-50 text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-6 md:p-8">
          <PosPanel />
        </main>
      </div>
    </div>
  );
}
