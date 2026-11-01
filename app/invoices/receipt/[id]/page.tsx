"use client";
import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { InvoiceDoc, SettingsDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import { getProduct } from "@/lib/products";
import Receipt from "@/components/receipt";
import { ReceiptItems, ReceiptTotals, type ReceiptLine } from "@/components/receipt-lines";

export default function InvoiceReceiptPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const search = useSearchParams();
  const [inv, setInv] = useState<InvoiceDoc | null>(null);
  const [settings, setSettings] = useState<Partial<SettingsDoc> | null>(null);
  // MRP per productId for lines saved without an MRP snapshot (older invoices)
  const [productMrp, setProductMrp] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      if (!db || !id) return;
      const snap = await getDoc(doc(db, "Invoices", id));
      if (snap.exists()) {
        const invoice = toInvoiceDoc(snap.id, snap.data() as any);
        setInv(invoice);
        const missing = Array.from(new Set(invoice.items.filter((it) => !(Number(it.mrp) > 0) && it.productId).map((it) => it.productId)));
        if (missing.length) {
          const found: Record<string, number> = {};
          await Promise.all(missing.map(async (pid) => {
            try {
              const p = await getProduct(pid);
              if (p && Number(p.mrp) > 0) found[pid] = Number(p.mrp);
            } catch { /* fall back to SP */ }
          }));
          setProductMrp(found);
        }
      }
      try {
        const sSnap = await getDoc(doc(db, "Settings", "app"));
        if (sSnap.exists()) setSettings(sSnap.data() as any);
      } catch {
        // ignore
      }
    })();
  }, [id]);

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

  const lines = React.useMemo<ReceiptLine[]>(
    () => (inv?.items || []).map((it) => ({
      name: it.name,
      qty: it.quantity,
      sp: it.unitPrice,
      mrp: Number(it.mrp) > 0 ? it.mrp : productMrp[it.productId],
      lineDiscount: it.discountAmount,
      taxRatePct: it.taxRatePct,
    })),
    [inv, productMrp]
  );

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
  const terms = settings?.receiptTermsConditions || undefined;
  const isExchange = !!inv.exchangeOfInvoiceId;

  const shouldConfirm = (search?.get('confirm') === '1' || search?.get('confirm') === 'true');

  return (
    <div className="relative">
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
        <div className="bill-info mb-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Invoice No:</span>
            <span className="font-mono">{inv.invoiceNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Date:</span>
            <span>{new Date(inv.issuedAt).toLocaleString()}</span>
          </div>
        </div>

        {/* --- Header Separator --- */}
        <div className="border-b-2 border-dashed border-gray-400 my-2" />

        <ReceiptItems lines={lines} />
        <ReceiptTotals
          lines={lines}
          billDiscount={inv.discountTotal}
          billDiscountLabel={isExchange ? "Exchange Credit" : "Bill Discount"}
          billDiscountIsSaving={!isExchange}
          redeemedPoints={inv.redeemedPoints}
          redeemedValue={inv.redeemedValue}
          grandTotal={inv.grandTotal}
          showTax={showTax}
        />

      </Receipt>
    </div>
  );
}

export const dynamic = "force-dynamic";