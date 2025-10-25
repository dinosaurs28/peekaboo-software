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
    <div className="border border-gray-200 bg-white rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Low Stock Items</h2>
        <span className="inline-flex items-center justify-center h-6 px-3 rounded-full bg-red-100 text-xs font-medium text-red-800">{items.length}</span>
      </div>
      <ul className="space-y-3">
        {items.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
            <div>
              <span className="font-medium text-gray-900">{p.name}</span>
              <span className="text-gray-400"> • SKU {p.sku}</span>
            </div>
            <div className="text-red-600 font-semibold">Stock: {p.stock}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
