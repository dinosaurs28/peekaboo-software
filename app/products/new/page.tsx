"use client";
import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ProductForm } from "@/components/products/product-form";
import { useAuth } from "@/components/auth/auth-provider";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FaArrowLeft } from "react-icons/fa";
import { useRouter } from "next/navigation";

export default function NewProductPage() {
  const router = useRouter();
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
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center justify-center my-auto">
              <Button
                variant="ghost"
                onClick={() => router.push("/products")}
                className="border-0 p-0 mr-4"
              >
                <FaArrowLeft className="mr-2" />
              </Button>
            </div>
            <div className="flex items-center">
              <h1 className="text-5xl font-bold font-serif">New Product</h1>
            </div>
            <div />
          </div>
          <ProductForm
            mode="create"
            onSaved={() => (window.location.href = "/products")}
          />
        </main>
      </div>
    </div>
  );
}
