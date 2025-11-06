"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { StatCard } from "@/components/dashboard/stat-card";
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts";
import { PosPanel } from "@/components/pos/pos-panel";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where, getDocs, Timestamp, type DocumentData, type QuerySnapshot, type QueryConstraint } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/models";
import { listProducts, observeLowStockProducts } from "@/lib/products";
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
  // Removed unused: expenses, newCustomers
  const [costMap, setCostMap] = useState<Record<string, number>>({});
  const [productMeta, setProductMeta] = useState<Record<string, { name: string; category?: string }>>({});
  const [topItems, setTopItems] = useState<Array<{ productId: string; name: string; category?: string; units: number; revenue: number }>>([]);
  const [revenueBuckets, setRevenueBuckets] = useState<Array<{ label: string; total: number }>>([]);
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

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
  const rangeDays = useMemo(() => {
    if (!fromDate || !toDate) return 0;
    const a = new Date(`${fromDate}T00:00:00.000Z`).getTime();
    const b = new Date(`${toDate}T23:59:59.999Z`).getTime();
    return Math.max(1, Math.round((b - a) / 86400000));
  }, [fromDate, toDate]);
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
      const meta: Record<string, { name: string; category?: string }> = {};
      prods.forEach((p) => {
        if (p.id) {
          m[p.id] = p.costPrice ?? 0;
          meta[p.id] = { name: p.name, category: p.category };
        }
      });
      setCostMap(m);
      setProductMeta(meta);
    }).catch(() => undefined);
  }, []);

  // Low stock count (independent of date filters; always reflects current stock)
  useEffect(() => {
    const unsub = observeLowStockProducts((items) => setLowStockCount(items.length));
    return () => { if (typeof unsub === 'function') unsub(); };
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
      const agg = new Map<string, { productId: string; name: string; category?: string; units: number; revenue: number }>();
      const dayMap = new Map<string, number>();
      snap.docs.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        const grand = typeof data.grandTotal === 'number' ? data.grandTotal : Number(data.grandTotal ?? 0);
        rev += Number.isFinite(grand) ? grand : 0;
        // Approximate expenses (COGS) by summing product costPrice * quantity
        const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : [];
        // Bucket by day for simple bar chart
        const issuedAt = typeof data.issuedAt === 'string' ? data.issuedAt : undefined;
        const dayKey = issuedAt ? issuedAt.slice(0, 10) : undefined;
        if (dayKey) dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + (Number.isFinite(grand) ? grand : 0));
        items.forEach((it) => {
          const pid = String(it.productId ?? "");
          const qty = typeof it.quantity === 'number' ? it.quantity : Number(it.quantity ?? 0);
          // const cost = costMap[pid] ?? 0; // COGS not shown on UI currently

          // Aggregate Top Selling Items
          if (pid) {
            const name = typeof it.name === 'string' && it.name ? it.name : (productMeta[pid]?.name || pid);
            const category = productMeta[pid]?.category;
            const unitPrice = typeof it.unitPrice === 'number' ? it.unitPrice : Number(it.unitPrice ?? 0);
            const disc = typeof it.discountAmount === 'number' ? it.discountAmount : Number(it.discountAmount ?? 0);
            const lineRevenue = Math.max(0, unitPrice * (Number.isFinite(qty) ? qty : 0) - (Number.isFinite(disc) ? disc : 0));
            const cur = agg.get(pid) || { productId: pid, name, category, units: 0, revenue: 0 };
            cur.units += Number.isFinite(qty) ? qty : 0;
            cur.revenue += Number.isFinite(lineRevenue) ? lineRevenue : 0;
            // Preserve name/category from meta if available
            if (productMeta[pid]?.name) cur.name = productMeta[pid]!.name!;
            if (productMeta[pid]?.category) cur.category = productMeta[pid]!.category;
            agg.set(pid, cur);
          }
        });
      });
      setRevenue(rev);
      const list = Array.from(agg.values()).sort((a, b) => (b.units - a.units) || (b.revenue - a.revenue));
      setTopItems(list);
      // Prepare buckets (limit to last 12 buckets)
      const buckets = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => ({ label: k, total: v }));
      const limited = buckets.length > 12 ? buckets.slice(buckets.length - 12) : buckets;
      setRevenueBuckets(limited);
    });
    return () => unsub();
  }, [fromIso, toIso, costMap, productMeta]);

  // Previous period revenue for percentage change
  useEffect(() => {
    if (!db || !fromIso || !toIso) { setPrevRevenue(0); return; }
    const curStart = new Date(fromIso).getTime();
    const curEnd = new Date(toIso).getTime();
    const duration = curEnd - curStart + 1;
    const prevStart = new Date(curStart - duration);
    const prevEnd = new Date(curStart - 1);
    const prevFromIso = prevStart.toISOString();
    const prevToIso = prevEnd.toISOString();
    const col = collection(db, COLLECTIONS.invoices);
    const q = query(col, where("issuedAt", ">=", prevFromIso), where("issuedAt", "<=", prevToIso), orderBy("issuedAt", "desc"));
    getDocs(q).then((snap) => {
      let prev = 0;
      snap.docs.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        const grand = typeof data.grandTotal === 'number' ? data.grandTotal : Number(data.grandTotal ?? 0);
        prev += Number.isFinite(grand) ? grand : 0;
      });
      setPrevRevenue(prev);
    }).catch(() => setPrevRevenue(0));
  }, [fromIso, toIso]);

  // New customers in selected range by createdAt timestamp
  // Removed new customers stat (unused in UI)

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
    <div className="flex min-h-screen w-full bg-gray-50 text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-8 space-y-6">
          {/* Default any unknown role to cashier UI for safety */}
          {role !== "admin" ? (
            <PosPanel />
          ) : (
            <>
              {/* Header */}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">Overview of your store&apos;s performance</p>
              </div>

              {/* Date Filter */}
              <Card className="p-4 bg-white">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">From</label>
                    <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-white" />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">To</label>
                    <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-white" />
                  </div>
                  <button
                    className="h-9 px-4 rounded-md border border-gray-300 text-sm font-medium hover:bg-gray-50"
                    onClick={() => { setFromDate(todayStr); setToDate(todayStr); }}
                  >Today</button>
                </div>
              </Card>

              {/* Stats Row */}
              <div className="grid gap-6 md:grid-cols-3">
                <StatCard
                  label="Daily Sales"
                  value={`₹${revenue.toLocaleString()}`}
                  subtext={rangeSubtext}
                  className="bg-white"
                />
                <StatCard
                  label="Top Selling Item"
                  value={topItems.length > 0 ? topItems[0].name : '—'}
                  subtext={rangeSubtext}
                  className="bg-white"
                />
                <StatCard
                  label="Low Stock Items"
                  value={lowStockCount}
                  subtext={"Today"}
                  className="bg-white"
                />
              </div>

              {/* Revenue Chart Card */}
              <Card className="bg-white p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Revenue</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Revenue Over Time</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">₹{revenue.toLocaleString()}</p>
                    {(() => {
                      const pct = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : (revenue > 0 ? 100 : 0);
                      const pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
                      const label = rangeDays > 1 ? `Last ${rangeDays} Days` : 'Vs previous day';
                      const cls = pct > 0 ? 'text-emerald-600' : pct < 0 ? 'text-rose-600' : 'text-gray-500';
                      return <p className={`text-sm mt-1 ${cls}`}>{label} {pctStr}</p>;
                    })()}
                  </div>

                  {/* Simple bar chart wired to revenueBuckets */}
                  <div className="h-48 flex items-end gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
                    {(() => {
                      const max = Math.max(1, ...revenueBuckets.map(b => b.total));
                      return revenueBuckets.map((b) => {
                        const h = Math.max(4, Math.round((b.total / max) * 180));
                        return <div key={b.label} className="flex-1 min-w-6 bg-blue-100 rounded-t relative" style={{ height: `${h}px` }} title={`${b.label}: ₹${b.total.toLocaleString()}`}></div>;
                      });
                    })()}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>{revenueBuckets[0]?.label || ''}</span>
                    <span>{revenueBuckets[revenueBuckets.length - 1]?.label || ''}</span>
                  </div>
                </div>
              </Card>

              {/* Top Selling Items Table */}
              <Card className="bg-white p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Top Selling Items</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Item Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Category</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Units Sold</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topItems.length === 0 ? (
                        <tr>
                          <td className="py-6 px-4 text-sm text-gray-500" colSpan={4}>No sales in the selected range.</td>
                        </tr>
                      ) : (
                        topItems.slice(0, 10).map((it) => (
                          <tr key={it.productId} className="border-b border-gray-100">
                            <td className="py-3 px-4 text-sm text-gray-900">{it.name}</td>
                            <td className="py-3 px-4 text-sm text-blue-600">{it.category || '—'}</td>
                            <td className="py-3 px-4 text-sm text-gray-600 text-right">{it.units}</td>
                            <td className="py-3 px-4 text-sm text-gray-900 text-right">₹{it.revenue.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Low Stock placed at bottom */}
              <LowStockAlerts />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
