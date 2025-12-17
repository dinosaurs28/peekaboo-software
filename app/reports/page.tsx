"use client";
import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/components/auth/auth-provider";
import { listInvoicesInRange, aggregateByPeriod, aggregatePaymentModes, buildAccountingCsv, aggregateInventoryMovement, type Period } from "@/lib/reports";
import { listProducts } from "@/lib/products";

export default function ReportsIndexPage() {
  const { user, loading } = useAuth();
  type TabKey = "sales" | "payments" | "accounting" | "stock" | "movement" | "profitloss";
  const [tab, setTab] = useState<TabKey>("sales");

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;

  return (
    <div className="flex h-screen w-full bg-gray-50 text-foreground">
      <div className="flex h-[100%]">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col md:ml-1">
        <div className="flex flex-col flex-1">
          <Topbar />
          <main className="flex-1 p-8 overflow-auto">
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
                <p className="text-sm text-gray-500 mt-1">Analyze your store's performance with detailed sales and profit/loss reports.</p>
              </div>

              <nav className="border-b border-gray-200">
                <ul className="flex flex-wrap gap-6 text-sm">
                  {([
                    { key: "sales", label: "Sales" },
                    { key: "payments", label: "Payments" },
                    { key: "profitloss", label: "Profit & Loss" },
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

              <div className="pt-2">
                {tab === 'sales' && <SalesInline />}
                {tab === 'payments' && <PaymentsInline />}
                {tab === 'profitloss' && <ProfitLossInline />}
                {tab === 'accounting' && <AccountingInline />}
                {tab === 'stock' && <StockInline />}
                {tab === 'movement' && <MovementInline />}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// ============= Helpers =============
function toIsoDateTimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

// Reusable date range filter
function DateRangeFilter({ from, to, onFromChange, onToChange, presets = ['7d', '30d', '90d'] }: {
  from: Date;
  to: Date;
  onFromChange: (d: Date) => void;
  onToChange: (d: Date) => void;
  presets?: ('7d' | '30d' | '90d')[];
}) {
  const setPreset = (preset: string) => {
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    if (preset === '7d') from.setDate(from.getDate() - 7);
    if (preset === '30d') from.setDate(from.getDate() - 30);
    if (preset === '90d') from.setDate(from.getDate() - 90);
    from.setHours(0, 0, 0, 0);
    onFromChange(from);
    onToChange(to);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-gray-600">From</label>
          <input type="datetime-local" className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={toIsoDateTimeLocal(from)} onChange={(e) => onFromChange(new Date(e.target.value))} />
        </div>
        <div>
          <label className="text-sm text-gray-600">To</label>
          <input type="datetime-local" className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={toIsoDateTimeLocal(to)} onChange={(e) => onToChange(new Date(e.target.value))} />
        </div>
        <div className="flex gap-1 items-end">
          {presets.map(p => (
            <button key={p} type="button" onClick={() => setPreset(p)} className="px-2 py-1 text-xs rounded border hover:bg-gray-100">{p}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============= Sales =============
function SalesInline() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return d; });
  const [to, setTo] = useState(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; });
  const [period, setPeriod] = useState<Period>('day');
  const [rows, setRows] = useState<{ period: string; invoices: number; total: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listInvoicesInRange(from.toISOString(), to.toISOString());
      setRows(aggregateByPeriod(data, period));
    } finally { setLoading(false); }
  }, [from, to, period]);

  useEffect(() => { run(); }, [run]);

  return (
    <div className="space-y-4">
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      <Table columns={["Period", "Invoices", "Total"]} rows={rows.map(r => [r.period, r.invoices, `₹${r.total.toFixed(2)}`])} emptyText="No data" />
    </div>
  );
}

// ============= Payments =============
function PaymentsInline() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0); return d; });
  const [to, setTo] = useState(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; });
  const [rows, setRows] = useState<{ method: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const invs = await listInvoicesInRange(from.toISOString(), to.toISOString());
      setRows(aggregatePaymentModes(invs));
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { run(); }, [run]);

  return (
    <div className="space-y-4">
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      <button className="px-3 py-2 rounded-md border bg-background" onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Run'}</button>
      <Table columns={["Payment Mode", "Amount"]} rows={rows.map(r => [r.method, `₹${r.amount.toFixed(2)}`])} emptyText="No data" />
    </div>
  );
}

