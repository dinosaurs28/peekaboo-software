"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PosPanel } from "@/components/pos/pos-panel";
import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/components/auth/auth-provider";

export default function PosPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user || role !== "cashier") {
      router.push(!user ? "/login" : "/dashboard");
    }
  }, [loading, user, role, router]);

  if (loading || !user || role !== "cashier") {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <PosPanel />
        </main>
      </div>
    </div>
  );
}
