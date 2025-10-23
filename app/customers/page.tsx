"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/components/auth/auth-provider";
import { listCustomers } from "@/lib/customers";
import type { CustomerDoc } from "@/lib/models";
import Link from "next/link";

export default function CustomersPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<CustomerDoc[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => { listCustomers().then(setItems).catch(() => undefined); }, []);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(c =>
      c.name.toLowerCase().includes(s) ||
      (c.phone || '').toLowerCase().includes(s) ||
      (c.email || '').toLowerCase().includes(s)
    );
  }, [q, items]);
  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-6 space-y-4">
          <h1 className="text-xl font-semibold">Customers</h1>
          <div>
            <input className="h-9 rounded-md border bg-background px-2 text-sm w-full md:w-80" placeholder="Search name, phone, or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2 text-right">Points</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2">{c.phone || '-'}</td>
                    <td className="px-3 py-2">{c.email || '-'}</td>
                    <td className="px-3 py-2 text-right">{Math.max(0, Number(c.loyaltyPoints || 0))}</td>
                    <td className="px-3 py-2"><Link href={`/customers/${c.id}`} className="underline">View</Link></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>No customers</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
