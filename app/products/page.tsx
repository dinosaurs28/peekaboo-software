"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { listProducts, deleteProduct } from "@/lib/products";
import type { ProductDoc } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";

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
        // eslint-disable-next-line no-console
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
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Products</h1>
            {role === "admin" ? (
              <Link href="/products/new"><Button>New Product</Button></Link>
            ) : (
              <Button disabled title="Only admins can create products">New Product</Button>
            )}
          </div>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">GST %</th>
                  <th className="px-3 py-2">Stock</th>
                  {role === "admin" && <th className="px-3 py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2">{p.sku}</td>
                    <td className="px-3 py-2">{p.category || "-"}</td>
                    <td className="px-3 py-2">₹{p.unitPrice.toFixed(2)}</td>
                    <td className="px-3 py-2">{p.taxRatePct ?? 0}</td>
                    <td className="px-3 py-2">{p.stock}</td>
                    {role === "admin" && (
                      <td className="px-3 py-2 flex gap-2">
                        <Link href={`/products/${p.id}`}><Button variant="outline" size="sm">Edit</Button></Link>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(p.id!)} disabled={busy === p.id}>Delete</Button>
                      </td>
                    )}
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>No products yet.</td>
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
