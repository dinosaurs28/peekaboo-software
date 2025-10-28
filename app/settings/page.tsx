"use client";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";

export default function SettingsIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  type TabKey = "store" | "receipt" | "categories" | "barcodes" | "receive" | "inventory" | "offers" | "offline";
  const [tab, setTab] = useState<TabKey>("store");
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  const items: { key: TabKey; label: string }[] = [
    { key: "store", label: "Store Details" },
    { key: "receipt", label: "Receipt Template" },
    { key: "categories", label: "Categories" },
    { key: "barcodes", label: "Barcode Generation" },
    { key: "receive", label: "Stock Receiving" },
    { key: "inventory", label: "Inventory Logs" },
    { key: "offers", label: "Offers" },
    { key: "offline", label: "Offline Queue" },
  ];

  // Lazy-load each section on demand; UI-only change, routes remain available elsewhere
  const Section = useMemo(() => {
    switch (tab) {
      case "store":
        return dynamic(() => import("./business-profile/page").then(m => m.default), { ssr: false });
      case "receipt":
        return dynamic(() => import("./receipt-template/page").then(m => m.default), { ssr: false });
      case "categories":
        return dynamic(() => import("./categories/page").then(m => m.default), { ssr: false });
      case "barcodes":
        return dynamic(() => import("./barcodes/page").then(m => m.default), { ssr: false });
      case "receive":
        return dynamic(() => import("./receive/page").then(m => m.default), { ssr: false });
      case "inventory":
        return dynamic(() => import("./inventory-logs/page").then(m => m.default), { ssr: false });
      case "offers":
        return dynamic(() => import("./offers/page").then(m => m.default), { ssr: false });
      case "offline":
        return dynamic(() => import("./offline-queue/page").then(m => m.default), { ssr: false });
      default:
        return () => null as any;
    }
  }, [tab]);
  return (
    <div className="flex min-h-screen w-full bg-gray-50 text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Hub</h1>
              <p className="text-xs text-gray-500 mt-1">Manage your store configuration and tools.</p>
            </div>

            {/* Top navigation styled like tabs; loads content inline below */}
            <nav className="border-b border-gray-200">
              <ul className="flex flex-wrap gap-6 text-sm">
                {items.map((it) => {
                  const active = tab === it.key;
                  return (
                    <li key={it.key}>
                      <button
                        type="button"
                        onClick={() => setTab(it.key)}
                        className={
                          `inline-block pb-3 transition-colors ` +
                          (active
                            ? "text-sky-700 border-b-2 border-sky-600 font-medium"
                            : "text-sky-600 hover:text-sky-700 border-b-2 border-transparent")
                        }
                        aria-selected={active}
                      >
                        {it.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Active section renders in place, default is Store Details */}
            <div className="pt-2">
              <Section />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
