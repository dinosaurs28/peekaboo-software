"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { InvoiceDoc } from "@/lib/models";
import { observeInvoices, type InvoiceFilters } from "@/lib/invoices";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Input } from "@/components/ui/input";

export default function InvoicesPage() {
  const { user, role, loading } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  // Admin-only filters
  const [status, setStatus] = useState<InvoiceDoc["status"] | "">("");
  const [cashierEmail, setCashierEmail] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  useEffect(() => {
    if (!user) return; // route guard elsewhere redirects unauth users
    const filters: InvoiceFilters = {};
    if (role === "cashier") {
      // Cashier sees only their own invoices
      filters.cashierUserId = user.uid;
    } else {
      if (status) filters.status = status as InvoiceDoc["status"];
      if (cashierEmail) filters.cashierNameEq = cashierEmail.trim();
      if (from) filters.issuedFromIso = new Date(from).toISOString();
      if (to) {
        // Set end of day for inclusive upper bound
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

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="flex min-h-screen w-full bg-gray-50 text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
              <p className="text-xs text-gray-500 mt-1">View and manage past invoices.</p>
            </div>
          </div>

          {/* Filter chips removed per request; existing filter card retained below for admin */}

          {role === "admin" && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">From</label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">To</label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Status</label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as InvoiceDoc["status"] | "")}
                  >
                    <option value="">All</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="void">Void</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Cashier Email</label>
                  <Input placeholder="e.g., testcashier@peekaboo.com" value={cashierEmail} onChange={(e) => setCashierEmail(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end pt-3">
                <button
                  className="h-9 px-3 rounded-md border text-sm font-medium hover:bg-gray-50"
                  onClick={() => { setFrom(""); setTo(""); setStatus(""); setCashierEmail(""); }}
                >Clear filters</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 pt-4 pb-2 text-sm text-gray-500 border-b bg-white/50">
              {invoicesLoading ? "Loading invoices…" : `${invoices.length} invoice(s)`}
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-6 py-3 text-gray-600 w-[160px]">Invoice ID</th>
                    <th className="px-6 py-3 text-gray-600">Date</th>
                    <th className="px-6 py-3 text-gray-600 text-right">Subtotal</th>
                    <th className="px-6 py-3 text-gray-600 text-right">Discount</th>
                    <th className="px-6 py-3 text-gray-600 text-right">Grand Total</th>
                    <th className="px-6 py-3 text-gray-600">Status</th>
                    <th className="px-6 py-3 text-gray-600">Cashier</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-t cursor-pointer hover:bg-gray-50"
                      onClick={() => { window.location.href = `/invoices/${inv.id}`; }}
                    >
                      <td className="px-6 py-3 font-medium text-gray-900 hover:underline hover:text-sky-600">{inv.invoiceNumber}</td>
                      <td className="px-6 py-3">{new Date(inv.issuedAt).toLocaleString()}</td>
                      <td className="px-6 py-3 text-right">₹{inv.subtotal.toFixed(2)}</td>
                      <td className="px-6 py-3 text-right">₹{(inv.discountTotal ?? 0).toFixed(2)}</td>
                      <td className="px-6 py-3 text-right font-medium text-sky-600">₹{inv.grandTotal.toFixed(2)}</td>
                      <td className="px-6 py-3">
                        <span className={
                          `inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ` +
                          (inv.status === 'paid' ? 'bg-gray-100 text-gray-700' :
                            inv.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                              inv.status === 'unpaid' ? 'bg-red-100 text-red-700' :
                                'bg-red-100 text-red-700')
                        }>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-3">{inv.cashierName || inv.cashierUserId.slice(0, 6)}</td>
                    </tr>
                  ))}
                  {invoices.length === 0 && !invoicesLoading && (
                    <tr>
                      <td className="px-6 py-6 text-center text-gray-500" colSpan={7}>No invoices yet.</td>
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
