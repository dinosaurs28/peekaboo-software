"use client";
import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/components/auth/auth-provider";

import {
  listInvoicesInRange,
  aggregateByPeriod,
  aggregatePaymentModes,
  buildAccountingCsv,
  aggregateInventoryMovement,
  type Period,
} from "@/lib/reports";

import { listProducts } from "@/lib/products";

/* ======================================================
   PAGE
====================================================== */

export default function ReportsIndexPage() {
  const { user, loading } = useAuth();
  type TabKey =
    | "sales"
    | "payments"
    | "profitloss"
    | "accounting"
    | "stock"
    | "movement";

  const [tab, setTab] = useState<TabKey>("sales");

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;

  return (
    <div className="flex h-screen w-full bg-gray-50 text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="border-b pb-2">
              <h1 className="text-4xl font-serif font-bold text-gray-900">Reports</h1>
              <p className="text-sm text-gray-500 mt-1">
                Analyze sales, payments, inventory and export accounting & GST
                data.
              </p>
            </div>

            {/* Tabs */}
            <nav className="border-b border-gray-200">
              <ul className="flex flex-wrap gap-6 text-sm">
                {(
                  [
                    { key: "sales", label: "Sales" },
                    { key: "payments", label: "Payments" },
                    { key: "profitloss", label: "Profit & Loss" },
                    { key: "accounting", label: "Accounting & GST Export" },
                    { key: "stock", label: "Stock" },
                    { key: "movement", label: "Movement" },
                  ] as Array<{ key: TabKey; label: string }>
                ).map((it) => (
                  <li key={it.key}>
                    <button
                      type="button"
                      onClick={() => setTab(it.key)}
                      className={`inline-block pb-3 transition-colors ${
                        tab === it.key
                          ? "text-sky-700 border-b-2 border-sky-600 font-medium"
                          : "text-sky-600 hover:text-sky-700 border-b-2 border-transparent"
                      }`}
                    >
                      {it.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Content */}
            <div className="pt-2">
              {tab === "sales" && <SalesInline />}
              {tab === "payments" && <PaymentsInline />}
              {tab === "profitloss" && <ProfitLossInline />}
              {tab === "accounting" && <AccountingInline />}
              {tab === "stock" && <StockInline />}
              {tab === "movement" && <MovementInline />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ======================================================
   HELPERS
====================================================== */

function toIsoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ======================================================
   DATE RANGE
====================================================== */

function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: Date;
  to: Date;
  onFromChange: (d: Date) => void;
  onToChange: (d: Date) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="text-sm text-gray-600">From</label>
        <input
          type="datetime-local"
          className="w-full h-9 rounded-md border px-2 text-sm"
          value={toIsoLocal(from)}
          onChange={(e) => onFromChange(new Date(e.target.value))}
        />
      </div>
      <div>
        <label className="text-sm text-gray-600">To</label>
        <input
          type="datetime-local"
          className="w-full h-9 rounded-md border px-2 text-sm"
          value={toIsoLocal(to)}
          onChange={(e) => onToChange(new Date(e.target.value))}
        />
      </div>
    </div>
  );
}

/* ======================================================
   SALES
====================================================== */

function SalesInline() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [period, setPeriod] = useState<Period>("day");
  const [rows, setRows] = useState<
    { period: string; invoices: number; total: number }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const invs = await listInvoicesInRange(
        from.toISOString(),
        to.toISOString()
      );
      setRows(aggregateByPeriod(invs, period));
    } finally {
      setLoading(false);
    }
  }, [from, to, period]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="space-y-4">
      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
      />
      <select
        className="h-9 rounded-md border px-2 text-sm"
        value={period}
        onChange={(e) => setPeriod(e.target.value as Period)}
      >
        <option value="day">Day</option>
        <option value="week">Week</option>
        <option value="month">Month</option>
      </select>
      <Table
        columns={["Period", "Invoices", "Total"]}
        rows={rows.map((r) => [r.period, r.invoices, `₹${r.total.toFixed(2)}`])}
        emptyText="No data"
      />
    </div>
  );
}

/* ======================================================
   PAYMENTS
====================================================== */

