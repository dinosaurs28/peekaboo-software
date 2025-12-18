"use client";
import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ProductForm } from "@/components/products/product-form";
import { useAuth } from "@/components/auth/auth-provider";
import { getProduct } from "@/lib/products";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ProductDoc } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { FaArrowLeft } from "react-icons/fa";
import { useRouter } from "next/navigation";

export default function EditProductPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDoc | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) {
      window.location.href = "/login";
    }
  }, [loading, user, role]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const doc = await getProduct(params.id);
      if (!mounted) return;
      if (!doc) setNotFound(true);
      else setProduct(doc);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [params.id]);

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-6 space-y-6">
          {notFound ? (
            <p className="text-muted-foreground">Product not found.</p>
          ) : !product ? (
            <p>Loading…</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center justify-center my-auto">
                  <Button
                    variant="ghost"
                    onClick={() => router.push("/products")}
                    className="border-0 p-0 mr-4"
                  >
                    <FaArrowLeft className="mr-2" />
                  </Button>
                </div>
                <div>
                  <h1 className="text-4xl font-semibold font-serif">Edit Product</h1>
                </div>
                <div />
              </div>
              <ProductForm
                mode="edit"
                initial={{
                  id: product.id,
                  name: product.name,
                  sku: product.sku,
                  unitPrice: product.unitPrice,
                  stock: product.stock,
                  active: product.active,
                  category: product.category,
                  hsnCode: product.hsnCode,
                  costPrice: product.costPrice,
                  reorderLevel: product.reorderLevel,
                  taxRatePct: product.taxRatePct,
                }}
                onSaved={() => (window.location.href = "/products")}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
