"use client";
import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { InvoiceDoc, SettingsDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import Receipt from "@/components/receipt";

export default function InvoiceReceiptPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const search = useSearchParams();
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

  // Close window automatically after print, if requested
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const autoClose = search?.get('autoclose') === '1' || search?.get('autoclose') === 'true';
    if (!autoClose) return;
    const onAfterPrint = () => {
      try { window.close(); } catch { }
    };
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [search]);

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

  const shouldConfirm = (search?.get('confirm') === '1' || search?.get('confirm') === 'true');
  return (
    <div className="relative">
      {/* Pre-print confirmation overlay when requested */}
      {shouldConfirm && (
        <div className="fixed top-2 right-2 z-50 print:hidden bg-white/90 backdrop-blur rounded border shadow-sm px-3 py-2 text-xs flex items-center gap-2">
          <span>Print receipt?</span>
          <button
            onClick={() => { try { window.print(); } catch { } }}
            className="px-2 py-1 rounded border bg-blue-600 text-white hover:bg-blue-700"
          >
            Print
          </button>
          <button
            onClick={() => { try { window.close(); } catch { } }}
            className="px-2 py-1 rounded border hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}
      <Receipt
        widthMm={80}
        logoUrl={logo}
        businessName={bizName}
        addressLines={addrParts}
        gstin={gstin}
        footerNote={footer}
        showReviewLink={showReview}
        reviewUrl={reviewUrl}
        autoPrint={!shouldConfirm}
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
    </div>
  );
}

// Always render fresh and avoid static optimization
export const dynamic = "force-dynamic";