function PaymentsInline() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [rows, setRows] = useState<{ method: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const invs = await listInvoicesInRange(
        from.toISOString(),
        to.toISOString()
      );
      setRows(aggregatePaymentModes(invs));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
  }, []);

  return (
    <div className="space-y-4">
      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
      />
      <Table
        columns={["Payment Mode", "Amount"]}
        rows={rows.map((r) => [r.method, `₹${r.amount.toFixed(2)}`])}
        emptyText="No data"
      />
    </div>
  );
}

/* ======================================================
   PROFIT & LOSS (placeholder)
====================================================== */

function ProfitLossInline() {
  return (
    <div className="text-sm text-gray-500">
      Profit & Loss will be calculated using costPrice × quantity. (TODO:
      implement real COGS logic)
    </div>
  );
}

/* ======================================================
   ACCOUNTING & GST EXPORT
====================================================== */

function AccountingInline() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [busy, setBusy] = useState(false);

  const exportAccounting = async () => {
    setBusy(true);
    try {
      const csv = await buildAccountingCsv(
        from.toISOString(),
        to.toISOString()
      );
      downloadFile(
        csv,
        `accounting_${from.toISOString().slice(0, 10)}_${to
          .toISOString()
          .slice(0, 10)}.csv`,
        "text/csv"
      );
    } finally {
      setBusy(false);
    }
  };

  // const exportAll = async () => {
  //   setBusy(true);
  //   try {
  //     const { buildUnifiedExportCsv } = await import("@/lib/reports");
  //     const csv = await buildUnifiedExportCsv(
  //       from.toISOString(),
  //       to.toISOString()
  //     );
  //     downloadFile(
  //       csv,
  //       `ALL_REPORTS_${from.toISOString().slice(0, 10)}_${to
  //         .toISOString()
  //         .slice(0, 10)}.csv`,
  //       "text/csv"
  //     );
  //   } finally {
  //     setBusy(false);
  //   }
  // };

  async function exportAll() {
    const { buildGstr1Excel } = await import("@/lib/gst-xlsx");
    const blob = await buildGstr1Excel(from.toISOString(), to.toISOString());

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR1_${from.toISOString().slice(0, 10)}_${to
      .toISOString()
      .slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
      />

      <div className="flex gap-2">
        <button
          className="px-3 py-2 rounded-md border"
          onClick={exportAccounting}
          disabled={busy}
        >
          Export Accounting CSV
        </button>

        <button
          className="px-3 py-2 rounded-md bg-emerald-600 text-white"
          onClick={exportAll}
          disabled={busy}
        >
          Export ALL (Accounting + GST)
        </button>
      </div>
    </div>
  );
}

/* ======================================================
   STOCK
====================================================== */

function StockInline() {
  const [rows, setRows] = useState<
    { name: string; sku: string; stock: number; unitPrice: number }[]
  >([]);

  useEffect(() => {
    listProducts().then((ps) =>
      setRows(
        ps.map((p) => ({
          name: p.name,
          sku: p.sku,
          stock: p.stock,
          unitPrice: p.unitPrice,
        }))
      )
    );
  }, []);

  return (
    <Table
      columns={["Name", "SKU", "Stock", "Price"]}
      rows={rows.map((r) => [
        r.name,
        r.sku,
        r.stock,
        `₹${r.unitPrice.toFixed(2)}`,
      ])}
      emptyText="No products"
    />
  );
}

/* ======================================================
   MOVEMENT
====================================================== */

function MovementInline() {
  const [rows, setRows] = useState<any[]>([]);
  const [from, setFrom] = useState(new Date());
  const [to, setTo] = useState(new Date());

  useEffect(() => {
    aggregateInventoryMovement(from.toISOString(), to.toISOString()).then(
      setRows
    );
  }, []);

  return (
    <Table
      columns={["Product", "SKU", "Qty In", "Qty Out", "Net"]}
      rows={rows.map((r) => [r.name, r.sku, r.qtyIn, r.qtyOut, r.net])}
      emptyText="No movement"
    />
  );
}

/* ======================================================
   TABLE
====================================================== */

function Table({
  columns,
  rows,
  emptyText,
}: {
  columns: string[];
  rows: (string | number)[][];
  emptyText: string;
}) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 text-left">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i} className="border-t">
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-2">
                    {c}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center text-gray-500"
              >
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
