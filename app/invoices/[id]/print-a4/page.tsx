"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { InvoiceDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import type { SettingsDoc } from "@/lib/models";

export default function InvoicePrintA4Page() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [inv, setInv] = useState<InvoiceDoc | null>(null);
  const [settings, setSettings] = useState<Partial<SettingsDoc> | null>(null);
  useEffect(() => {
    (async () => {
      if (!db || !id) return;
      const invSnap = await getDoc(doc(db, 'Invoices', id));
      if (invSnap.exists()) setInv(toInvoiceDoc(invSnap.id, invSnap.data() as any));
      try {
        const sSnap = await getDoc(doc(db, 'Settings', 'app'));
        if (sSnap.exists()) setSettings(sSnap.data() as any);
      } catch { }
    })();
  }, [id]);

  useEffect(() => { if (inv) setTimeout(() => window.print(), 300); }, [inv]);

  if (!inv) return <div className="p-6">Preparing…</div>;
  const bizName = settings?.businessName || 'Your Store Name';
  const addrParts = [
    settings?.addressLine1,
    settings?.addressLine2,
    [settings?.city, settings?.state, settings?.pinCode].filter(Boolean).join(', ')
  ].filter(p => !!p && String(p).trim().length > 0) as string[];
  const addr1 = addrParts.join(', ') || 'Address line 1, City, State, PIN';
  const gstin = settings?.gstin || 'XXYYYYZZZZ';
  const logo = settings?.logoUrl;
  const footer = settings?.receiptFooterNote || 'Thank you for shopping with us!';
  return (
    <div className="p-8 print:p-0 max-w-3xl mx-auto text-sm">
      <div className="flex items-start justify-between mb-6">
        <div>
          {logo ? <img src={logo} alt="Logo" className="h-12 mb-2" /> : null}
          <div className="text-xl font-semibold">{bizName}</div>
          <div className="text-xs text-muted-foreground">{addr1}</div>
          <div className="text-xs text-muted-foreground">GSTIN: {gstin}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">Invoice</div>
          <div>No: {inv.invoiceNumber}</div>
          <div>Date: {new Date(inv.issuedAt).toLocaleString()}</div>
        </div>
      </div>
      <table className="w-full border text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left px-2 py-1 border">Item</th>
            <th className="text-right px-2 py-1 border">Qty</th>
            <th className="text-right px-2 py-1 border">Rate</th>
            <th className="text-right px-2 py-1 border">GST%</th>
            <th className="text-right px-2 py-1 border">Discount</th>
            <th className="text-right px-2 py-1 border">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it, idx) => {
            const unit = it.unitPrice;
            const disc = Number(it.discountAmount || 0);
            const net = unit * it.quantity - disc;
            return (
              <tr key={idx}>
                <td className="px-2 py-1 border">{it.name}</td>
                <td className="px-2 py-1 border text-right">{it.quantity}</td>
                <td className="px-2 py-1 border text-right">₹{unit.toFixed(2)}</td>
                <td className="px-2 py-1 border text-right">{it.taxRatePct ?? 0}</td>
                <td className="px-2 py-1 border text-right">₹{disc.toFixed(2)}</td>
                <td className="px-2 py-1 border text-right">₹{net.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>₹{inv.subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Bill Discount</span><span>₹{(inv.discountTotal ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between"><span>GST</span><span>₹{(inv.taxTotal ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between font-semibold text-base"><span>Grand Total</span><span>₹{inv.grandTotal.toFixed(2)}</span></div>
      </div>
      <div className="mt-8 text-xs text-muted-foreground">{footer}</div>
    </div>
  );
}
