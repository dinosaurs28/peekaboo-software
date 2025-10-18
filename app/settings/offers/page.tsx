"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listOffers } from "@/lib/offers";
import type { OfferDoc } from "@/lib/models";

export default function OffersListPage() {
  const [offers, setOffers] = useState<OfferDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    listOffers().then(setOffers).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return offers;
    return offers.filter(o => o.name.toLowerCase().includes(s));
  }, [q, offers]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Offers</h1>
        <Link href="/settings/offers/new" className="px-3 py-2 rounded-md border bg-background text-sm">New Offer</Link>
      </div>
      <input className="h-9 rounded-md border bg-background px-2 text-sm w-full md:w-80" placeholder="Search offers…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Dates</th>
              <th className="px-3 py-2">Discount</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-3 text-muted-foreground" colSpan={5}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-3 py-3 text-muted-foreground" colSpan={5}>No offers</td></tr>
            ) : (
              filtered.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{o.name}</td>
                  <td className="px-3 py-2">{o.active ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{o.startsAt || '—'} → {o.endsAt || '—'}</td>
                  <td className="px-3 py-2">{o.discountType ? `${o.discountType === 'percentage' ? '%' : '₹'} ${o.discountValue}` : '—'}</td>
                  <td className="px-3 py-2">
                    <Link href={`/settings/offers/${o.id}`} className="px-2 py-1 rounded-md border bg-background">Edit</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
