"use client";
// Always render fresh and avoid static optimization for print labels
export const dynamic = "force-dynamic";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import JsBarcode from "jsbarcode";
import { getProduct } from "@/lib/products";
import { listCategories } from "@/lib/categories";
import { categoryCode } from "@/lib/models";
import type { CategoryDoc, ProductDoc } from "@/lib/models";
import { incrementPrintedCount } from "@/lib/products";
import { adjustStock } from "@/lib/pos";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/ui/toast";

function encodeBarcode(p: ProductDoc, categories: CategoryDoc[]): string {
  const catName = p.category;
  let code = categoryCode(catName);
  if (catName) {
    const match = categories.find(c => c.active && c.name.toLowerCase() === catName.toLowerCase());
    if (match?.code) code = match.code.toUpperCase();
  }
  return `PB|${code}|${p.sku}`;
}

export default function PrintLabelsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const productId = Array.isArray(params?.productId) ? params.productId[0] : (params?.productId as string);
  const labelsCount = useMemo(() => {
    const raw = Array.isArray(params?.labels) ? params.labels[0] : (params?.labels as string);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 1;
    return Math.min(300, Math.max(1, Math.floor(n)));
  }, [params]);

  const [prod, setProd] = React.useState<ProductDoc | null>(null);
  const [categories, setCategories] = React.useState<CategoryDoc[]>([]);
  const svgRefs = React.useRef<Array<SVGSVGElement | null>>([]);
  const [barcodesReady, setBarcodesReady] = useState(false);

  const handledRef = useRef(false);
  useEffect(() => {
    (async () => {
      if (!productId) return;
      const [p, cats] = await Promise.all([getProduct(productId), listCategories()]);
      setProd(p);
      setCategories(cats.filter(c => c.active));
    })();
  }, [productId]);

  const codeText = useMemo(() => (prod ? encodeBarcode(prod, categories) : ""), [prod, categories]);

  useEffect(() => {
    // Render barcodes into all label slots once data is ready
    if (!codeText) return;
    const opts = { format: "CODE128", displayValue: false, margin: 0, height: 80 } as const;
    let drawn = 0;
    svgRefs.current.forEach((el) => { if (el) { JsBarcode(el, codeText, opts as any); drawn++; } });
    // Mark ready when we drew at least one barcode and have expected elements
    if (drawn > 0) {
      // wait a frame to ensure layout updated
      requestAnimationFrame(() => setBarcodesReady(true));
    }
  }, [codeText, labelsCount]);

  useEffect(() => {
    // Prepare page CSS to scope printing ONLY to our labels root and page size
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        @page { size: 38.1mm 25.4mm; margin: 0; }
        html, body { width: 38.1mm; height: 25.4mm; margin: 0; padding: 0; }
        /* Hide everything except our print root */
        body * { visibility: hidden !important; }
        #labels-print-root, #labels-print-root * { visibility: visible !important; }
        /* Ensure our root occupies the page area */
        #labels-print-root { position: absolute; inset: 0; margin: 0; padding: 0; }
      }
      #labels-print-root { background: #fff; }
    `;
    document.head.appendChild(style);

    // Temporarily set a minimal title to avoid big headers if headers/footers are enabled
    const prevTitle = document.title;
    document.title = " ";
    // Trigger print only when barcodes are ready
    const t = setTimeout(() => { if (barcodesReady) window.print(); }, 300);

    const handleAfterPrint = async () => {
      if (handledRef.current) return; // guard against duplicate events
      handledRef.current = true;
      try {
        let didPrint = false;
        try {
          didPrint = window.confirm('Did the labels print successfully?');
        } catch { }
        if (didPrint && prod?.id) {
          const totalBarcodes = labelsCount; // one barcode per label
          await incrementPrintedCount(prod.id, totalBarcodes);
          await adjustStock({ productId: prod.id, delta: totalBarcodes, reason: 'receive', userId: user?.uid, note: 'barcode-print' });
          toast({ title: 'Stock updated', description: `${totalBarcodes} added for printing`, variant: 'success' });
        } else {
          toast({ title: 'No changes applied', description: 'Printing was cancelled', variant: 'info' });
        }
      } finally {
        // Attempt to auto-close this tab (works if opened via window.open)
        try { window.close(); } catch { /* ignore */ }
        // Fallback navigation if window couldn't close itself
        router.replace('/settings');
      }
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => { document.title = prevTitle; clearTimeout(t); window.removeEventListener('afterprint', handleAfterPrint); document.head.removeChild(style); };
  }, [labelsCount, prod?.id, router, user?.uid, barcodesReady]);

  if (!prod) return <div className="p-6 text-sm">Preparing labels…</div>;

  // Render N labels; each label has 5mm outer padding and 5mm gap between barcode columns
  const labels = Array.from({ length: labelsCount });

  return (
    <div id="labels-print-root">
      {labels.map((_, idx) => (
        <div
          key={idx}
          className="mx-auto"
          style={{
            width: '38.1mm',
            height: '25.4mm',
            padding: '1mm',
            boxSizing: 'border-box',
            pageBreakAfter: 'always',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* Top: Product name */}
          <div style={{ fontSize: '8pt', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>
            {prod.name}
          </div>
          {/* Middle: Horizontal barcode (target 1.5"×1") */}
          <div style={{ width: '36.1mm', height: '12.7mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg ref={(el) => { svgRefs.current[idx] = el; }} style={{ width: '100%', height: '100%' }} />
          </div>
          {/* Bottom: Code and price stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0mm' }}>
            <div style={{ fontSize: '7pt', lineHeight: 1 }}>{codeText}</div>
            {/* Increased price font size for better readability on small labels */}
            <div style={{ fontSize: '8.5pt', fontWeight: 600, lineHeight: 1, letterSpacing: '0.2pt' }}>₹{prod.unitPrice.toFixed(2)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
