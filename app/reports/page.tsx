"use client";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/components/auth/auth-provider";

export default function ReportsIndexPage() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-6 space-y-4">
          <h1 className="text-xl font-semibold">Reports</h1>
          <ul className="list-disc pl-6 text-sm">
            <li><Link className="underline" href="/reports/sales">Daily/Weekly/Monthly Sales</Link></li>
            <li><Link className="underline" href="/reports/payments">Payment Mode Report</Link></li>
            <li><Link className="underline" href="/reports/accounting-export">Accounting CSV Export</Link></li>
          </ul>
        </main>
      </div>
    </div>
  );
}
