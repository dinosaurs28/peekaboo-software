"use client";
import { useAuth } from "@/components/auth/auth-provider";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import dynamic from "next/dynamic";

type TabKey =
  | "store"
  | "receipt"
  | "categories"
  | "barcodes"
  | "inventory"
  | "offers"
  | "offline"
  | "audit";

interface TabItem {
  key: TabKey;
  label: string;
  icon?: string;
}

const TAB_CONFIG: Record<TabKey, string> = {
  store: "./business-profile/page",
  receipt: "./receipt-template/page",
  categories: "./categories/page",
  barcodes: "./barcodes/page",
  inventory: "./inventory-logs/page",
  offers: "./offers/page",
  offline: "./offline-queue/page",
  audit: "./audit-trail/page",
};

export default function SettingsIndexPage() {
  const { user, loading, role } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("store");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const items: TabItem[] = useMemo(
    () => [
      { key: "store", label: "Store Details" },
      { key: "receipt", label: "Receipt Template" },
      { key: "categories", label: "Categories" },
      { key: "barcodes", label: "Barcode Generation" },
      { key: "inventory", label: "Inventory Logs" },
      { key: "audit", label: "Audit Trail" },
      ...(role === "admin" ? [{ key: "offers", label: "Offers" } as TabItem] : []),
      { key: "offline", label: "Offline Queue" } as TabItem,
    ],
    [role]
  );

  const Section = useMemo(
    () =>
      dynamic(
        () =>
          import(TAB_CONFIG[tab]).then((m) => m.default),
        { ssr: false, loading: () => <div>Loading...</div> }
      ),
    [tab]
  );

  return (
    <div className="flex h-screen w-full bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-600">
                Manage your store configuration and tools.
              </p>
            </div>

            <nav className="border-b border-gray-200 bg-white rounded-t-lg">
              <ul className="flex gap-1 px-4">
                {items.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => setTab(item.key)}
                      className={`px-4 py-3 text-sm font-medium transition-all ${
                        tab === item.key
                          ? "text-blue-600 border-b-2 border-blue-600"
                          : "text-gray-600 hover:text-gray-900 border-b-2 border-transparent"
                      }`}
                      aria-pressed={tab === item.key}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="bg-white rounded-b-lg shadow-sm p-6">
              <Section />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
