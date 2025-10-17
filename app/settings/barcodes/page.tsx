"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import JsBarcode from "jsbarcode";
import jsPDF from "jspdf";
import { listProducts, incrementPrintedCount } from "@/lib/products";
import type { ProductDoc } from "@/lib/models";
import { categoryCode } from "@/lib/models";

// Contract:
// - Admin only access; others redirected to /login or /dashboard
// - Load products; allow selecting one product and quantity
// - Render preview of labels; Export to PDF (A4 3x10 grid by default)
// - After successful export, increment product.printedCount by qty

function encodeBarcode(p: ProductDoc): string {
  const cat = categoryCode(p.category);
  return `PB|${cat}|${p.sku}`;
}

type LabelSpec = {
  cols: number; // labels per row
  rows: number; // rows per page
  marginX: number; // left/right margin mm
  marginY: number; // top/bottom margin mm
  gapX: number; // horizontal gap between labels mm
  gapY: number; // vertical gap mm
  labelW: number; // label width mm
  labelH: number; // label height mm
};

// Default A4 3x10 (Avery L7158-like): 3 columns x 10 rows, approx sizes
const DEFAULT_SPEC: LabelSpec = {
  cols: 3,
  rows: 10,
  marginX: 7, // mm
  marginY: 15, // mm
  gapX: 2, // mm
  gapY: 0, // mm
  labelW: 63, // mm
  labelH: 25.4, // mm
};

export default function BarcodeGeneratorPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    // Load products for selection
    listProducts().then((list) => {
      setProducts(list);
      if (list.length > 0) setProductId(list[0].id || "");
    }).catch((e) => console.error(e));
  }, [loading, user, role, router]);

  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);

  useEffect(() => {
    // Draw preview for first label
    if (!selected) return;
    const code = encodeBarcode(selected);
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // Preview without the human-readable text to reflect PDF layout
      JsBarcode(canvas, code, { format: "CODE128", displayValue: false, margin: 6, height: 36 });
    } catch (e) {
      console.error("Barcode render failed", e);
    }
  }, [selected, qty]);

  async function exportPdf() {
    if (!selected) return;
    setBusy(true);
    try {
      const spec = DEFAULT_SPEC;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const code = encodeBarcode(selected);

      // Pre-render barcode to canvas to get image data
      const tempCanvas = document.createElement("canvas");
      // For PDF, render bars only (no human-readable text) to avoid duplication
      JsBarcode(tempCanvas, code, { format: "CODE128", displayValue: false, margin: 0, height: 28 });
      const imgData = tempCanvas.toDataURL("image/png");

      // Consistent inner horizontal padding (mm) within each label
      const PAD_X = 4; // left/right padding inside label

      const labelPerPage = spec.cols * spec.rows;
      const total = Math.max(1, Math.min(300, Math.floor(qty)));
      for (let i = 0; i < total; i++) {
        const indexOnPage = i % labelPerPage;
        if (i > 0 && indexOnPage === 0) doc.addPage();

        const row = Math.floor(indexOnPage / spec.cols);
        const col = indexOnPage % spec.cols;

        const x = spec.marginX + col * (spec.labelW + spec.gapX);
        const y = spec.marginY + row * (spec.labelH + spec.gapY);

        // Text: product name (truncate) aligned with barcode inner padding
        doc.setFontSize(9);
        const name = selected.name.length > 28 ? selected.name.slice(0, 25) + "…" : selected.name;
        doc.text(name, x + PAD_X, y + 5, { maxWidth: spec.labelW - PAD_X * 2 });

        // Barcode image with fixed inner padding and reduced width to keep spacing stable
        const imgW = spec.labelW - PAD_X * 2;
        const imgH = 12;
        const imgX = x + PAD_X;
        const imgY = y + 7;
        doc.addImage(imgData, "PNG", imgX, imgY, imgW, imgH, undefined, "FAST");

        // Bottom text strictly below the barcode at imgBottom + 6mm for both lines
        const priceText = `₹${selected.unitPrice.toFixed(2)}`;
        const textY = imgY + imgH + 6; // desired baseline below barcode

        // Clamp within label height
        const maxTextY = y + spec.labelH - 2;
        const adjTextY = Math.min(textY, maxTextY);

        // Price (right aligned) and code (left aligned) on the same baseline using inner paddings
        doc.setFontSize(7); // slightly smaller to prevent crowding
        doc.text(priceText, x + spec.labelW - PAD_X, adjTextY, { align: "right" });

        const codeText = code;
        doc.setFontSize(7);
        doc.text(codeText, x + PAD_X, adjTextY);
      }

      doc.save(`barcodes_${selected.sku}_${Date.now()}.pdf`);
      // Update printed count after successful save
      if (selected.id) await incrementPrintedCount(selected.id, Math.max(1, Math.min(300, Math.floor(qty))));
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Barcode Generator</h1>
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Product</label>
            <select
              className="mt-1 w-full h-9 rounded-md border bg-background px-3 text-sm"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Quantity</label>
            <Input type="number" min={1} max={300} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
          <div className="flex items-end">
            <Button onClick={exportPdf} disabled={!selected || busy}>
              {busy ? "Exporting…" : "Export PDF"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm font-medium mb-2">Preview</div>
            <div className="border rounded-md p-4 flex flex-col items-center justify-center">
              {selected ? (
                <>
                  <div className="text-sm mb-2 font-medium truncate max-w-full">{selected.name}</div>
                  <canvas ref={canvasRef} className="bg-white rounded" />
                  <div className="text-xs text-muted-foreground mt-2">{encodeBarcode(selected)}</div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">Select a product to preview</div>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Layout</div>
            <div className="text-xs text-muted-foreground">A4 (210×297 mm), 3×10 labels. This can be made configurable later.</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
