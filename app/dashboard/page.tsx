"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { DollarSign, Users, Wallet } from "lucide-react";
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts";
import { PosPanel } from "@/components/pos/pos-panel";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where, Timestamp, type DocumentData, type QuerySnapshot } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/models";
import { listProducts } from "@/lib/products";

export default function DashboardPage() {
  const { user, loading, role } = useAuth();

  // Dashboard stats (last 30 days)
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [newCustomers, setNewCustomers] = useState(0);
  const [costMap, setCostMap] = useState<Record<string, number>>({});

  const start = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);
  const startIso = useMemo(() => start.toISOString(), [start]);

  // If not authenticated (after loading), redirect to login
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/login";
    }
  }, [user, loading]);

  // Load product cost map once
  useEffect(() => {
    listProducts().then((prods) => {
      const m: Record<string, number> = {};
      prods.forEach((p) => { if (p.id) m[p.id] = p.costPrice ?? 0; });
      setCostMap(m);
    }).catch(() => undefined);
  }, []);

  // Revenue and expenses from invoices in last 30 days (using issuedAt ISO string)
  useEffect(() => {
    if (!db) return;
    const col = collection(db, COLLECTIONS.invoices);
    const q = query(col, where("issuedAt", ">=", startIso), orderBy("issuedAt", "desc"));
    const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      let rev = 0;
      let exp = 0;
      snap.docs.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        const grand = typeof data.grandTotal === 'number' ? data.grandTotal : Number(data.grandTotal ?? 0);
        rev += Number.isFinite(grand) ? grand : 0;
        // Approximate expenses (COGS) by summing product costPrice * quantity
        const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : [];
        items.forEach((it) => {
          const pid = String(it.productId ?? "");
          const qty = typeof it.quantity === 'number' ? it.quantity : Number(it.quantity ?? 0);
          const cost = costMap[pid] ?? 0;
          exp += cost * (Number.isFinite(qty) ? qty : 0);
        });
      });
      setRevenue(rev);
      setExpenses(exp);
    });
    return () => unsub();
  }, [startIso, costMap]);

  // New customers in last 30 days by createdAt timestamp
  useEffect(() => {
    if (!db) return;
    const col = collection(db, COLLECTIONS.customers);
    const q = query(col, where("createdAt", ">=", Timestamp.fromDate(start)));
    const unsub = onSnapshot(q, (snap) => setNewCustomers(snap.size));
    return () => unsub();
  }, [start]);

  // Early returns AFTER hooks to comply with rules-of-hooks
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
          {role === "cashier" ? (
            <PosPanel />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard label="Revenue" value={`₹${revenue.toFixed(2)}`} subtext="Last 30 days" icon={<DollarSign className="h-5 w-5" />} />
                <StatCard label="New Customers" value={newCustomers} subtext="Last 30 days" icon={<Users className="h-5 w-5" />} />
                <StatCard label="Expenses" value={`₹${expenses.toFixed(2)}`} subtext="COGS · Last 30 days" icon={<Wallet className="h-5 w-5" />} />
              </div>
              {role === "admin" && <LowStockAlerts />}
              <RecentInvoices />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
