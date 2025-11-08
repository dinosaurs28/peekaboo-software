"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import type { InvoiceDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCustomer } from "@/lib/customers";
import { splitInclusive } from "@/lib/tax";

export default function InvoiceDetailsPage() {
  const { user, role, loading } = useAuth();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [invoice, setInvoice] = useState<InvoiceDoc | null>(null);
  const [pending, setPending] = useState(true);
  const [customerName, setCustomerName] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !id) return;
    const ref = doc(db, "Invoices", id);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setInvoice(toInvoiceDoc(snap.id, snap.data() as Record<string, unknown>));
      } else {
        setInvoice(null);
      }
      setPending(false);
    });
    return () => unsub();
  }, [id]);

  // Load customer name for display instead of raw ID
  useEffect(() => {
    (async () => {
      try {
        if (invoice?.customerId) {
          const c = await getCustomer(invoice.customerId);
          setCustomerName(c?.name || null);
        } else {
          setCustomerName(null);
        }
      } catch {
        setCustomerName(null);
      }
    })();
  }, [invoice?.customerId]);

  const billLevelDiscount = useMemo(() => invoice?.discountTotal ?? 0, [invoice]);
  const totalsInclusive = useMemo(() => {
    if (!invoice) return { base: 0, gst: 0, lineDisc: 0 };
    let base = 0, gst = 0, lineDisc = 0;
    for (const it of invoice.items) {
      const { base: b, gst: g } = splitInclusive(Number(it.unitPrice || 0), Number(it.taxRatePct || 0));
      base += b * Number(it.quantity || 0);
      gst += g * Number(it.quantity || 0);
      lineDisc += Number(it.discountAmount || 0);
    }
    return { base, gst, lineDisc };
  }, [invoice]);
  const itemsWithNet = useMemo(() => {
    if (!invoice) return [] as Array<{ name: string; qty: number; unit: number; discount: number; net: number }>;
    return invoice.items.map((it) => {
      const unit = it.unitPrice;
      const discount = it.discountAmount ?? 0;
      const net = unit * it.quantity - discount;
      return { name: it.name, qty: it.quantity, unit, discount, net };
    });
  }, [invoice]);

  const canExchange = useMemo(() => {
    if (!invoice) return false;
    try {
      const issued = new Date(invoice.issuedAt);
      const now = new Date();
      // calendar-day window check (client-side rough check; server enforces precisely)
      const dayDiff = Math.floor((now.getTime() - issued.getTime()) / (24 * 60 * 60 * 1000));
      return dayDiff <= 7;
    } catch { return false; }
  }, [invoice]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  // Allow printing for both Admin and Cashier roles
  const canPrint = role === "admin" || role === "cashier";

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => { window.location.href = "/invoices"; }}>← Back</Button>
            <h1 className="text-xl font-semibold">Invoice {invoice?.invoiceNumber || id}</h1>
            <div className="flex gap-2">
              {canPrint && (
                <>
                  <Button onClick={() => window.open(`/invoices/receipt/${id}`, "_blank")}>Print Receipt</Button>
                </>
              )}
              <Button variant="secondary" disabled={!canExchange} onClick={() => { if (canExchange) window.location.href = window.location.pathname + "/exchange"; }}>
                Exchange Items
              </Button>
            </div>
          </div>
          <Card className="p-4 space-y-2">
            {pending && <div className="text-sm text-muted-foreground">Loading invoice…</div>}
            {!pending && !invoice && <div className="text-sm text-red-600">Invoice not found.</div>}
            {invoice && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Issued: {new Date(invoice.issuedAt).toLocaleString()}</div>
                <div className="text-sm">Cashier: {invoice.cashierName || invoice.cashierUserId}</div>
                {invoice.customerId && (
                  <div className="text-sm">Customer: {customerName || invoice.customerId}</div>
                )}
                <div className="text-sm">Payment: {invoice.paymentMethod.toUpperCase()}{invoice.paymentReferenceId ? ` • ${invoice.paymentReferenceId}` : ''}</div>
              </div>
            )}
          </Card>
          <Card className="p-0">
            <div className="px-6 pt-4 pb-2 text-sm text-muted-foreground">Line items</div>
            <div className="px-6 pb-4 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit</th>
                    <th className="px-3 py-2 text-right">Item Disc.</th>
                    <th className="px-3 py-2 text-right">Line Net</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsWithNet.map((l, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">{l.name}</td>
                      <td className="px-3 py-2 text-right">{l.qty}</td>
                      <td className="px-3 py-2 text-right">₹{l.unit.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">₹{l.discount.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">₹{l.net.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="p-4 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Base (ex-tax)</span>
              <span>₹{totalsInclusive.base.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">GST</span>
              <span>₹{totalsInclusive.gst.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Discounts</span>
              <span>₹{(totalsInclusive.lineDisc + billLevelDiscount).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Grand Total</span>
              <span>₹{invoice?.grandTotal.toFixed(2)}</span>
            </div>
          </Card>
          {/* Printing is available to both Admin and Cashier; opens unified receipt page */}
        </main>
      </div>
    </div>
  );
}
