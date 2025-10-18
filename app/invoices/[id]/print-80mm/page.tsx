"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { InvoiceDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";

export default function InvoicePrintThermalPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [inv, setInv] = useState<InvoiceDoc | null>(null);
  useEffect(() => { (async () => { if (!db || !id) return; const snap = await getDoc(doc(db, 'Invoices', id)); if (snap.exists()) setInv(toInvoiceDoc(snap.id, snap.data() as any)); })(); }, [id]);
  useEffect(() => { if (inv) setTimeout(() => window.print(), 300); }, [inv]);
  if (!inv) return <div className="p-4">Preparing…</div>;
  return (
    <div className="mx-auto" style={{ width: '80mm' }}>
      <div className="p-2 text-xs">
        <div className="text-center">
          <div className="text-sm font-semibold">Your Store Name</div>
          <div>Address line 1</div>
          <div>GSTIN: XXYYYYZZZZ</div>
        </div>
        <div className="mt-2">
          <div>No: {inv.invoiceNumber}</div>
          <div>Date: {new Date(inv.issuedAt).toLocaleString()}</div>
        </div>
        <div className="my-2 border-t border-dashed" />
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left">Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, idx) => {
              const unit = it.unitPrice;
              const disc = Number(it.discountAmount || 0);
              const net = unit * it.quantity - disc;
              return (
                <tr key={idx}>
                  <td>{it.name}</td>
                  <td className="text-right">{it.quantity}</td>
                  <td className="text-right">₹{net.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="my-2 border-t border-dashed" />
        <div className="space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>₹{inv.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>₹{(inv.discountTotal ?? 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>GST</span><span>₹{(inv.taxTotal ?? 0).toFixed(2)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span>₹{inv.grandTotal.toFixed(2)}</span></div>
        </div>
        <div className="my-2 border-t border-dashed" />
        <div className="text-center">Thank you!</div>
      </div>
    </div>
  );
}
