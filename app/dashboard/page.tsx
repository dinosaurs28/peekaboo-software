"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { StatCard } from "@/components/dashboard/stat-card";
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts";
import { PosPanel } from "@/components/pos/pos-panel";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where, getDocs, type DocumentData, type QuerySnapshot, type QueryConstraint } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/models";
import { listProducts, observeLowStockProducts } from "@/lib/products";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const getTodayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function DashboardPage() {
  const { user, loading, role } = useAuth();
  const [isDataLoading, setIsDataLoading] = useState(true);

  const todayStr = useMemo(getTodayStr, []);
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);

  const [revenue, setRevenue] = useState(0);
  const [productMeta, setProductMeta] = useState<Record<string, { name: string; category?: string }>>({});
  const [topItems, setTopItems] = useState<Array<{ productId: string; name: string; category?: string; units: number; revenue: number }>>([]);
  const [revenueBuckets, setRevenueBuckets] = useState<Array<{ label: string; total: number }>>([]);
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  const { fromIso, toIso, rangeDays } = useMemo(() => {
    if (!fromDate || !toDate) return { fromIso: undefined, toIso: undefined, rangeDays: 0 };
    
    const fromD = new Date(fromDate);
    fromD.setHours(0, 0, 0, 0);
    const toD = new Date(toDate);
    toD.setHours(23, 59, 59, 999);

    const a = fromD.getTime();
    const b = toD.getTime();
    
    return {
      fromIso: fromD.toISOString(),
      toIso: toD.toISOString(),
      rangeDays: Math.max(1, Math.round((b - a) / 86400000))
    };
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/login";
    }
  }, [user, loading]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const prods = await listProducts();
        const meta: Record<string, { name: string; category?: string }> = {};
        
        prods.forEach((p) => {
          if (p.id) {
            meta[p.id] = { name: p.name, category: p.category };
          }
        });
        
        setProductMeta(meta);
      } catch (err) {
        console.error("Failed to load products:", err);
      }
    };

    loadProducts();
  }, []);

  useEffect(() => {
    const unsub = observeLowStockProducts((items) => setLowStockCount(items.length));
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  useEffect(() => {
    if (!db || !fromIso || !toIso) return;

    setIsDataLoading(true);
    const col = collection(db, COLLECTIONS.invoices);
    const constraints: QueryConstraint[] = [orderBy("issuedAt", "desc"), where("issuedAt", ">=", fromIso), where("issuedAt", "<=", toIso)];
    const q = query(col, ...constraints);

    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        let rev = 0;
        const agg = new Map<string, { productId: string; name: string; category?: string; units: number; revenue: number }>();
        const dayMap = new Map<string, number>();

        snap.docs.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          const grand = typeof data.grandTotal === 'number' ? data.grandTotal : Number(data.grandTotal ?? 0);
          const validGrand = Number.isFinite(grand) ? grand : 0;
          
          rev += validGrand;

          const issuedAt = typeof data.issuedAt === 'string' ? data.issuedAt : undefined;
          const dayKey = issuedAt?.slice(0, 10);
          if (dayKey) dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + validGrand);

          const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
          items.forEach((it) => {
            const pid = String(it.productId ?? "");
            if (!pid) return;

            const qty = typeof it.quantity === 'number' ? it.quantity : Number(it.quantity ?? 0);
            const validQty = Number.isFinite(qty) ? qty : 0;
            const unitPrice = typeof it.unitPrice === 'number' ? it.unitPrice : Number(it.unitPrice ?? 0);
            const disc = typeof it.discountAmount === 'number' ? it.discountAmount : Number(it.discountAmount ?? 0);
            const lineRevenue = Math.max(0, unitPrice * validQty - (Number.isFinite(disc) ? disc : 0));

            const name = typeof it.name === 'string' && it.name ? it.name : (productMeta[pid]?.name || pid);
            const category = productMeta[pid]?.category;

            const cur = agg.get(pid) || { productId: pid, name, category, units: 0, revenue: 0 };
            cur.units += validQty;
            cur.revenue += Number.isFinite(lineRevenue) ? lineRevenue : 0;
            if (productMeta[pid]?.name) cur.name = productMeta[pid].name;
            if (productMeta[pid]?.category) cur.category = productMeta[pid].category;
            agg.set(pid, cur);
          });
        });

        setRevenue(rev);
        setTopItems(Array.from(agg.values()).sort((a, b) => (b.units - a.units) || (b.revenue - a.revenue)));

        const buckets = Array.from(dayMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([k, v]) => ({ label: k, total: v }));
        setRevenueBuckets(buckets.length > 12 ? buckets.slice(-12) : buckets);
        setIsDataLoading(false);
      },
      (err) => {
        console.error("Revenue query error:", err);
        setIsDataLoading(false);
      }
    );

    return () => unsub();
  }, [fromIso, toIso, productMeta]);

  useEffect(() => {
    if (!db || !fromIso || !toIso) { setPrevRevenue(0); return; }

    const curStart = new Date(fromIso).getTime();
    const curEnd = new Date(toIso).getTime();
    const duration = curEnd - curStart + 1;
    const prevStart = new Date(curStart - duration).toISOString();
    const prevEnd = new Date(curStart - 1).toISOString();

    const col = collection(db, COLLECTIONS.invoices);
    const q = query(col, where("issuedAt", ">=", prevStart), where("issuedAt", "<=", prevEnd));

    getDocs(q)
      .then((snap) => {
        let prev = 0;
        snap.docs.forEach((d) => {
          const grand = typeof d.data().grandTotal === 'number' ? d.data().grandTotal : Number(d.data().grandTotal ?? 0);
          prev += Number.isFinite(grand) ? grand : 0;
        });
        setPrevRevenue(prev);
      })
      .catch(() => setPrevRevenue(0));
  }, [fromIso, toIso]);

  const rangeSubtext = useMemo(() => {
    if (fromDate && toDate && fromDate === toDate) return "Today";
    if (fromDate && toDate) return `${new Date(fromDate).toLocaleDateString()} – ${new Date(toDate).toLocaleDateString()}`;
    if (fromDate) return `From ${new Date(fromDate).toLocaleDateString()}`;
    if (toDate) return `Until ${new Date(toDate).toLocaleDateString()}`;
    return "All time";
  }, [fromDate, toDate]);

  const handleTodayClick = useCallback(() => {
    setFromDate(todayStr);
    setToDate(todayStr);
  }, [todayStr]);

  if (loading) {
    return (
      <div className="flex w-full h-screen bg-slate-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 p-8 space-y-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 bg-gray-200 rounded"></div>
              <div className="grid gap-6 md:grid-cols-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded"></div>)}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex w-full h-screen bg-slate-50">
      <div className="flex h-[100%]">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {role !== "admin" ? (
            <PosPanel />
          ) : (
            <div className="space-y-6 max-w-7xl">
              {/* Header */}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">Overview of your store&apos;s performance</p>
              </div>

              {/* Date Range Filters */}
              <Card className="p-6 bg-white border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-2">From Date</label>
                    <Input 
                      type="date" 
                      value={fromDate} 
                      onChange={(e) => setFromDate(e.target.value)} 
                      className="bg-white border-gray-300"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-2">To Date</label>
                    <Input 
                      type="date" 
                      value={toDate} 
                      onChange={(e) => setToDate(e.target.value)} 
                      className="bg-white border-gray-300"
                    />
                  </div>
                  <button
                    className="h-10 px-6 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                    onClick={handleTodayClick}
                  >
                    Today
                  </button>
                </div>
              </Card>

              {/* Stats Grid */}
              <div className="grid gap-6 md:grid-cols-3">
                {isDataLoading ? (
                  [...Array(3)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-lg animate-pulse"></div>)
                ) : (
                  <>
                    <StatCard 
                      label="Daily Sales" 
                      value={`₹${revenue.toLocaleString()}`} 
                      subtext={rangeSubtext} 
                      className="bg-white border border-gray-200" 
                    />
                    <StatCard 
                      label="Top Selling Item" 
                      value={topItems.length > 0 ? topItems[0].name : '—'} 
                      subtext={rangeSubtext} 
                      className="bg-white border border-gray-200" 
                    />
                    <StatCard 
                      label="Low Stock Items" 
                      value={lowStockCount} 
                      subtext="Products below threshold" 
                      className="bg-white border border-gray-200" 
                    />
                  </>
                )}
              </div>

              {/* Revenue Chart */}
              <Card className="bg-white p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Revenue</h2>
                {isDataLoading ? (
                  <div className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Revenue Over Time</p>
                      <p className="text-4xl font-bold text-gray-900 mt-2">₹{revenue.toLocaleString()}</p>
                      {(() => {
                        const pct = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : (revenue > 0 ? 100 : 0);
                        const pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
                        const label = rangeDays > 1 ? `Last ${rangeDays} Days` : 'vs Previous Day';
                        const cls = pct > 0 ? 'text-emerald-600' : pct < 0 ? 'text-rose-600' : 'text-gray-500';
                        return <p className={`text-sm font-medium mt-2 ${cls}`}>{label} {pctStr}</p>;
                      })()}
                    </div>

                    <div className="h-56 flex items-end gap-1 border-b border-gray-200 pb-4 overflow-x-auto">
                      {(() => {
                        const max = Math.max(1, ...revenueBuckets.map(b => b.total));
                        return revenueBuckets.length > 0 ? revenueBuckets.map((b) => {
                          const h = Math.max(8, Math.round((b.total / max) * 200));
                          return (
                            <div 
                              key={b.label} 
                              className="flex-1 min-w-8 bg-gradient-to-t from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500 rounded-t-md transition-colors cursor-pointer" 
                              style={{ height: `${h}px` }} 
                              title={`${b.label}: ₹${b.total.toLocaleString()}`} 
                            />
                          );
                        }) : <p className="text-gray-500 text-sm w-full text-center">No data available</p>;
                      })()}
                    </div>
                    {revenueBuckets.length > 0 && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{revenueBuckets[0]?.label}</span>
                        <span>{revenueBuckets[revenueBuckets.length - 1]?.label}</span>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Top Selling Items */}
              <Card className="bg-white p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Top Selling Items</h2>
                {isDataLoading ? (
                  <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded-md animate-pulse"></div>)}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Item Name</th>
                          <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Category</th>
                          <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700">Units Sold</th>
                          <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topItems.length === 0 ? (
                          <tr><td className="py-8 px-4 text-center text-gray-500" colSpan={4}>No sales in the selected range.</td></tr>
                        ) : (
                          topItems.slice(0, 10).map((it) => (
                            <tr key={it.productId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="py-4 px-4 text-sm font-medium text-gray-900">{it.name}</td>
                              <td className="py-4 px-4 text-sm text-blue-600">{it.category || '—'}</td>
                              <td className="py-4 px-4 text-sm text-gray-600 text-right">{it.units}</td>
                              <td className="py-4 px-4 text-sm font-medium text-gray-900 text-right">₹{it.revenue.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <LowStockAlerts />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
