"use client";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { DollarSign, Clock, Users, AlertTriangle } from "lucide-react";
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts";

export default function DashboardPage() {
  const { user, loading, role } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/login";
    }
  }, [user, loading]);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user) return null; // Redirect in progress

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total Revenue" value="$24,500" subtext="+12% from last month" icon={<DollarSign className="h-5 w-5" />} />
            <StatCard label="Pending Payments" value="3" icon={<Clock className="h-5 w-5" />} />
            <StatCard label="New Customers" value="15" icon={<Users className="h-5 w-5" />} />
            <StatCard label="Overdue Invoices" value="1" icon={<AlertTriangle className="h-5 w-5" />} />
          </div>
          {role === "admin" && <LowStockAlerts />}
          <RecentInvoices />
        </main>
      </div>
    </div>
  );
}
