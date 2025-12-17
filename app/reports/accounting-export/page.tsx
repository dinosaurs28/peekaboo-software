"use client";
import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/components/auth/auth-provider";
import { buildAccountingCsv, buildGstr1B2bCsv } from "@/lib/reports";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";

function iso(date: Date) { return date.toISOString(); }

export default function AccountingExportPage() {
  const [gstrCsv, setGstrCsv] = useState<string>("");
  const [loadingGstr, setLoadingGstr] = useState(false);
  const { user, loading } = useAuth();
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0); return iso(d); });
  const [to, setTo] = useState(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return iso(d); });
  const [category, setCategory] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("");
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [csv, setCsv] = useState<string>("");
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => { listCategories().then((c) => setCategories(c.filter(x => x.active))).catch(() => undefined); }, []);

  async function run() {
    setLoadingData(true);
    try {
      const text = await buildAccountingCsv(from, to, { category: category || undefined, paymentMode: paymentMode || undefined });
      setCsv(text);
    } finally { setLoadingData(false); }
  }

  function download(csvText: string, filename: string) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runGstrExport() {
    setLoadingGstr(true);
    try {
      const text = await buildGstr1B2bCsv(from, to);
      setGstrCsv(text);
    } finally {
      setLoadingGstr(false);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;

  return (
  <div className="flex min-h-screen w-full bg-background text-foreground">
    <Sidebar />
    <div className="flex flex-col flex-1">
      <Topbar />
      <main className="flex-1 p-6 space-y-4">
        <h1 className="text-xl font-semibold">Accounting CSV Export</h1>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-sm text-muted-foreground">From</label>
            <input type="datetime-local" className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={from.slice(0, 16)} onChange={(e) => setFrom(new Date(e.target.value).toISOString())} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">To</label>
            <input type="datetime-local" className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={to.slice(0, 16)} onChange={(e) => setTo(new Date(e.target.value).toISOString())} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Category</label>
            <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Payment Mode</label>
            <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              <option value="">All</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="wallet">Wallet</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="px-3 py-2 rounded-md border bg-background w-full" onClick={run} disabled={loadingData}>{loadingData ? 'Building…' : 'Build CSV'}</button>
          </div>
        </div>
        {csv && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Accounting CSV Preview (first 20 rows)</div>
            <pre className="border rounded-md p-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap">{csv.split('\n').slice(0, 21).join('\n')}</pre>
            <div className="flex gap-2">
              <button className="px-3 py-2 rounded-md border bg-emerald-600 text-white" onClick={() => download(csv, `accounting_${from.slice(0, 10)}_${to.slice(0, 10)}.csv`)}>Download CSV</button>
            </div>
          </div>
        )}
        <div className="mt-8">
          <h2 className="text-md font-semibold mb-2">GSTR-1 B2B Export</h2>
          <button className="px-3 py-2 rounded-md border bg-blue-600 text-white" onClick={runGstrExport} disabled={loadingGstr}>{loadingGstr ? 'Building…' : 'Build GSTR-1 B2B CSV'}</button>
          {gstrCsv && (
            <div className="space-y-2 mt-2">
              <div className="text-sm text-muted-foreground">GSTR-1 B2B CSV Preview (first 20 rows)</div>
              <pre className="border rounded-md p-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap">{gstrCsv.split('\n').slice(0, 21).join('\n')}</pre>
              <div className="flex gap-2">
                <button className="px-3 py-2 rounded-md border bg-emerald-600 text-white" onClick={() => download(gstrCsv, `GSTR1_B2B_${from.slice(0, 10)}_${to.slice(0, 10)}.csv`)}>Download GSTR-1 B2B CSV</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  </div>
);
}
