"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where, type DocumentData, type QuerySnapshot, type QueryConstraint } from "firebase/firestore";
import { COLLECTIONS, type InventoryLogDoc } from "@/lib/models";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

function toLog(id: string, data: Record<string, unknown>): InventoryLogDoc {
  const now = new Date().toISOString();
  const t = typeof data.type === 'string' && ['adjustment', 'sale', 'purchase', 'return', 'damage'].includes(data.type) ? (data.type as InventoryLogDoc['type']) : 'adjustment';
  return {
    id,
    productId: String(data.productId || ""),
    type: t,
    quantityChange: typeof data.quantityChange === 'number' ? data.quantityChange : Number(data.quantityChange || 0),
    reason: typeof data.reason === 'string' ? data.reason : undefined,
    relatedInvoiceId: typeof data.relatedInvoiceId === 'string' ? data.relatedInvoiceId : undefined,
    userId: typeof data.userId === 'string' ? data.userId : undefined,
    previousStock: typeof data.previousStock === 'number' ? data.previousStock : undefined,
    newStock: typeof data.newStock === 'number' ? data.newStock : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : now,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : now,
  };
}

export default function InventoryLogsPage() {
  const { user, role, loading } = useAuth();
  const [logs, setLogs] = useState<InventoryLogDoc[]>([]);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [prodId, setProdId] = useState<string>("");
  const [type, setType] = useState<string>("");

  useEffect(() => {
    if (!db) return;
    const col = collection(db, COLLECTIONS.inventoryLogs);
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (prodId) constraints.push(where('productId', '==', prodId));
    if (type) constraints.push(where('type', '==', type));
    if (from) constraints.push(where('createdAt', '>=', new Date(from).toISOString()));
    if (to) {
      const end = new Date(to); end.setHours(23, 59, 59, 999);
      constraints.push(where('createdAt', '<=', end.toISOString()));
    }
    const q = query(col, ...constraints);
    const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      setLogs(snap.docs.map(d => toLog(d.id, d.data() as Record<string, unknown>)));
    });
    return () => unsub();
  }, [from, to, prodId, type]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user || role !== 'admin') return <div className="p-6 text-sm text-muted-foreground">Admin access required.</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button className="h-9 px-3 border rounded-md text-sm" onClick={() => { window.location.href = "/settings"; }}>← Back</button>
        <h1 className="text-xl font-semibold">Inventory Logs</h1>
        <div />
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Product ID</label>
            <Input placeholder="productId" value={prodId} onChange={(e) => setProdId(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Type</label>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All</option>
              <option value="sale">Sale</option>
              <option value="purchase">Purchase</option>
              <option value="adjustment">Adjustment</option>
              <option value="return">Return</option>
              <option value="damage">Damage</option>
            </select>
          </div>
          <button className="h-9 px-4 rounded-md border text-sm font-medium hover:bg-muted" onClick={() => { setFrom(""); setTo(""); setProdId(""); setType(""); }}>Clear</button>
        </div>
      </Card>
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Δ Qty</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Invoice/Receipt</th>
              <th className="px-3 py-2">By</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{l.productId}</td>
                <td className="px-3 py-2">{l.type}</td>
                <td className="px-3 py-2 text-right">{l.quantityChange}</td>
                <td className="px-3 py-2">{l.reason || '-'}</td>
                <td className="px-3 py-2">{l.relatedInvoiceId || '-'}</td>
                <td className="px-3 py-2">{l.userId || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>No logs</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
