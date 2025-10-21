"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { InvoiceDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import type { SettingsDoc } from "@/lib/models";

export default function InvoicePrintThermalPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [inv, setInv] = useState<InvoiceDoc | null>(null);
  const [settings, setSettings] = useState<Partial<SettingsDoc> | null>(null);
  useEffect(() => { (async () => { if (!db || !id) return; const snap = await getDoc(doc(db, 'Invoices', id)); if (snap.exists()) setInv(toInvoiceDoc(snap.id, snap.data() as any)); try { const sSnap = await getDoc(doc(db, 'Settings', 'app')); if (sSnap.exists()) setSettings(sSnap.data() as any); } catch { } })(); }, [id]);
  useEffect(() => { if (inv) setTimeout(() => window.print(), 300); }, [inv]);
  if (!inv) return <div className="p-4">Preparing…</div>;
  const bizName = settings?.businessName || 'Your Store Name';
  const addrParts = [
    settings?.addressLine1,
    settings?.addressLine2,
    [settings?.city, settings?.state, settings?.pinCode].filter(Boolean).join(', ')
  ].filter(p => !!p && String(p).trim().length > 0) as string[];
  const addr1 = addrParts.join(', ') || 'Address line 1';
  const gstin = settings?.gstin || 'XXYYYYZZZZ';
  const footer = settings?.receiptFooterNote || 'Thank you!';
  const logo = settings?.logoUrl;
  return (
    <div className="mx-auto" style={{ width: '80mm' }}>
      <div className="p-2 text-xs">
        <div className="text-center">
          {logo ? <img src={logo} alt="Logo" className="h-10 mx-auto mb-1" /> : null}
          <div className="text-sm font-semibold">{bizName}</div>
          <div>{addr1}</div>
          <div>GSTIN: {gstin}</div>
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
        <div className="text-center">{footer}</div>
      </div>
    </div>
  );
}
