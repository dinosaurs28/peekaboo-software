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

function encodeBarcode(p: ProductDoc, categories: CategoryDoc[]): string {
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

export default function BarcodeGeneratorPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const { toast } = useToast();

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
  const mrpValue = selected?.mrp ?? selected?.unitPrice ?? 0;

  useEffect(() => {
    if (!selected) return;
    const code = encodeBarcode(selected, categories);
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      JsBarcode(canvas, code, {
        format: "CODE128B",
        displayValue: false,
        margin: 4,
        height: 35,
        width: 1.6
      });
    } catch (e) {
      console.error("Barcode render failed", e);
    }
  }, [selected, qty, categories]);

  function printLabels() {
    if (!selected) return;
    const count = Math.max(1, Math.min(300, Math.floor(qty)));
    toast({
      title: "Sending to print…",
      description: `${count} label(s) for ${selected.name}`,
      variant: "info",
      duration: 2000,
    });
    try {
      const url = `/settings/barcodes/print/${selected.id}/${count}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
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
          <IoArrowBack className="mr-2" />
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
            {/* PREVIEW CONTAINER */}
            <div className="border rounded-md p-4 flex flex-col items-center justify-center bg-gray-50">
              {selected ? (
                <div
                  className="bg-white border shadow-sm flex flex-col items-center text-center overflow-hidden relative"
                  style={{ width: "50mm", height: "25mm", padding: "1mm" }}
                >
                  {/* 1. Name */}
                  <div className="text-[10px] font-bold leading-tight w-full truncate mb-[1px]">
                    {selected.name}
                  </div>

                  {/* 2. Selling Price (Below Name) */}
                  <div className="text-sm font-extrabold leading-none mb-[2px]">
                    SP - ₹{selected.unitPrice.toFixed(0)}
                  </div>

                  {/* 3. Barcode (Middle) */}
                  <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      style={{ height: "100%", maxWidth: "100%" }}
                    />
                  </div>

                  {/* 4. Bottom: MRP (Left) & SKU (Right) */}
                  <div className="w-full flex items-end justify-between gap-2 mt-[1px]">
                    <div className="min-w-0 text-left text-[8px] leading-none text-gray-700">
                      MRP - ₹{mrpValue?.toFixed(0)}
                    </div>
                    <div className="min-w-0 text-right text-[7px] leading-none font-mono truncate">
                      {encodeBarcode(selected, categories)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Select a product to preview
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Layout</div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Label size: 50×25 mm.</p>
              <p><strong>Top:</strong> Name</p>
              <p><strong>Below Name:</strong> SP - ₹Price</p>
              <p><strong>Middle:</strong> Barcode</p>
              <p><strong>Bottom:</strong> MRP & SKU</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}