"use client";
import React, { useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import JsBarcode from "jsbarcode";
import { getProduct } from "@/lib/products";
import { listCategories } from "@/lib/categories";
import { categoryCode } from "@/lib/models";
import type { CategoryDoc, ProductDoc } from "@/lib/models";
import { incrementPrintedCount } from "@/lib/products";
import { adjustStock } from "@/lib/pos";
import { useAuth } from "@/components/auth/auth-provider";

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
    svgRefs.current.forEach((el) => { if (el) JsBarcode(el, codeText, opts as any); });
  }, [codeText, labelsCount]);

  useEffect(() => {
    // Prepare page CSS and trigger print
    const style = document.createElement('style');
    // Each label is one physical page sized 50mm × 25mm
    style.innerHTML = `@media print { @page { size: 50mm 25mm; margin: 0; } }`;
    document.head.appendChild(style);

    // Trigger print after a tick
    const t = setTimeout(() => window.print(), 300);

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
        }
      } finally {
        router.replace('/settings');
      }
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', handleAfterPrint); document.head.removeChild(style); };
  }, [labelsCount, prod?.id, router, user?.uid]);

  if (!prod) return <div className="p-6 text-sm">Preparing labels…</div>;

  // Render N labels; each label has 5mm outer padding and 5mm gap between barcode columns
  const labels = Array.from({ length: labelsCount });

  return (
    <div>
      {labels.map((_, idx) => (
        <div
          key={idx}
          className="mx-auto"
          style={{
            width: '50mm',
            height: '25mm',
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
          {/* Middle: Horizontal barcode (target ~2"×1") */}
          <div style={{ width: '48mm', height: '12mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg ref={(el) => { svgRefs.current[idx] = el; }} style={{ width: '100%', height: '100%' }} />
          </div>
          {/* Bottom: Code and price stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0mm' }}>
            <div style={{ fontSize: '7pt', lineHeight: 1 }}>{codeText}</div>
            <div style={{ fontSize: '7pt', fontWeight: 500, lineHeight: 1 }}>₹{prod.unitPrice.toFixed(2)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
