"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import JsBarcode from "jsbarcode";
import { listProducts } from "@/lib/products";
import type { ProductDoc } from "@/lib/models";
import { categoryCode } from "@/lib/models";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";
import { useToast } from "@/components/ui/toast";
import { IoArrowBack } from "react-icons/io5";

// Contract:
// - Admin only access; others redirected to /login or /dashboard
// - Load products; allow selecting one product and quantity (labels)
// - Render preview of a horizontal barcode
// - Print: open dedicated print page sized 50×25 mm with one barcode per label

function encodeBarcode(p: ProductDoc, categories: CategoryDoc[]): string {
  // Prefer managed Category.code when Product.category matches a category name
  const catName = p.category;
  let code = categoryCode(catName);
  if (catName) {
    const match = categories.find(
      (c) => c.active && c.name.toLowerCase() === catName.toLowerCase()
    );
    if (match?.code) code = match.code.toUpperCase();
  }
  return `PB|${code}|${p.sku}`;
}

// No A4 export; printing uses a dedicated route

export default function BarcodeGeneratorPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const { toast } = useToast();
  // Removed: Add to stock on export (deprecated per testing feedback)

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
    // Load products and categories for selection and code mapping
    Promise.all([listProducts(), listCategories()])
      .then(([list, cats]) => {
        setProducts(list);
        if (list.length > 0) setProductId(list[0].id || "");
        setCategories(cats.filter((c) => c.active));
      })
      .catch((e) => console.error(e));
  }, [loading, user, role, router]);

  const selected = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId]
  );

  useEffect(() => {
    // Draw preview for a single horizontal barcode
    if (!selected) return;
    const code = encodeBarcode(selected, categories);
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      JsBarcode(canvas, code, {
        format: "CODE128B",
        displayValue: false,
        margin: 4,
        height: 36,
      });
    } catch (e) {
      console.error("Barcode render failed", e);
    }
  }, [selected, qty]);
  function printLabels() {
    if (!selected) return;
    const count = Math.max(1, Math.min(300, Math.floor(qty)));
    // Open in a new tab so it can auto-close after printing
    toast({
      title: "Sending to print…",
      description: `${count} label(s) for ${selected.name}`,
      variant: "info",
      duration: 2000,
    });
    try {
      const url = `/settings/barcodes/print/${selected.id}/${count}`;
      window.open(url, "_blank", "noopener");
    } catch {
      // Fallback to same-tab navigation if popups are blocked
      router.push(`/settings/barcodes/print/${selected.id}/${count}`);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="link"
          onClick={() => (window.location.href = "/settings")}
          className="h-12 cursor-pointer"
        >
          <IoArrowBack className="mr-2"/>
        </Button>
        <h1 className="text-xl font-semibold">Barcode Generator</h1>
        <div />
      </div>
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
                <option key={p.id} value={p.id}>
                  {p.name} — {p.sku}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Quantity</label>
            <Input
              type="number"
              min={1}
              max={300}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end gap-3">
            <Button onClick={printLabels} disabled={!selected}>
              Print Labels
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm font-medium mb-2">
              Preview (50×25 mm, horizontal)
            </div>
            <div className="border rounded-md p-4 flex flex-col items-center justify-center">
              {selected ? (
                <>
                  <div className="text-sm mb-2 font-medium truncate max-w-full">
                    {selected.name}
                  </div>
                  <div
                    style={{
                      width: "48mm",
                      height: "12mm",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      className="bg-white rounded"
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {encodeBarcode(selected, categories)} • ₹
                    {selected.unitPrice.toFixed(2)}
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Select a product to preview
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Layout</div>
            <div className="text-xs text-muted-foreground">
              Label size: 50×25 mm. One barcode per label (2×1 inch target) in
              horizontal orientation. Name on top; code and price below.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
