"use client";
import { useEffect, useState } from "react";
import type { ProductDoc } from "@/lib/models";
import { observeLowStockProducts } from "@/lib/products";

export function LowStockAlerts() {
  const [items, setItems] = useState<ProductDoc[]>([]);

  useEffect(() => {
    const unsub = observeLowStockProducts(setItems);
    return () => unsub && unsub();
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="border rounded-md p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Low stock alerts</h2>
        <span className="text-xs text-destructive">{items.length} item(s)</span>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <div>
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground"> • SKU {p.sku}</span>
              {p.reorderLevel != null && (
                <span className="text-muted-foreground"> • Reorder ≤ {p.reorderLevel}</span>
              )}
            </div>
            <div className="text-destructive font-medium">Stock: {p.stock}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
