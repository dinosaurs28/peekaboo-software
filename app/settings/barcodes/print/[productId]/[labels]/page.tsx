"use client";
export const dynamic = "force-dynamic";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProduct } from "@/lib/products";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc, ProductDoc } from "@/lib/models";
import { incrementPrintedCount } from "@/lib/products";
import { adjustStock } from "@/lib/pos";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/ui/toast";
import { BarcodeLabel, LABEL_H_MM, LABEL_W_MM, encodeBarcode, loadLabelOffset, type LabelOffset } from "@/components/barcode-label";

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
  const [barcodesReady, setBarcodesReady] = useState(false);
  const [offset, setOffset] = useState<LabelOffset>({ x: 0, y: 0 });
  useEffect(() => { setOffset(loadLabelOffset()); }, []);

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

  // Print only once every label's barcode has been drawn
  const drawnRef = useRef(0);
  const onDrawn = useCallback(() => {
    drawnRef.current += 1;
    if (drawnRef.current >= labelsCount) requestAnimationFrame(() => setBarcodesReady(true));
  }, [labelsCount]);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @page { size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm; margin: 0; }
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
        /* The root sits inside app providers, so hide everything else by visibility, not display */
        body.labels-print * { visibility: hidden; }
        body.labels-print #labels-print-root, body.labels-print #labels-print-root * { visibility: visible; }
        #labels-print-root { position: absolute; top: 0; left: 0; right: 0; margin: 0; padding: 0; }
        /* Centre each label across the printed page width */
        #labels-print-root .label { margin: 0 auto !important; }
        #labels-print-root .label:not(:last-child) { break-after: page; page-break-after: always; }
      }
      #labels-print-root { background: #fff; }
      #labels-print-root .label { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      #labels-print-root svg, #labels-print-root svg rect { shape-rendering: crispEdges; }
    `;
    document.head.appendChild(style);
    document.body.classList.add('labels-print');

    const prevTitle = document.title;
    document.title = " ";
    const t = setTimeout(() => { if (barcodesReady) window.print(); }, 300);

    const handleAfterPrint = async () => {
      if (handledRef.current) return;
      handledRef.current = true;
      try {
        let didPrint = false;
        try { didPrint = window.confirm('Did the labels print successfully?'); } catch { }
        if (didPrint && prod?.id) {
          await incrementPrintedCount(prod.id, labelsCount);
          await adjustStock({ productId: prod.id, delta: labelsCount, reason: 'receive', userId: user?.uid, note: 'barcode-print' });
          toast({ title: 'Stock updated', description: `${labelsCount} added for printing`, variant: 'success' });
        }
      } finally {
        try { window.close(); } catch { }
        router.replace('/settings');
      }
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => { document.title = prevTitle; clearTimeout(t); window.removeEventListener('afterprint', handleAfterPrint); document.head.removeChild(style); document.body.classList.remove('labels-print'); };
  }, [labelsCount, prod?.id, router, user?.uid, barcodesReady]);

  if (!prod) return <div className="p-6 text-sm">Preparing labels…</div>;

  const labels = Array.from({ length: labelsCount });

  return (
    <div id="labels-print-root">
      {labels.map((_, idx) => (
        <BarcodeLabel key={idx} product={prod} code={codeText} offset={offset} onDrawn={onDrawn} className="mx-auto" />
      ))}
    </div>
  );
}
