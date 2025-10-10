"use client";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ProductForm } from "@/components/products/product-form";
import { useAuth } from "@/components/auth/auth-provider";
import { useEffect } from "react";

export default function NewProductPage() {
  const { user, role, loading } = useAuth();
  useEffect(() => {
    if (!loading && (!user || role !== "admin")) {
      window.location.href = "/login";
    }
  }, [loading, user, role]);

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-6 space-y-6">
          <h1 className="text-xl font-semibold">New Product</h1>
          <ProductForm mode="create" onSaved={(id) => (window.location.href = "/products")} />
        </main>
      </div>
    </div>
  );
}
