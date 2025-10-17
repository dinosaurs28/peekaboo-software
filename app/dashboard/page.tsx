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
import { collection, onSnapshot, orderBy, query, where, Timestamp, type DocumentData, type QuerySnapshot, type QueryConstraint } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/models";
import { listProducts } from "@/lib/products";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
  const { user, loading, role } = useAuth();

  // Dashboard stat card filters: default to today
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);

  // Dashboard stats (filtered by range)
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [newCustomers, setNewCustomers] = useState(0);
  const [costMap, setCostMap] = useState<Record<string, number>>({});

  // Compute ISO bounds based on selected dates
  const fromIso = useMemo(() => {
    if (!fromDate) return undefined;
    const d = new Date(fromDate);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [fromDate]);
  const toIso = useMemo(() => {
    if (!toDate) return undefined;
    const d = new Date(toDate);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, [toDate]);
  const customersFromTs = useMemo(() => (fromDate ? Timestamp.fromDate(new Date(`${fromDate}T00:00:00.000Z`)) : undefined), [fromDate]);
  const customersToTs = useMemo(() => (toDate ? Timestamp.fromDate(new Date(`${toDate}T23:59:59.999Z`)) : undefined), [toDate]);

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

  // Revenue and expenses from invoices within selected date range
  useEffect(() => {
    if (!db) return;
    const col = collection(db, COLLECTIONS.invoices);
    const constraints: QueryConstraint[] = [orderBy("issuedAt", "desc")];
    if (fromIso) constraints.push(where("issuedAt", ">=", fromIso));
    if (toIso) constraints.push(where("issuedAt", "<=", toIso));
    const q = query(col, ...constraints);
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
  }, [fromIso, toIso, costMap]);

  // New customers in selected range by createdAt timestamp
  useEffect(() => {
    if (!db) return;
    const col = collection(db, COLLECTIONS.customers);
    const constraints: QueryConstraint[] = [];
    if (customersFromTs) constraints.push(where("createdAt", ">=", customersFromTs));
    if (customersToTs) constraints.push(where("createdAt", "<=", customersToTs));
    const q = constraints.length ? query(col, ...constraints) : query(col);
    const unsub = onSnapshot(q, (snap) => setNewCustomers(snap.size));
    return () => unsub();
  }, [customersFromTs, customersToTs]);

  // Subtext helper for stat cards
  const rangeSubtext = useMemo(() => {
    if (fromDate && toDate && fromDate === toDate) return "Today";
    if (fromDate && toDate) return `${new Date(fromDate).toLocaleDateString()} – ${new Date(toDate).toLocaleDateString()}`;
    if (fromDate) return `From ${new Date(fromDate).toLocaleDateString()}`;
    if (toDate) return `Until ${new Date(toDate).toLocaleDateString()}`;
    return "All time";
  }, [fromDate, toDate]);

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
              <Card className="p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col">
                    <label className="text-xs text-muted-foreground">From</label>
                    <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs text-muted-foreground">To</label>
                    <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>
                  <button
                    className="h-9 px-4 rounded-md border text-sm font-medium hover:bg-muted"
                    onClick={() => { setFromDate(todayStr); setToDate(todayStr); }}
                  >Today</button>
                </div>
              </Card>
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard label="Revenue" value={`₹${revenue.toFixed(2)}`} subtext={rangeSubtext} icon={<DollarSign className="h-5 w-5" />} />
                <StatCard label="New Customers" value={newCustomers} subtext={rangeSubtext} icon={<Users className="h-5 w-5" />} />
                <StatCard label="Expenses" value={`₹${expenses.toFixed(2)}`} subtext={`COGS · ${rangeSubtext}`} icon={<Wallet className="h-5 w-5" />} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <RecentInvoices />
                </div>
                <div>
                  <LowStockAlerts />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
