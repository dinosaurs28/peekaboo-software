"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { InvoiceDoc } from "@/lib/models";
import { observeInvoices, type InvoiceFilters } from "@/lib/invoices";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Input } from "@/components/ui/input";

export default function InvoicesPage() {
  const { user, role, loading } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  // Admin-only filters
  const [status, setStatus] = useState<InvoiceDoc["status"] | "">("");
  const [cashier, setCashier] = useState<string>("");
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
      if (cashier) filters.cashierUserId = cashier;
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
  }, [user, role, status, cashier, from, to]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-6 space-y-4">
          <h1 className="text-xl font-semibold">Invoices</h1>
          {role === "admin" && (
            <Card className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col">
                  <label className="text-xs text-muted-foreground">From</label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-muted-foreground">To</label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select className="h-9 rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as InvoiceDoc["status"] | "")}>
                    <option value="">All</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="void">Void</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-muted-foreground">Cashier (UID)</label>
                  <Input placeholder="uid starts-with or full" value={cashier} onChange={(e) => setCashier(e.target.value)} />
                </div>
                <button
                  className="h-9 px-4 rounded-md border text-sm font-medium hover:bg-muted"
                  onClick={() => { setFrom(""); setTo(""); setStatus(""); setCashier(""); }}
                >Clear</button>
              </div>
            </Card>
          )}
          <Card className="p-0">
            <div className="px-6 pt-4 pb-2 text-sm text-muted-foreground">
              {invoicesLoading ? "Loading invoices…" : `${invoices.length} invoice(s)`}
            </div>
            <div className="px-6 pb-4 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Invoice #</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cashier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => window.alert(`Invoice ${inv.invoiceNumber} clicked. TODO: details view/print.`)}
                    >
                      <TableCell>{inv.invoiceNumber}</TableCell>
                      <TableCell>{new Date(inv.issuedAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{inv.subtotal.toFixed(2)}</TableCell>
                      <TableCell className="text-right">₹{(inv.discountTotal ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">₹{inv.grandTotal.toFixed(2)}</TableCell>
                      <TableCell>{inv.status}</TableCell>
                      <TableCell>{inv.cashierUserId.slice(0, 6)}</TableCell>
                    </TableRow>
                  ))}
                  {invoices.length === 0 && !invoicesLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground">No invoices yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
