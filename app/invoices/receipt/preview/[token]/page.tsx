"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Receipt from "@/components/receipt";
import type { SettingsDoc } from "@/lib/models";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { splitInclusive, round2 } from "@/lib/tax";
import { checkoutCart } from "@/lib/pos";

type PendingPayload = {
  lines: Array<{ productId: string; name: string; qty: number; unitPrice: number; lineDiscount?: number; taxRatePct?: number }>;
  billDiscount?: number;
  paymentMethod?: 'cash' | 'card' | 'upi' | 'wallet';
  paymentReferenceId?: string;
  cashierUserId?: string;
  cashierName?: string;
  customerId?: string;
  opId: string; // token
};

export default function ReceiptPreviewPage() {
  const params = useParams();
  const token = Array.isArray(params?.token) ? params.token[0] : (params?.token as string);
  const search = useSearchParams();
  const [settings, setSettings] = useState<Partial<SettingsDoc> | null>(null);
  const [payload, setPayload] = useState<PendingPayload | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings
  useEffect(() => {
    (async () => {
      try {
        const sSnap = await getDoc(doc(db!, "Settings", "app"));
        if (sSnap.exists()) setSettings(snapTo<SettingsDoc>(sSnap.data()));
      } catch { /* ignore */ }
    })();
  }, []);

  // Load pending payload from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`checkout.pending.${token}`);
      if (raw) setPayload(JSON.parse(raw));
      else setError("Nothing to print. This tab was opened without payload.");
    } catch {
      setError("Failed to load pending checkout payload.");
    }
  }, [token]);

  // After print finalize
  useEffect(() => {
    if (!payload) return;
    const shouldConfirm = search?.get('confirm') === '1' || search?.get('confirm') === 'true';
    const autoClose = search?.get('autoclose') === '1' || search?.get('autoclose') === 'true';
    const onAfterPrint = async () => {
      if (shouldConfirm) return; // when confirm overlay is present, we print from a button which triggers finalize explicitly
      await doFinalize();
      if (autoClose) try { window.close(); } catch { }
    };
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  async function doFinalize() {
    if (!payload) return;
    if (finalizing) return;
    setFinalizing(true);
    setError(null);
    try {
      const newId = await checkoutCart(payload);
      // notify opener
      try {
        window.opener?.postMessage({ type: 'checkout-finalized', token: payload.opId, invoiceId: newId }, window.location.origin);
      } catch { }
      // cleanup storage
      try { sessionStorage.removeItem(`checkout.pending.${payload.opId}`); } catch { }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setFinalizing(false);
      return;
    }
    setFinalizing(false);
  }

  if (!payload) return <div className="p-4 text-sm">{error || 'Preparing…'}</div>;

  // Build display sums identical to invoice page
  const sums = useMemo(() => {
    let base = 0, gst = 0, lineDisc = 0;
    for (const it of payload.lines) {
      const { base: b, gst: g } = splitInclusive(Number(it.unitPrice || 0), Number(it.taxRatePct || 0));
      base += b * Number(it.qty || 0);
      gst += g * Number(it.qty || 0);
      lineDisc += Number(it.lineDiscount || 0);
    }
    return { base: round2(base), gst: round2(gst), lineDisc: round2(lineDisc) };
  }, [payload]);

  const grandTotal = useMemo(() => {
    const sub = payload.lines.reduce((s, l) => s + (l.unitPrice * l.qty - (l.lineDiscount || 0)), 0);
    const bill = Number(payload.billDiscount || 0);
    return Math.max(0, sub - bill);
  }, [payload]);

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
  const terms = settings?.receiptTermsConditions || undefined;

  const shouldConfirm = search?.get('confirm') === '1' || search?.get('confirm') === 'true';
  const autoClose = search?.get('autoclose') === '1' || search?.get('autoclose') === 'true';

  return (
    <div className="relative">
      {shouldConfirm && (
        <div className="fixed top-2 right-2 z-50 print:hidden bg-white/90 backdrop-blur rounded border shadow-sm px-3 py-2 text-xs flex items-center gap-2">
          <span>Print receipt?</span>
          <button
            onClick={async () => {
              try { window.print(); } catch { }
              await doFinalize();
              if (autoClose) try { window.close(); } catch { }
            }}
            className="px-2 py-1 rounded border bg-blue-600 text-white hover:bg-blue-700"
            disabled={finalizing}
          >
            {finalizing ? 'Finalizing…' : 'Print'}
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
        paperWidthMm={settings?.receiptPaperWidthMm ?? 80}
        contentWidthMm={settings?.receiptContentWidthMm ?? Math.min(75, Number(settings?.receiptPaperWidthMm ?? 80))}
        safePaddingMm={3}
        logoUrl={logo}
        businessName={bizName}
        addressLines={addrParts}
        gstin={gstin}
        footerNote={footer}
        showReviewLink={showReview}
        reviewUrl={reviewUrl}
        autoPrint={!shouldConfirm}
        termsConditions={terms}
      >
        <div className="bill-info">
          <div className="flex items-center justify-between">
            <span>No:</span>
            <span>Pending</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Date:</span>
            <span>{new Date().toLocaleString()}</span>
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
            {payload.lines.map((it, idx) => {
              const net = it.unitPrice * it.qty - (it.lineDiscount || 0);
              return (
                <tr key={idx}>
                  <td>{it.name}</td>
                  <td className="text-right">{it.qty}</td>
                  <td className="text-right">₹{net.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Base (ex-tax)</td>
              <td className="text-right">₹{sums.base.toFixed(2)}</td>
            </tr>
            {showTax ? (
              <tr>
                <td colSpan={2}>GST</td>
                <td className="text-right">₹{sums.gst.toFixed(2)}</td>
              </tr>
            ) : null}
            <tr>
              <td colSpan={2}>Discounts</td>
              <td className="text-right">₹{(sums.lineDisc + (payload.billDiscount ?? 0)).toFixed(2)}</td>
            </tr>
            <tr className="total">
              <td colSpan={2}>Total</td>
              <td className="text-right">₹{grandTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        {error ? <div className="text-xs text-red-600 mt-2 text-center">{error}</div> : null}
      </Receipt>
    </div>
  );
}

function snapTo<T>(d: any): T { return d as T; }

export const dynamic = "force-dynamic";
