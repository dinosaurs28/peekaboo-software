"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/components/auth/auth-provider";
import { listInvoicesInRange, aggregateByPeriod, aggregatePaymentModes, buildAccountingCsv, aggregateInventoryMovement, type Period } from "@/lib/reports";
import { listProducts } from "@/lib/products";

export default function ReportsIndexPage() {
  const { user, loading } = useAuth();
  // Inline tabs like Settings
  type TabKey = "sales" | "payments" | "accounting" | "stock" | "movement";
  const [tab, setTab] = useState<TabKey>("sales");
  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;
  return (
    <div className="flex min-h-screen w-full bg-gray-50 text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
              <p className="text-sm text-gray-500 mt-1">Analyze your store’s performance with detailed sales and profit/loss reports.</p>
            </div>

            {/* Tabbed navigation like Settings; renders inline below */}
            <nav className="border-b border-gray-200">
              <ul className="flex flex-wrap gap-6 text-sm">
                {([
                  { key: "sales", label: "Sales" },
                  { key: "payments", label: "Payments" },
                  { key: "accounting", label: "Accounting Export" },
                  { key: "stock", label: "Stock" },
                  { key: "movement", label: "Movement" },
                ] as Array<{ key: TabKey; label: string }>).map((it) => (
                  <li key={it.key}>
                    <button
                      type="button"
                      onClick={() => setTab(it.key)}
                      className={`inline-block pb-3 transition-colors ${tab === it.key ? 'text-sky-700 border-b-2 border-sky-600 font-medium' : 'text-sky-600 hover:text-sky-700 border-b-2 border-transparent'}`}
                      aria-pressed={tab === it.key}
                    >
                      {it.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Active tab content (inline) */}
            <div className="pt-2">
              {tab === 'sales' && <SalesInline />}
              {tab === 'payments' && <PaymentsInline />}
              {tab === 'accounting' && <AccountingInline />}
              {tab === 'stock' && <StockInline />}
              {tab === 'movement' && <MovementInline />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Helpers
function toIsoDateTimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

// Inline Sales
function SalesInline() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return d; });
  const [to, setTo] = useState(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; });
  const [period, setPeriod] = useState<Period>('day');
  const [rows, setRows] = useState<{ period: string; invoices: number; total: number }[]>([]);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    try {
      const data = await listInvoicesInRange(from.toISOString(), to.toISOString());
      setRows(aggregateByPeriod(data, period));
    } finally { setLoading(false); }
  }
  useEffect(() => { run(); }, []);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-sm text-gray-600">From</label>
          <input type="datetime-local" className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={toIsoDateTimeLocal(from)} onChange={(e) => setFrom(new Date(e.target.value))} />
        </div>
        <div>
          <label className="text-sm text-gray-600">To</label>
          <input type="datetime-local" className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={toIsoDateTimeLocal(to)} onChange={(e) => setTo(new Date(e.target.value))} />
        </div>
        <div>
          <label className="text-sm text-gray-600">Group by</label>
          <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="px-3 py-2 rounded-md border bg-background w-full" onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Run'}</button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Period</th>
              <th className="px-3 py-2">Invoices</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.period} className="border-t">
                <td className="px-3 py-2">{r.period}</td>
                <td className="px-3 py-2">{r.invoices}</td>
                <td className="px-3 py-2 text-right">₹{r.total.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={3}>No data</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Inline Payments
function PaymentsInline() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0); return d; });
  const [to, setTo] = useState(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; });
  const [rows, setRows] = useState<{ method: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    try {
      const invs = await listInvoicesInRange(from.toISOString(), to.toISOString());
      setRows(aggregatePaymentModes(invs));
    } finally { setLoading(false); }
  }
  useEffect(() => { run(); }, []);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-gray-600">From</label>
          <input type="datetime-local" className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={toIsoDateTimeLocal(from)} onChange={(e) => setFrom(new Date(e.target.value))} />
        </div>
        <div>
          <label className="text-sm text-gray-600">To</label>
          <input type="datetime-local" className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={toIsoDateTimeLocal(to)} onChange={(e) => setTo(new Date(e.target.value))} />
        </div>
        <div className="flex items-end">
          <button className="px-3 py-2 rounded-md border bg-background w-full" onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Run'}</button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Payment Mode</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.method} className="border-t">
                <td className="px-3 py-2 capitalize">{r.method}</td>
                <td className="px-3 py-2 text-right">₹{r.amount.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={2}>No data</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Inline Accounting Export
function AccountingInline() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0); return d; });
  const [to, setTo] = useState(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; });
  const [busy, setBusy] = useState(false);
  async function exportCsv() {
    setBusy(true);
    try {
      const csv = await buildAccountingCsv(from.toISOString(), to.toISOString());
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accounting_${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-gray-600">From</label>
          <input type="datetime-local" className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={toIsoDateTimeLocal(from)} onChange={(e) => setFrom(new Date(e.target.value))} />
        </div>
        <div>
          <label className="text-sm text-gray-600">To</label>
          <input type="datetime-local" className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={toIsoDateTimeLocal(to)} onChange={(e) => setTo(new Date(e.target.value))} />
        </div>
        <div className="flex items-end">
          <button className="px-3 py-2 rounded-md border bg-background w-full" onClick={exportCsv} disabled={busy}>{busy ? 'Preparing…' : 'Export CSV'}</button>
        </div>
      </div>
      <div className="text-sm text-gray-500">Generates a CSV compatible with accounting systems using your current product and invoice data.</div>
    </div>
  );
}

// Inline Stock
function StockInline() {
  const [rows, setRows] = useState<Array<{ id?: string; name: string; sku: string; unitPrice: number; stock: number }>>([]);
  useEffect(() => { listProducts().then((ps) => setRows(ps.map(p => ({ id: p.id, name: p.name, sku: p.sku, unitPrice: p.unitPrice, stock: p.stock })))).catch(() => undefined); }, []);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">SKU</th>
            <th className="px-3 py-2">Stock</th>
            <th className="px-3 py-2 text-right">Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id || r.sku} className="border-t">
              <td className="px-3 py-2">{r.name}</td>
              <td className="px-3 py-2">{r.sku}</td>
              <td className="px-3 py-2">{r.stock}</td>
              <td className="px-3 py-2 text-right">₹{r.unitPrice.toFixed(2)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>No products</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// Inline Movement
function MovementInline() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0); return d; });
  const [to, setTo] = useState(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; });
  const [rows, setRows] = useState<Array<{ productId: string; name: string; sku: string; category?: string; qtyIn: number; qtyOut: number; net: number }>>([]);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    try {
      const data = await aggregateInventoryMovement(from.toISOString(), to.toISOString());
      setRows(data);
    } finally { setLoading(false); }
  }
  useEffect(() => { run(); }, []);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-gray-600">From</label>
          <input type="datetime-local" className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={toIsoDateTimeLocal(from)} onChange={(e) => setFrom(new Date(e.target.value))} />
        </div>
        <div>
          <label className="text-sm text-gray-600">To</label>
          <input type="datetime-local" className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={toIsoDateTimeLocal(to)} onChange={(e) => setTo(new Date(e.target.value))} />
        </div>
        <div className="flex items-end">
          <button className="px-3 py-2 rounded-md border bg-background w-full" onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Run'}</button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Qty In</th>
              <th className="px-3 py-2 text-right">Qty Out</th>
              <th className="px-3 py-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.productId} className="border-t">
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.sku}</td>
                <td className="px-3 py-2">{r.category || '—'}</td>
                <td className="px-3 py-2 text-right">{r.qtyIn}</td>
                <td className="px-3 py-2 text-right">{r.qtyOut}</td>
                <td className="px-3 py-2 text-right">{r.net}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={6}>No movements</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
