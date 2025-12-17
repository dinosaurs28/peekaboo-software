"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { InvoiceDoc } from "@/lib/models";
import { observeInvoices, type InvoiceFilters } from "@/lib/invoices";
import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Input } from "@/components/ui/input";

const STATUS_OPTIONS = ["paid", "partial", "unpaid", "void"] as const;

const STATUS_BADGE_CLASS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  partial: "bg-amber-100 text-amber-700",
  unpaid: "bg-red-100 text-red-700",
  void: "bg-slate-100 text-slate-700",
};

const getStatusBadgeClass = (status: string): string =>
  STATUS_BADGE_CLASS[status] || "bg-slate-100 text-slate-700";

export default function InvoicesPage() {
  const { user, role, loading } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [status, setStatus] = useState<InvoiceDoc["status"] | "">("");
  const [cashierEmail, setCashierEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!user) return;

    const filters: InvoiceFilters = {};

    if (role === "cashier") {
      filters.cashierUserId = user.uid;
    } else {
      if (status) filters.status = status as InvoiceDoc["status"];
      if (cashierEmail) filters.cashierNameEq = cashierEmail.trim();
      if (from) filters.issuedFromIso = new Date(from).toISOString();
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filters.issuedToIso = end.toISOString();
      }
    }

    const unsub = observeInvoices((list) => {
      setInvoices(list);
      setInvoicesLoading(false);
    }, filters);

    return () => unsub();
  }, [user, role, status, cashierEmail, from, to]);

  const handleClearFilters = () => {
    setFrom("");
    setTo("");
    setStatus("");
    setCashierEmail("");
  };

  const handleNavigateToInvoice = (id: string) => {
    window.location.href = `/invoices/${id}`;
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="flex w-full h-screen bg-slate-50">
      <div className="flex h-[100%]">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden md:ml-1">
        <Topbar />
        <main className="flex-1 overflow-auto p-6 md:p-8 space-y-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
            <p className="text-sm text-slate-600">
              Manage and track all your invoices
            </p>
          </div>

          {role === "admin" && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">
                Filters
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">
                    From Date
                  </label>
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">
                    To Date
                  </label>
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as InvoiceDoc["status"] | "")
                    }
                  >
                    <option value="">All Status</option>
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">
                    Cashier Email
                  </label>
                  <Input
                    placeholder="cashier@example.com"
                    value={cashierEmail}
                    onChange={(e) => setCashierEmail(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  className="h-9 px-4 rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <p className="text-sm font-medium text-slate-700">
                {invoicesLoading
                  ? "Loading invoices…"
                  : `${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"}`}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                      Invoice ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">
                      Subtotal
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">
                      Discount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                      Cashier
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => handleNavigateToInvoice(inv.id!)}
                    >
                      <td className="px-6 py-4 font-semibold text-blue-600 hover:underline">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {new Date(inv.issuedAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-700">
                        ₹{inv.subtotal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-700">
                        ₹{(inv.discountTotal ?? 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">
                        ₹{inv.grandTotal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(
                            inv.status
                          )}`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {inv.cashierName ||
                          inv.cashierUserId?.slice(0, 6) ||
                          "—"}
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && !invoicesLoading && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        No invoices found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
