"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/components/auth/auth-provider";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, onSnapshot, orderBy, query, where, type DocumentData, type QuerySnapshot } from "firebase/firestore";
import type { CustomerDoc, InvoiceDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";

export default function CustomerDetailPage() {
  const { user, loading } = useAuth();
  const p = useParams();
  const id = Array.isArray(p?.id) ? p!.id[0] : (p?.id as string);
  const [cust, setCust] = useState<CustomerDoc | null>(null);
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [pending, setPending] = useState(true);
  const metrics = useMemo(() => {
    if (!invoices.length) return { visits: 0, totalSpend: 0, lastPurchase: undefined as string | undefined, topItems: [] as Array<{ name: string; qty: number }> };
    const visits = invoices.length;
    const totalSpend = invoices.reduce((s, inv) => s + inv.grandTotal, 0);
    const lastPurchase = invoices[0]?.issuedAt;
    const counts = new Map<string, { name: string; qty: number }>();
    for (const inv of invoices) {
      for (const it of inv.items || []) {
        const prev = counts.get(it.name) || { name: it.name, qty: 0 };
        prev.qty += it.quantity;
        counts.set(it.name, prev);
      }
    }
    const topItems = Array.from(counts.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
    return { visits, totalSpend, lastPurchase, topItems };
  }, [invoices]);

  useEffect(() => {
    if (!db || !id) return;
    const ref = doc(db, 'Customers', id);
    getDoc(ref).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>;
        const now = new Date().toISOString();
        const c: CustomerDoc = {
          id: snap.id,
          name: String(data.name || ''),
          phone: typeof data.phone === 'string' ? data.phone : undefined,
          email: typeof data.email === 'string' ? data.email : undefined,
          notes: typeof data.notes === 'string' ? data.notes : undefined,
          kidsDob: typeof data.kidsDob === 'string' ? data.kidsDob : undefined,
          loyaltyPoints: typeof data.loyaltyPoints === 'number' ? data.loyaltyPoints : undefined,
          totalSpend: typeof data.totalSpend === 'number' ? data.totalSpend : undefined,
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : now,
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : now,
        };
        setCust(c);
      } else {
        setCust(null);
      }
    });
  }, [id]);

  useEffect(() => {
    if (!db || !id) return;
    const col = collection(db, 'Invoices');
    const q = query(col, where('customerId', '==', id), orderBy('issuedAt', 'desc'));
    const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      const list = snap.docs.map(d => toInvoiceDoc(d.id, d.data() as Record<string, unknown>));
      setInvoices(list);
      setPending(false);
    });
    return () => unsub();
  }, [id]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Topbar />
        <main className="flex-1 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <button className="h-9 px-3 border rounded-md text-sm" onClick={() => { window.location.href = "/customers"; }}>← Back</button>
            <h1 className="text-xl font-semibold">Customer</h1>
            <div />
          </div>
          {cust ? (
            <div className="space-y-4">
              <div className="border rounded-md p-4 space-y-1">
                <div className="font-medium">{cust.name}</div>
                <div className="text-sm text-muted-foreground">{cust.phone || ''} {cust.email ? `• ${cust.email}` : ''}</div>
                {cust.kidsDob && <div className="text-xs text-muted-foreground">Kid&apos;s DOB: {cust.kidsDob}</div>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="border rounded-md p-4">
                  <div className="text-sm text-muted-foreground">Total Spend</div>
                  <div className="text-xl font-semibold">₹{metrics.totalSpend.toFixed(2)}</div>
                </div>
                <div className="border rounded-md p-4">
                  <div className="text-sm text-muted-foreground">Visits</div>
                  <div className="text-xl font-semibold">{metrics.visits}</div>
                </div>
                <div className="border rounded-md p-4">
                  <div className="text-sm text-muted-foreground">Last Purchase</div>
                  <div className="text-xl font-semibold">{metrics.lastPurchase ? new Date(metrics.lastPurchase).toLocaleDateString() : '—'}</div>
                </div>
                <div className="border rounded-md p-4">
                  <div className="text-sm text-muted-foreground">Loyalty Points</div>
                  <div className="text-xl font-semibold">{Math.max(0, Number(cust.loyaltyPoints || 0))}</div>
                </div>
              </div>
              {metrics.topItems.length > 0 && (
                <div className="border rounded-md p-4">
                  <div className="text-sm text-muted-foreground mb-2">Top Items</div>
                  <ul className="text-sm list-disc pl-6">
                    {metrics.topItems.map(it => (
                      <li key={it.name}>{it.name} — {it.qty}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-red-600">Not found</div>
          )}
          <div className="border rounded-md p-0">
            <div className="px-4 pt-4 pb-2 text-sm text-muted-foreground">Purchase History</div>
            <div className="px-4 pb-4 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Invoice #</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                    <th className="px-3 py-2 text-right">Discount</th>
                    <th className="px-3 py-2 text-right">Grand Total</th>
                    <th className="px-3 py-2">Cashier</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="border-t">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(inv.issuedAt).toLocaleString()}</td>
                      <td className="px-3 py-2">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2 text-right">₹{inv.subtotal.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">₹{(inv.discountTotal ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-medium">₹{inv.grandTotal.toFixed(2)}</td>
                      <td className="px-3 py-2">{inv.cashierName || inv.cashierUserId}</td>
                    </tr>
                  ))}
                  {invoices.length === 0 && !pending && (
                    <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>No purchases yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
