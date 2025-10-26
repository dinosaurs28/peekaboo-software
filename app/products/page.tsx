"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { listProducts, deleteProduct } from "@/lib/products";
import type { ProductDoc } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { Plus } from "lucide-react";

export default function ProductsListPage() {
  const { role, loading, user } = useAuth();
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

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
        const res = await listProducts();
        if (mounted) setProducts(res);
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
      setProducts((p) => p.filter((x) => x.id !== id));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-gray-50 text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Products</h1>
              <p className="text-xs text-gray-500 mt-1">Manage your product catalog, track stock levels, and update product details.</p>
            </div>
            {/* Keep action but style like reference (icon-only add) */}
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
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left border-b">
                <tr>
                  <th className="px-4 py-3 text-gray-600">Name</th>
                  <th className="px-4 py-3 text-gray-600">SKU</th>
                  <th className="px-4 py-3 text-gray-600">Category</th>
                  <th className="px-4 py-3 text-gray-600">Price</th>
                  <th className="px-4 py-3 text-gray-600">GST %</th>
                  <th className="px-4 py-3 text-gray-600">Stock</th>
                  {role === "admin" && <th className="px-4 py-3 text-gray-600">Printed</th>}
                  {role === "admin" && <th className="px-4 py-3 text-gray-600">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3">{p.sku}</td>
                    <td className="px-4 py-3">{p.category || "-"}</td>
                    <td className="px-4 py-3">₹{p.unitPrice.toFixed(2)}</td>
                    <td className="px-4 py-3">{p.taxRatePct ?? 0}</td>
                    <td className="px-4 py-3">{p.stock}</td>
                    {role === "admin" && <td className="px-4 py-3">{p.printedCount ?? 0}</td>}
                    {role === "admin" && (
                      <td className="px-4 py-3 text-blue-600">
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
                {products.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={6 + (role === 'admin' ? 2 : 0)}>No products yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
