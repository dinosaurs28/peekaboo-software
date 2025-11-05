"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { InvoiceDoc, SettingsDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import Receipt from "@/components/receipt";

export default function InvoiceReceiptPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [inv, setInv] = useState<InvoiceDoc | null>(null);
  const [settings, setSettings] = useState<Partial<SettingsDoc> | null>(null);

  useEffect(() => {
    (async () => {
      if (!db || !id) return;
      const snap = await getDoc(doc(db, "Invoices", id));
      if (snap.exists()) setInv(toInvoiceDoc(snap.id, snap.data() as any));
      try {
        const sSnap = await getDoc(doc(db, "Settings", "app"));
        if (sSnap.exists()) setSettings(sSnap.data() as any);
      } catch {
        // ignore
      }
    })();
  }, [id]);

  if (!inv) return <div className="p-4">Preparing…</div>;

  const bizName = settings?.businessName || "Your Store Name";
  const addrParts = [
    settings?.addressLine1,
    settings?.addressLine2,
    [settings?.city, settings?.state, settings?.pinCode].filter(Boolean).join(", "),
  ].filter((p) => !!p && String(p).trim().length > 0) as string[];
  const gstin = settings?.gstin || undefined;
  const footer = settings?.receiptFooterNote || undefined;
  const logo = settings?.logoUrl || undefined;
  const showTax = settings?.showTaxLine ?? true;
  const showReview = !!settings?.showReviewLink && !!settings?.googleReviewUrl;
  const reviewUrl = settings?.googleReviewUrl || undefined;

  return (
    <Receipt
      widthMm={80}
      logoUrl={logo}
      businessName={bizName}
      addressLines={addrParts}
      gstin={gstin}
      footerNote={footer}
      showReviewLink={showReview}
      reviewUrl={reviewUrl}
      autoPrint
    >
      <div className="bill-info">
        <div className="flex items-center justify-between">
          <span>No:</span>
          <span>{inv.invoiceNumber}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Date:</span>
          <span>{new Date(inv.issuedAt).toLocaleString()}</span>
        </div>
      </div>
      <div className="separator" />
      <table className="items">
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
        <tfoot>
          <tr>
            <td colSpan={2}>Subtotal</td>
            <td className="text-right">₹{inv.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td colSpan={2}>Discount</td>
            <td className="text-right">₹{(inv.discountTotal ?? 0).toFixed(2)}</td>
          </tr>
          {showTax ? (
            <tr>
              <td colSpan={2}>GST</td>
              <td className="text-right">₹{(inv.taxTotal ?? 0).toFixed(2)}</td>
            </tr>
          ) : null}
          <tr className="total">
            <td colSpan={2}>Total</td>
            <td className="text-right">₹{inv.grandTotal.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </Receipt>
  );
}
