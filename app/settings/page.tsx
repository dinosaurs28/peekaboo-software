"use client";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <ul className="list-disc pl-6 text-sm">
        <li><Link href="/settings/barcodes" className="underline">Barcode Generator</Link> <span className="text-muted-foreground">(admin)</span></li>
      </ul>
    </div>
  );
}
