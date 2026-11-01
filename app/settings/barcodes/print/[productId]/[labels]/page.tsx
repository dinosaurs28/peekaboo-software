"use client";
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

// Label stock: 50 x 25 mm. Printable content box after padding is 47 x 23 mm.
const LABEL_W_MM = 50;
const LABEL_H_MM = 25;
const PAD_TOP_MM = 1.2;
const PAD_X_MM = 1.5;
const PAD_BOTTOM_MM = 0.8;
const CONTENT_W_MM = LABEL_W_MM - PAD_X_MM * 2; // 47
const CONTENT_H_MM = LABEL_H_MM - PAD_TOP_MM - PAD_BOTTOM_MM; // 23

// Vertical budget inside the 23 mm content box (rows + gaps must sum to CONTENT_H_MM).
const ROW_GAP_MM = 0.4;
const NAME_ROW_MM = 2.8; // 7pt bold
const SP_ROW_MM = 3.6; // 10pt
const FOOTER_ROW_MM = 2.2; // 6pt
const BARCODE_ROW_MM = CONTENT_H_MM - NAME_ROW_MM - SP_ROW_MM - FOOTER_ROW_MM - ROW_GAP_MM * 3; // 13.2

// Code 128 needs a quiet zone of 10 modules on each side.
const QUIET_ZONE_MODULES = 10;

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
    if (!codeText) return;
    // Draw at 1 unit per module, then let the SVG fill the exact mm box via its viewBox.
    // Quiet zones are part of the drawing, so they stay inside the 47 mm width.
    const opts = {
      format: "CODE128B",
      displayValue: false,
      width: 1,
      height: 100,
      margin: 0, // marginTop/marginBottom: 0 alone is ignored (falsy) and falls back to the default 10
      marginTop: 0,
      marginBottom: 0,
      marginLeft: QUIET_ZONE_MODULES,
      marginRight: QUIET_ZONE_MODULES,
    } as const;

    let drawn = 0;
    svgRefs.current.forEach((el) => {
      if (el) {
        JsBarcode(el, codeText, opts as any);
        el.setAttribute('width', '100%');
        el.setAttribute('height', '100%');
        el.setAttribute('preserveAspectRatio', 'none');
        drawn++;
      }
    });
    if (drawn > 0) {
      requestAnimationFrame(() => setBarcodesReady(true));
    }
  }, [codeText, labelsCount]);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @page { size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm; margin: 0; }
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; background: white !important; width: ${LABEL_W_MM}mm; }
        /* The root sits inside app providers, so hide everything else by visibility, not display */
        body.labels-print * { visibility: hidden; }
        body.labels-print #labels-print-root, body.labels-print #labels-print-root * { visibility: visible; }
        #labels-print-root { position: absolute; top: 0; left: 0; margin: 0; padding: 0; }
        #labels-print-root .label { margin: 0 !important; }
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
  const mrpValue = prod.mrp ?? prod.unitPrice;

  return (
    <div id="labels-print-root">
      {labels.map((_, idx) => (
        <div
          key={idx}
          className="label mx-auto"
          style={{
            width: `${LABEL_W_MM}mm`,
            height: `${LABEL_H_MM}mm`,
            padding: `${PAD_TOP_MM}mm ${PAD_X_MM}mm ${PAD_BOTTOM_MM}mm`,
            boxSizing: 'border-box',
            overflow: 'hidden',
            background: '#fff',
            color: '#000',
          }}
        >
          <div
            style={{
              width: `${CONTENT_W_MM}mm`,
              height: `${CONTENT_H_MM}mm`,
              display: 'grid',
              gridTemplateRows: `${NAME_ROW_MM}mm ${SP_ROW_MM}mm ${BARCODE_ROW_MM}mm ${FOOTER_ROW_MM}mm`,
              rowGap: `${ROW_GAP_MM}mm`,
              overflow: 'hidden',
            }}
          >
            {/* 1. Name */}
            <div style={{
              fontSize: '7pt',
              fontWeight: 700,
              lineHeight: `${NAME_ROW_MM}mm`,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'center',
            }}>
              {prod.name}
            </div>

            {/* 2. SP */}
            <div style={{
              fontSize: '10pt',
              fontWeight: 400,
              lineHeight: `${SP_ROW_MM}mm`,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}>
              SP - ₹{prod.unitPrice.toFixed(0)}
            </div>

            {/* 3. Barcode: fills the full 47 x 13.2 mm box, quiet zones included */}
            <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
              <svg
                ref={(el) => { svgRefs.current[idx] = el; }}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>

            {/* 4. MRP & code */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '2mm',
              fontSize: '6pt',
              lineHeight: `${FOOTER_ROW_MM}mm`,
              overflow: 'hidden',
            }}>
              <span style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: '7pt', fontWeight: 800, color: '#000' }}>
                MRP - ₹{mrpValue.toFixed(0)}
              </span>
              <span style={{
                minWidth: 0,
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {codeText}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}