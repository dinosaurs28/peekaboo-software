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
    <div className="flex min-h-screen w-full bg-gray-50 text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-8 space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <input className="h-9 rounded-md border bg-white px-2 text-sm w-full md:w-80" placeholder="Search name, phone, or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left border-b">
                <tr>
                  <th className="px-4 py-3 text-gray-600">Name</th>
                  <th className="px-4 py-3 text-gray-600">Phone</th>
                  <th className="px-4 py-3 text-gray-600">Email</th>
                  <th className="px-4 py-3 text-right text-gray-600">Points</th>
                  <th className="px-4 py-3 text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b">
                    <td className="px-4 py-3">{c.name}</td>
                    <td className="px-4 py-3">{c.phone || '-'}</td>
                    <td className="px-4 py-3">{c.email || '-'}</td>
                    <td className="px-4 py-3 text-right">{Math.max(0, Number(c.loyaltyPoints || 0))}</td>
                    <td className="px-4 py-3"><Link href={`/customers/${c.id}`} className="underline">View</Link></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={5}>No customers</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
