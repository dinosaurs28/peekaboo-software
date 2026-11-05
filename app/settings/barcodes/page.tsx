"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { listProducts } from "@/lib/products";
import type { ProductDoc } from "@/lib/models";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";
import { useToast } from "@/components/ui/toast";
import { IoArrowBack } from "react-icons/io5";
import { BarcodeLabel, encodeBarcode, loadLabelOffset, saveLabelOffset, type LabelOffset } from "@/components/barcode-label";

export default function BarcodeGeneratorPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [offset, setOffset] = useState<LabelOffset>({ x: 0, y: 0 });
  useEffect(() => { setOffset(loadLabelOffset()); }, []);
  function updateOffset(axis: "x" | "y", v: number) {
    const next = { ...offset, [axis]: Math.max(-5, Math.min(5, Number.isFinite(v) ? v : 0)) };
    setOffset(next);
    saveLabelOffset(next);
  }
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
  const codeText = useMemo(() => (selected ? encodeBarcode(selected, categories) : ""), [selected, categories]);

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
                <BarcodeLabel product={selected} code={codeText} className="border shadow-sm" />
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
              <p>Label size: 50×25 mm (content area 47×23 mm). The print uses this exact layout.</p>
              <p><strong>Top:</strong> Name</p>
              <p><strong>Below Name:</strong> MRP - ₹Price (bold)</p>
              <p><strong>Middle:</strong> Barcode</p>
              <p><strong>Bottom:</strong> SP & code</p>
            </div>

            <div className="text-sm font-medium mt-4 mb-2">Print alignment (this printer)</div>
            <p className="text-xs text-muted-foreground mb-2">
              If the printed label sits off-centre, nudge it here. Negative X moves it left, negative Y moves it up. Saved on this computer.
            </p>
            <div className="flex gap-3">
              <label className="text-xs">
                X (mm)
                <Input type="number" step={0.1} min={-5} max={5} value={offset.x} onChange={(e) => updateOffset("x", Number(e.target.value))} className="w-24" />
              </label>
              <label className="text-xs">
                Y (mm)
                <Input type="number" step={0.1} min={-5} max={5} value={offset.y} onChange={(e) => updateOffset("y", Number(e.target.value))} className="w-24" />
              </label>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}