"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createProduct, updateProduct, UpsertProductInput } from "@/lib/products";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";

export interface ProductFormProps {
  mode: "create" | "edit";
  initial?: Partial<UpsertProductInput> & { id?: string };
  onSaved?: (id?: string) => void;
}

export function ProductForm({ mode, initial, onSaved }: ProductFormProps) {
  const [form, setForm] = useState<UpsertProductInput>({
    name: initial?.name ?? "",
    sku: initial?.sku ?? "",
    unitPrice: initial?.unitPrice ?? 0,
    stock: initial?.stock ?? 0,
    active: initial?.active ?? true,
    category: initial?.category,
    hsnCode: initial?.hsnCode,
    costPrice: initial?.costPrice,
    reorderLevel: initial?.reorderLevel,
    taxRatePct: initial?.taxRatePct ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);

  useEffect(() => {
    let mounted = true;
    listCategories().then((cs) => { if (mounted) setCategories(cs.filter(c => c.active)); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  function update<K extends keyof UpsertProductInput>(key: K, val: UpsertProductInput[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!form.name || !form.sku) throw new Error("Name and SKU are required");
      if (mode === "create") {
        const id = await createProduct(form);
        onSaved?.(id);
      } else if (mode === "edit" && initial?.id) {
        await updateProduct(initial.id, form);
        onSaved?.(initial.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Toy Car" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">SKU</label>
          <Input value={form.sku} onChange={(e) => update("sku", e.target.value)} placeholder="SKU-001" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">HSN Code</label>
          <Input value={form.hsnCode ?? ""} onChange={(e) => update("hsnCode", e.target.value)} placeholder="9503" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Category</label>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.category ?? ""}
            onChange={(e) => update("category", e.target.value || undefined)}
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Unit Price</label>
          <Input type="number" step="0.01" value={String(form.unitPrice)} onChange={(e) => update("unitPrice", parseFloat(e.target.value) || 0)} placeholder="399.00" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">GST %</label>
          <Input type="number" step="0.01" value={String(form.taxRatePct ?? 0)} onChange={(e) => update("taxRatePct", parseFloat(e.target.value) || 0)} placeholder="12" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Cost Price</label>
          <Input type="number" step="0.01" value={String(form.costPrice ?? 0)} onChange={(e) => update("costPrice", parseFloat(e.target.value) || 0)} placeholder="250.00" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Stock</label>
          <Input type="number" value={String(form.stock)} onChange={(e) => update("stock", parseInt(e.target.value || "0", 10))} placeholder="100" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Reorder Level</label>
          <Input type="number" value={String(form.reorderLevel ?? 0)} onChange={(e) => update("reorderLevel", parseInt(e.target.value || "0", 10))} placeholder="10" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Active</label>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.active ? "true" : "false"}
            onChange={(e) => update("active", e.target.value === "true")}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{mode === "create" ? "Create" : "Save changes"}</Button>
      </div>
    </form>
  );
}
