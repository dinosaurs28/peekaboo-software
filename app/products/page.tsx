"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { listProducts, deleteProduct, updateProduct } from "@/lib/products";
import type { ProductDoc } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";

export default function ProductsListPage() {
  const { role, loading, user } = useAuth();
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [skuQuery, setSkuQuery] = useState("");
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Cashier can view list; only redirect if not signed in at all.
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/login";
    }
  }, [loading, role, user]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [res, cats] = await Promise.all([listProducts(), listCategories().catch(() => [])]);
        if (mounted) {
          const sorted = [...res].sort((a, b) => {
            const skuA = (a.sku ?? "").toString();
            const skuB = (b.sku ?? "").toString();
            return skuA.localeCompare(skuB, undefined, { sensitivity: "base" });
          });
          setProducts(sorted);
          setCategories(cats);
        }
      } catch (e) {
        console.error(e);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    setBusy(id);
    try {
      await deleteProduct(id);
      setProducts((p) => {
        const next = p.filter((x) => x.id !== id);
        next.sort((a, b) => {
          const skuA = (a.sku ?? "").toString();
          const skuB = (b.sku ?? "").toString();
          return skuA.localeCompare(skuB, undefined, { sensitivity: "base" });
        });
        return next;
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleCategoryChange(product: ProductDoc, categoryName: string | undefined) {
    if (!product.id) return;
    const selected = categories.find((c) => c.name === categoryName);
    setUpdatingId(product.id);
    try {
      const updates: Partial<ProductDoc> = { category: categoryName };
      if (selected?.defaultHsnCode) updates.hsnCode = selected.defaultHsnCode;
      if (selected?.defaultTaxRatePct !== undefined && !Number.isNaN(selected.defaultTaxRatePct)) {
        updates.taxRatePct = selected.defaultTaxRatePct;
      }
      await updateProduct(product.id, updates);
      setProducts((prev) => {
        const next = prev.map((p) => {
          if (p.id !== product.id) return p;
          return {
            ...p,
            ...updates,
          };
        });
        next.sort((a, b) => {
          const skuA = (a.sku ?? "").toString();
          const skuB = (b.sku ?? "").toString();
          return skuA.localeCompare(skuB, undefined, { sensitivity: "base" });
        });
        return next;
      });
    } catch (err) {
      console.error("Failed to update product category", err);
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredProducts = useMemo(() => {
    if (!skuQuery.trim()) return products;
    const term = skuQuery.trim().toLowerCase();
    return products.filter((p) => (p.sku ?? "").toLowerCase().includes(term));
  }, [products, skuQuery]);

  return (
    <div className="flex min-h-screen w-full bg-gray-50 text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-8 space-y-6">
          <div className="max-w-6xl space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Products</h1>
              <p className="text-xs text-gray-500 mt-1">Manage your product catalog, track stock levels, and update product details.</p>
            </div>
            {/* Add button aligned to the left like the reference */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              <div className="sm:w-72">
                <Input
                  placeholder="Search by SKU"
                  value={skuQuery}
                  onChange={(e) => setSkuQuery(e.target.value)}
                  aria-label="Search products by SKU"
                />
              </div>
              {role === "admin" ? (
                <Link href="/products/new" aria-label="Create product" title="Create product">
                  <Button variant="outline" size="icon" className="rounded-full">
                    <Plus className="w-5 h-5" />
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="icon" className="rounded-full" disabled title="Only admins can create products">
                  <Plus className="w-5 h-5" />
                </Button>
              )}
            </div>
            {/* Table card styled like the reference: light border, rounded corners */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden w-full">
              <table className="w-full text-sm">
                <thead className="text-left border-b bg-gray-50/60">
                  <tr>
                    <th className="px-6 py-3 text-gray-600">Name</th>
                    <th className="px-6 py-3 text-gray-600">SKU</th>
                    <th className="px-6 py-3 text-gray-600">Category</th>
                    <th className="px-6 py-3 text-gray-600">HSN Code</th>
                    <th className="px-6 py-3 text-gray-600">Price</th>
                    <th className="px-6 py-3 text-gray-600">GST %</th>
                    <th className="px-6 py-3 text-gray-600">Stock</th>
                    {role === "admin" && <th className="px-6 py-3 text-gray-600">Printed</th>}
                    {role === "admin" && <th className="px-6 py-3 text-gray-600">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="px-6 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-6 py-3">{p.sku}</td>
                      <td className="px-6 py-3">
                        {role === "admin" ? (
                          <select
                            className="h-9 rounded-md border bg-background px-3 text-sm"
                            value={p.category ?? ""}
                            onChange={(e) => handleCategoryChange(p, e.target.value || undefined)}
                            disabled={updatingId === p.id}
                          >
                            <option value="">Unassigned</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name} ({c.code})
                              </option>
                            ))}
                          </select>
                        ) : (
                          p.category || "-"
                        )}
                      </td>
                      <td className="px-6 py-3">{p.hsnCode || "-"}</td>
                      <td className="px-6 py-3">₹{p.unitPrice.toFixed(2)}</td>
                      <td className="px-6 py-3">{p.taxRatePct ?? 0}</td>
                      <td className="px-6 py-3">{p.stock}</td>
                      {role === "admin" && <td className="px-6 py-3">{p.printedCount ?? 0}</td>}
                      {role === "admin" && (
                        <td className="px-6 py-3 text-blue-600">
                          <Link href={`/products/${p.id}`} className="hover:underline">Edit</Link>
                          <span className="mx-2 text-gray-300">|</span>
                          <button
                            type="button"
                            className="hover:underline"
                            onClick={() => handleDelete(p.id!)}
                            disabled={busy === p.id}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td
                        className="px-6 py-6 text-center text-gray-500"
                        colSpan={6 + (role === 'admin' ? 2 : 0)}
                      >
                        {products.length === 0
                          ? "No products yet."
                          : "No products match this SKU."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