// ============= Profit & Loss (NEW) =============
function ProfitLossInline() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0); return d; });
  const [to, setTo] = useState(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; });
  const [period, setPeriod] = useState<Period>('day');
  const [rows, setRows] = useState<{ period: string; revenue: number; costs: number; profit: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listInvoicesInRange(from.toISOString(), to.toISOString());
      const aggregated = aggregateByPeriod(data, period);
      // Mock P&L calculation - adapt to your data structure
      setRows(aggregated.map(row => ({
        period: row.period,
        revenue: row.total,
        costs: row.total * 0.6, // placeholder
        profit: row.total * 0.4,
      })));
    } finally { setLoading(false); }
  }, [from, to, period]);

  useEffect(() => { run(); }, [run]);

  return (
    <div className="space-y-4">
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      <Table columns={["Period", "Revenue", "Costs", "Profit"]} rows={rows.map(r => [r.period, `₹${r.revenue.toFixed(2)}`, `₹${r.costs.toFixed(2)}`, `₹${r.profit.toFixed(2)}`])} emptyText="No data" />
    </div>
  );
}

// ============= Accounting Export =============
function AccountingInline() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0); return d; });
  const [to, setTo] = useState(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; });
  const [busy, setBusy] = useState(false);

  const exportCsv = async () => {
    setBusy(true);
    try {
      const csv = await buildAccountingCsv(from.toISOString(), to.toISOString());
      downloadFile(csv, `accounting_${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`, 'text/csv');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      <button className="px-3 py-2 rounded-md border bg-background" onClick={exportCsv} disabled={busy}>{busy ? 'Preparing…' : 'Export CSV'}</button>
      <div className="text-sm text-gray-500">Generates a CSV compatible with accounting systems using your current product and invoice data.</div>
    </div>
  );
}

// ============= Stock =============
function StockInline() {
  const [rows, setRows] = useState<Array<{ id?: string; name: string; sku: string; unitPrice: number; stock: number }>>([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  useEffect(() => {
    listProducts().then((ps) => setRows(ps.map(p => ({ id: p.id, name: p.name, sku: p.sku, unitPrice: p.unitPrice, stock: p.stock })))).catch(() => undefined);
  }, []);

  const filtered = rows.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.sku.toLowerCase().includes(search.toLowerCase());
    const matchesStock = !lowStockOnly || r.stock < 10;
    return matchesSearch && matchesStock;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input type="text" placeholder="Search by name or SKU…" className="h-9 rounded-md border bg-background px-2 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only (&lt;10)
        </label>
      </div>
      <Table columns={["Name", "SKU", "Stock", "Price"]} rows={filtered.map(r => [r.name, r.sku, r.stock, `₹${r.unitPrice.toFixed(2)}`])} emptyText="No products" />
    </div>
  );
}

// ============= Movement =============
function MovementInline() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0); return d; });
  const [to, setTo] = useState(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; });
  const [rows, setRows] = useState<Array<{ productId: string; name: string; sku: string; category?: string; qtyIn: number; qtyOut: number; net: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const data = await aggregateInventoryMovement(from.toISOString(), to.toISOString());
      setRows(data);
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { run(); }, [run]);

  const filtered = rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.sku.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input type="text" placeholder="Search by name or SKU…" className="h-9 rounded-md border bg-background px-2 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="px-3 py-2 rounded-md border bg-background" onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Run'}</button>
      </div>
      <Table columns={["Product", "SKU", "Category", "Qty In", "Qty Out", "Net"]} rows={filtered.map(r => [r.name, r.sku, r.category || '—', r.qtyIn, r.qtyOut, r.net])} emptyText="No movements" />
    </div>
  );
}

// ============= Reusable Table Component =============
function Table({ columns, rows, emptyText }: { columns: string[]; rows: (string | number)[][]; emptyText: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            {columns.map(col => <th key={col} className="px-3 py-2">{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row, idx) => (
            <tr key={idx} className="border-t">
              {row.map((cell, cidx) => <td key={cidx} className="px-3 py-2">{cell}</td>)}
            </tr>
          )) : <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={columns.length}>{emptyText}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ============= Utilities =============
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
